import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from '../storage/storage.service';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { PaymentService, PaymentReviewDecision } from './payment.service';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermission } from '../rbac/permissions.decorator';
import { db } from '@bahrawy/db';
import { StaffPermission } from '@bahrawy/types';

@Controller('payments')
@UseGuards(SessionAuthGuard)
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly storageService: StorageService,
  ) {}

  @Post('order')
  async createOrder(
    @Req() req: any,
    @Body()
    body: {
      productId: string;
      priceId: string;
      referenceNumber: string;
      idempotencyKey: string;
    },
  ) {
    const product = await db.product.findFirst({
      where: {
        id: body.productId,
        organizationId: req.account.organizationId,
        status: { in: ['ACTIVE', 'PUBLISHED'] },
      },
      include: {
        prices: {
          where: { id: body.priceId, status: 'ACTIVE' },
          take: 1,
        },
      },
    });
    const price = product?.prices[0];
    if (!product || !price) {
      throw new BadRequestException('Product or active price not found');
    }
    const data = await this.paymentService.submitPaymentOrder({
      organizationId: product.organizationId,
      accountId: req.account.id,
      productId: product.id,
      priceId: price.id,
      amountRequested: Number(price.amount),
      referenceNumber: body.referenceNumber,
      idempotencyKey: body.idempotencyKey,
    });
    return { status: 'SUCCESS', data };
  }

  @Post('proof')
  @UseInterceptors(FileInterceptor('file'))
  async submitProof(
    @Req() req: any,
    @Body('orderId') orderId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    if (!orderId) {
      throw new BadRequestException('orderId is required');
    }
    const order = await db.paymentOrder.findFirst({
      where: { id: orderId, accountId: req.account.id },
    });
    if (!order) {
      throw new NotFoundException('Payment order not found');
    }

    const uploadDir = path.join(process.cwd(), '.uploads', 'receipts');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const objectKey = `${randomUUID()}-${file.originalname}`;
    const filePath = path.join(uploadDir, objectKey);
    fs.writeFileSync(filePath, file.buffer);

    try {
      // Register with StorageService
      const storedObj = await this.storageService.registerUpload({
        organizationId: order.organizationId,
        uploadedBy: req.account.id,
        bucket: 'payment-proofs',
        objectKey,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      });

      // Mark it as CLEAN automatically for local dev
      await this.storageService.markScanResult(storedObj.id, 'CLEAN');

      // Update the payment order with proofObjectId
      await this.paymentService.attachProof(
        orderId,
        storedObj.id,
        req.account.id,
      );

      return {
        status: 'SUCCESS',
        message: 'Proof attached',
        proofObjectId: storedObj.id,
      };
    } catch (error) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        /* ignore */
      }
      throw error;
    }
  }

  @Get('history')
  async getPaymentHistory(@Req() req: any) {
    const data = await this.paymentService.getPaymentHistory(req.account.id);
    return { status: 'SUCCESS', data };
  }

  @Get('staff/queue')
  @UseGuards(PermissionsGuard)
  @RequirePermission(StaffPermission.PAYMENT_MANAGE)
  async getPendingQueue() {
    const data = await this.paymentService.getPendingQueue();
    return { status: 'SUCCESS', data };
  }

  @Post('staff/review')
  @UseGuards(PermissionsGuard)
  @RequirePermission(StaffPermission.PAYMENT_MANAGE)
  async reviewPayment(
    @Req() req: any,
    @Body()
    body: {
      orderId: string;
      decision: PaymentReviewDecision;
      note?: string;
    },
  ) {
    await this.paymentService.reviewPaymentOrder({
      orderId: body.orderId,
      reviewerAccountId: req.account.id,
      decision: body.decision,
      note: body.note,
    });
    return { status: 'SUCCESS' };
  }
}

@Controller('payment')
@UseGuards(SessionAuthGuard)
export class PaymentPlanController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly storageService: StorageService,
  ) {}

  @Post('initiate')
  async initiatePayment(
    @Req() req: any,
    @Body()
    body: { productId: string; priceId?: string; referenceNumber: string },
  ) {
    const product = await db.product.findUnique({
      where: { id: body.productId },
      include: { prices: { where: { status: 'ACTIVE' }, take: 1 } },
    });
    const price = body.priceId
      ? await db.price.findUnique({ where: { id: body.priceId } })
      : product?.prices[0];
    if (!product || !price) {
      throw new BadRequestException('Product or price not found');
    }

    const order = await this.paymentService.submitPaymentOrder({
      organizationId: product.organizationId,
      accountId: req.account.id,
      productId: product.id,
      priceId: price.id,
      amountRequested: Number(price.amount),
      referenceNumber: body.referenceNumber,
      idempotencyKey: `${req.account.id}:${product.id}:${price.id}:${Date.now()}`,
    });

    return {
      status: 'SUCCESS',
      data: {
        order,
        uploadProofUrl: `/payment/orders/${order.id}/proof`,
      },
    };
  }

  @Post('orders')
  async createOrder(@Req() req: any, @Body() body: any) {
    const product = await db.product.findUnique({
      where: { id: body.productId },
      include: { prices: { where: { status: 'ACTIVE' }, take: 1 } },
    });
    const price = body.priceId
      ? await db.price.findUnique({ where: { id: body.priceId } })
      : product?.prices[0];
    if (!product || !price) {
      throw new BadRequestException('Product or price not found');
    }

    const data = await this.paymentService.submitPaymentOrder({
      organizationId: product.organizationId,
      accountId: req.account.id,
      productId: product.id,
      priceId: price.id,
      amountRequested: Number(body.amountRequested ?? price.amount),
      referenceNumber: body.referenceNumber,
      idempotencyKey:
        body.idempotencyKey ?? `${req.account.id}:${product.id}:${Date.now()}`,
    });
    return { status: 'SUCCESS', data };
  }

  @Post('orders/:orderId/proof')
  @UseInterceptors(FileInterceptor('file'))
  async uploadProof(
    @Req() req: any,
    @Param('orderId') orderId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const order = await db.paymentOrder.findUnique({ where: { id: orderId } });
    if (!order || order.accountId !== req.account.id) {
      throw new NotFoundException('Payment order not found');
    }
    if (!file) {
      throw new BadRequestException('File is required');
    }

    this.storageService.validateMimeAndSize(
      file.mimetype,
      file.size,
      file.originalname,
    );

    const uploadDir = path.join(process.cwd(), '.uploads', 'receipts');
    fs.mkdirSync(uploadDir, { recursive: true });
    const objectKey = `${randomUUID()}-${file.originalname}`;
    const filePath = path.join(uploadDir, objectKey);
    fs.writeFileSync(filePath, file.buffer);

    try {
      const storedObj = await this.storageService.registerUpload({
        organizationId: order.organizationId,
        uploadedBy: req.account.id,
        bucket: 'payment-proofs',
        objectKey,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        sha256: this.storageService.computeSha256(file.buffer),
      });
      await this.paymentService.attachProof(
        order.id,
        storedObj.id,
        req.account.id,
      );

      return { status: 'SUCCESS', data: { storedObjectId: storedObj.id } };
    } catch (error) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        /* ignore */
      }
      throw error;
    }
  }

  @Get('orders')
  async listOwnOrders(@Req() req: any) {
    const data = await this.paymentService.getPaymentHistory(req.account.id);
    return { status: 'SUCCESS', data };
  }

  @Get('orders/:orderId')
  async getOwnOrder(@Req() req: any, @Param('orderId') orderId: string) {
    const order = await db.paymentOrder.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Payment order not found');
    }
    if (req.account.kind !== 'STAFF' && order.accountId !== req.account.id) {
      throw new ForbiddenException('You do not own this payment order');
    }
    return { status: 'SUCCESS', data: order };
  }

  @Get('staff/pending')
  @UseGuards(PermissionsGuard)
  @RequirePermission(StaffPermission.PAYMENT_MANAGE)
  async getPendingQueue() {
    const data = await this.paymentService.getPendingQueue();
    return { status: 'SUCCESS', data };
  }

  @Post('staff/orders/:orderId/approve')
  @UseGuards(PermissionsGuard)
  @RequirePermission(StaffPermission.PAYMENT_MANAGE)
  async approvePayment(@Req() req: any, @Param('orderId') orderId: string) {
    await this.paymentService.reviewPaymentOrder({
      orderId,
      reviewerAccountId: req.account.id,
      decision: 'APPROVED',
    });
    return { status: 'SUCCESS' };
  }

  @Post('staff/orders/:orderId/reject')
  @UseGuards(PermissionsGuard)
  @RequirePermission(StaffPermission.PAYMENT_MANAGE)
  async rejectPayment(
    @Req() req: any,
    @Param('orderId') orderId: string,
    @Body() body: { reason?: string },
  ) {
    await this.paymentService.reviewPaymentOrder({
      orderId,
      reviewerAccountId: req.account.id,
      decision: 'REJECTED',
      note: body.reason,
    });
    return { status: 'SUCCESS' };
  }
}
