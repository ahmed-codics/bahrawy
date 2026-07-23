import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { db } from '@bahrawy/db';
import { AdminAuditService } from '../common/services/audit.service';
import { ReviewPaymentDto } from './payments.dto';

type Actor = { id: string; organizationId: string };

@Injectable()
export class AdminV1PaymentsService {
  constructor(private readonly audit: AdminAuditService) {}

  async list(organizationId: string, status?: string, search?: string) {
    const studentIds = search
      ? (
          await db.studentProfile.findMany({
            where: {
              displayName: { contains: search, mode: 'insensitive' },
              account: { organizationId },
            },
            select: { accountId: true },
          })
        ).map((student: any) => student.accountId)
      : undefined;
    const orders = await db.paymentOrder.findMany({
      where: {
        organizationId,
        ...(status ? { status } : {}),
        ...(studentIds ? { accountId: { in: studentIds } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { ledgerEntries: { orderBy: { createdAt: 'desc' } } },
    });
    const accountIds = [
      ...new Set(orders.map((order: any) => order.accountId)),
    ];
    const productIds = [
      ...new Set(orders.map((order: any) => order.productId)),
    ];
    const reviewerIds = [
      ...new Set(
        orders
          .map((order: any) => order.reviewedBy)
          .filter(Boolean) as string[],
      ),
    ];
    const [students, products, reviewers, proofs] = await Promise.all([
      db.studentProfile.findMany({
        where: { accountId: { in: accountIds }, account: { organizationId } },
        select: { accountId: true, id: true, displayName: true },
      }),
      db.product.findMany({
        where: { id: { in: productIds }, organizationId },
        select: { id: true, code: true, titleAr: true },
      }),
      db.staffProfile.findMany({
        where: { accountId: { in: reviewerIds }, account: { organizationId } },
        select: { accountId: true, displayName: true },
      }),
      db.storedObject.findMany({
        where: {
          id: {
            in: orders
              .map((order: any) => order.proofObjectId)
              .filter(Boolean) as string[],
          },
          organizationId,
        },
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          scanStatus: true,
          status: true,
        },
      }),
    ]);
    const studentMap = new Map(
      students.map((student: any) => [student.accountId, student]),
    );
    const productMap = new Map(
      products.map((product: any) => [product.id, product]),
    );
    const reviewerMap = new Map(
      reviewers.map((reviewer: any) => [reviewer.accountId, reviewer]),
    );
    const proofMap = new Map(proofs.map((proof: any) => [proof.id, proof]));
    return orders.map((order: any) => ({
      ...order,
      student: studentMap.get(order.accountId) ?? null,
      product: productMap.get(order.productId) ?? null,
      reviewer: order.reviewedBy
        ? (reviewerMap.get(order.reviewedBy) ?? null)
        : null,
      proof: order.proofObjectId
        ? (proofMap.get(order.proofObjectId) ?? null)
        : null,
    }));
  }

  async review(actor: Actor, orderId: string, input: ReviewPaymentDto) {
    const order = await db.paymentOrder.findFirst({
      where: { id: orderId, organizationId: actor.organizationId },
    });
    if (!order) throw new NotFoundException('Payment order not found');
    if (order.version !== input.version || order.status !== 'PENDING_REVIEW') {
      throw new ConflictException({
        code: 'PAYMENT_ALREADY_REVIEWED',
        message: 'This payment was already changed by another reviewer',
      });
    }
    const now = new Date();
    const reviewNote = input.note?.trim() || null;
    const result = await db.$transaction(async (tx: any) => {
      const claimed = await tx.paymentOrder.updateMany({
        where: {
          id: order.id,
          organizationId: actor.organizationId,
          status: 'PENDING_REVIEW',
          version: input.version,
        },
        data: {
          status: input.decision,
          reviewedBy: actor.id,
          reviewedAt: now,
          reviewNote,
          version: { increment: 1 },
        },
      });
      if (claimed.count !== 1) {
        throw new ConflictException({
          code: 'PAYMENT_ALREADY_REVIEWED',
          message: 'This payment was already changed by another reviewer',
        });
      }
      if (input.decision === 'APPROVED') {
        const existing = await tx.entitlement.findFirst({
          where: {
            accountId: order.accountId,
            productId: order.productId,
            status: 'ACTIVE',
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
        });
        const entitlement =
          existing ??
          (await tx.entitlement.create({
            data: {
              accountId: order.accountId,
              productId: order.productId,
              status: 'ACTIVE',
            },
          }));
        await tx.ledgerEntry.create({
          data: {
            organizationId: actor.organizationId,
            accountId: order.accountId,
            paymentOrderId: order.id,
            entitlementId: entitlement.id,
            type: existing ? 'PAYMENT_RECONCILED' : 'PAYMENT_RECEIVED',
            amountEgp: order.amountRequested,
            description:
              reviewNote ??
              (input.decision === 'APPROVED'
                ? 'تم اعتماد الدفع'
                : 'تم رفض الدفع'),
          },
        });
      }
      return tx.paymentOrder.findUnique({
        where: { id: order.id },
        include: { ledgerEntries: true },
      });
    });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: `PAYMENT_${input.decision}`,
      targetType: 'PAYMENT_ORDER',
      targetId: order.id,
      before: order,
      after: result,
      reason: reviewNote ?? undefined,
    });
    return result;
  }
}
