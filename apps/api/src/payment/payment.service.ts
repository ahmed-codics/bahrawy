import {
  Injectable,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { db } from '@bahrawy/db';

export type PaymentReviewDecision = 'APPROVED' | 'REJECTED';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  /**
   * Student submits a manual payment order with an idempotency key so double-submission
   * is safe — returns the existing record rather than creating a duplicate.
   */
  async submitPaymentOrder(params: {
    organizationId: string;
    accountId: string;
    productId: string;
    priceId: string;
    amountRequested: number;
    referenceNumber: string;
    proofObjectId?: string;
    idempotencyKey: string;
  }): Promise<{ id: string; status: string }> {
    if (!params.referenceNumber?.trim()) {
      throw new BadRequestException('Payment reference number is required.');
    }
    // Idempotency: return existing order for same key
    const existing = await db.paymentOrder.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
    });
    if (existing) {
      return { id: existing.id, status: existing.status };
    }

    // Reject if student already holds an active entitlement for this product
    const now = new Date();
    const activeEntitlement = await db.entitlement.findFirst({
      where: {
        accountId: params.accountId,
        productId: params.productId,
        status: 'ACTIVE',
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });
    if (activeEntitlement) {
      throw new ConflictException({
        code: 'ALREADY_ENTITLED',
        message:
          'Account already holds an active entitlement for this product.',
      });
    }

    const order = await db.paymentOrder.create({
      data: {
        organizationId: params.organizationId,
        accountId: params.accountId,
        productId: params.productId,
        priceId: params.priceId,
        amountRequested: params.amountRequested,
        referenceNumber: params.referenceNumber.trim(),
        currency: 'EGP',
        proofObjectId: params.proofObjectId ?? null,
        idempotencyKey: params.idempotencyKey,
        status: 'PENDING_REVIEW',
      },
    });

    this.logger.log(
      `Payment order ${order.id} submitted by account ${params.accountId}`,
    );
    return { id: order.id, status: order.status };
  }

  async attachProof(
    orderId: string,
    proofObjectId: string,
    accountId: string,
  ): Promise<void> {
    const order = await db.paymentOrder.findUnique({ where: { id: orderId } });
    if (!order || order.accountId !== accountId) {
      throw new BadRequestException('Payment order not found.');
    }
    await db.paymentOrder.update({
      where: { id: orderId },
      data: { proofObjectId },
    });
    this.logger.log(`Proof ${proofObjectId} attached to order ${orderId}`);
  }

  /**
   * Finance staff approve or reject a pending payment order.
   * On approval: atomically write ledger entry + create entitlement + update order status.
   */
  async reviewPaymentOrder(params: {
    orderId: string;
    reviewerAccountId: string;
    decision: PaymentReviewDecision;
    note?: string;
  }): Promise<void> {
    const order = await db.paymentOrder.findUnique({
      where: { id: params.orderId },
    });
    if (!order) {
      throw new BadRequestException({
        code: 'ORDER_NOT_FOUND',
        message: 'Payment order not found.',
      });
    }
    if (order.status !== 'PENDING_REVIEW') {
      throw new ConflictException({
        code: 'ORDER_ALREADY_REVIEWED',
        message: `Order is already in status '${order.status}'.`,
      });
    }

    const now = new Date();

    if (params.decision === 'APPROVED') {
      // Atomic: update order + create ledger entry + create entitlement
      await db.$transaction(async (tx: typeof db) => {
        await tx.paymentOrder.update({
          where: { id: order.id },
          data: {
            status: 'APPROVED',
            reviewedBy: params.reviewerAccountId,
            reviewedAt: now,
            reviewNote: params.note ?? null,
          },
        });

        const entitlement = await tx.entitlement.create({
          data: {
            accountId: order.accountId,
            productId: order.productId,
            status: 'ACTIVE',
          },
        });

        await tx.ledgerEntry.create({
          data: {
            organizationId: order.organizationId,
            accountId: order.accountId,
            paymentOrderId: order.id,
            entitlementId: entitlement.id,
            type: 'PAYMENT_RECEIVED',
            amountEgp: order.amountRequested,
            description: `Manual payment approved for product ${order.productId}`,
          },
        });
      });

      this.logger.log(
        `Order ${order.id} APPROVED — entitlement granted to ${order.accountId}`,
      );
    } else {
      await db.paymentOrder.update({
        where: { id: order.id },
        data: {
          status: 'REJECTED',
          reviewedBy: params.reviewerAccountId,
          reviewedAt: now,
          reviewNote: params.note ?? null,
        },
      });
      this.logger.log(
        `Order ${order.id} REJECTED by ${params.reviewerAccountId}`,
      );
    }
  }

  async getPaymentHistory(accountId: string): Promise<any[]> {
    return db.paymentOrder.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPendingQueue(): Promise<any[]> {
    const orders = await db.paymentOrder.findMany({
      where: { status: 'PENDING_REVIEW' },
      orderBy: { createdAt: 'asc' },
    });

    const accounts = await db.account.findMany({
      where: { id: { in: orders.map((order: any) => order.accountId) } },
      select: {
        id: true,
        kind: true,
        phoneEncrypted: true,
        studentProfile: { select: { displayName: true } },
      },
    });
    const accountMap = new Map(
      accounts.map((account: any) => [account.id, account]),
    );

    const products = await db.product.findMany({
      where: { id: { in: orders.map((order: any) => order.productId) } },
      select: { id: true, titleAr: true, titleEn: true },
    });
    const productMap = new Map(
      products.map((product: any) => [product.id, product]),
    );

    return orders.map((order: any) => ({
      ...order,
      account: accountMap.get(order.accountId) || null,
      product: productMap.get(order.productId) || null,
    }));
  }
}
