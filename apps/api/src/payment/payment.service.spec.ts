import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { db } from '@bahrawy/db';
import { BadRequestException, ConflictException } from '@nestjs/common';

jest.mock('@bahrawy/db', () => {
  const mockDbClient: any = {
    paymentOrder: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    entitlement: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    ledgerEntry: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  return { db: mockDbClient };
});

const BASE_PARAMS = {
  organizationId: 'org-1',
  accountId: 'acc-1',
  productId: 'prod-1',
  priceId: 'price-1',
  amountRequested: 500,
  referenceNumber: 'REF-123456',
  idempotencyKey: 'idem-abc',
};

describe('PaymentService', () => {
  let service: PaymentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PaymentService],
    }).compile();
    service = module.get<PaymentService>(PaymentService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('submitPaymentOrder', () => {
    it('should return existing order for duplicate idempotency key', async () => {
      (db.paymentOrder.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-existing',
        status: 'PENDING_REVIEW',
      });
      const result = await service.submitPaymentOrder(BASE_PARAMS);
      expect(result).toEqual({
        id: 'order-existing',
        status: 'PENDING_REVIEW',
      });
      expect(db.paymentOrder.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if account already has entitlement', async () => {
      (db.paymentOrder.findUnique as jest.Mock).mockResolvedValue(null);
      (db.entitlement.findFirst as jest.Mock).mockResolvedValue({
        id: 'ent-1',
      });
      await expect(service.submitPaymentOrder(BASE_PARAMS)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should create a new payment order when no existing order or entitlement', async () => {
      (db.paymentOrder.findUnique as jest.Mock).mockResolvedValue(null);
      (db.entitlement.findFirst as jest.Mock).mockResolvedValue(null);
      (db.paymentOrder.create as jest.Mock).mockResolvedValue({
        id: 'order-new',
        status: 'PENDING_REVIEW',
      });
      const result = await service.submitPaymentOrder(BASE_PARAMS);
      expect(result.id).toBe('order-new');
      expect(db.paymentOrder.create).toHaveBeenCalled();
    });
  });

  describe('reviewPaymentOrder', () => {
    it('should throw BadRequestException if order not found', async () => {
      (db.paymentOrder.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        service.reviewPaymentOrder({
          orderId: 'bad-id',
          reviewerAccountId: 'staff-1',
          decision: 'APPROVED',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if order already reviewed', async () => {
      (db.paymentOrder.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-1',
        status: 'APPROVED',
      });
      await expect(
        service.reviewPaymentOrder({
          orderId: 'order-1',
          reviewerAccountId: 'staff-1',
          decision: 'APPROVED',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should call $transaction on approval', async () => {
      (db.paymentOrder.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-1',
        status: 'PENDING_REVIEW',
        accountId: 'acc-1',
        productId: 'prod-1',
        organizationId: 'org-1',
        amountRequested: 500,
      });
      (db.$transaction as jest.Mock).mockResolvedValue(undefined);
      await service.reviewPaymentOrder({
        orderId: 'order-1',
        reviewerAccountId: 'staff-1',
        decision: 'APPROVED',
      });
      expect(db.$transaction).toHaveBeenCalled();
    });

    it('should update order status to REJECTED without transaction', async () => {
      (db.paymentOrder.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-1',
        status: 'PENDING_REVIEW',
        accountId: 'acc-1',
        productId: 'prod-1',
        organizationId: 'org-1',
        amountRequested: 500,
      });
      (db.paymentOrder.update as jest.Mock).mockResolvedValue({});
      await service.reviewPaymentOrder({
        orderId: 'order-1',
        reviewerAccountId: 'staff-1',
        decision: 'REJECTED',
        note: 'Unclear proof',
      });
      expect(db.paymentOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'REJECTED' }),
        }),
      );
      expect(db.$transaction).not.toHaveBeenCalled();
    });
  });
});
