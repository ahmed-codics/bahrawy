import { ConflictException } from '@nestjs/common';
import { db } from '@bahrawy/db';
import { AdminAuditService } from '../common/services/audit.service';
import { AdminV1PaymentsService } from './payments.service';

jest.mock('@bahrawy/db', () => ({
  db: {
    paymentOrder: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    studentProfile: { findMany: jest.fn() },
    product: { findMany: jest.fn() },
    staffProfile: { findMany: jest.fn() },
    storedObject: { findMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));

describe('AdminV1PaymentsService', () => {
  const audit = { logEvent: jest.fn() };
  const service = new AdminV1PaymentsService(
    audit as unknown as AdminAuditService,
  );
  const actor = { id: 'staff-1', organizationId: 'org-1' };
  const order = {
    id: 'order-1',
    organizationId: 'org-1',
    accountId: 'student-1',
    productId: 'product-1',
    amountRequested: 100,
    status: 'PENDING_REVIEW',
    version: 1,
  };

  beforeEach(() => jest.clearAllMocks());

  it('rejects a stale or already-reviewed order before opening a transaction', async () => {
    (db.paymentOrder.findFirst as jest.Mock).mockResolvedValue({
      ...order,
      status: 'APPROVED',
      version: 2,
    });

    await expect(
      service.review(actor, order.id, {
        decision: 'APPROVED',
        note: 'Receipt verified',
        version: 1,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('fails safely when another reviewer claims the order first', async () => {
    (db.paymentOrder.findFirst as jest.Mock).mockResolvedValue(order);
    const tx = {
      paymentOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      entitlement: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      ledgerEntry: { create: jest.fn() },
    };
    (db.$transaction as jest.Mock).mockImplementation(
      (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    await expect(
      service.review(actor, order.id, {
        decision: 'APPROVED',
        note: 'Receipt verified',
        version: 1,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.entitlement.create).not.toHaveBeenCalled();
    expect(tx.ledgerEntry.create).not.toHaveBeenCalled();
  });

  it('approves a payment without requiring a review note', async () => {
    (db.paymentOrder.findFirst as jest.Mock).mockResolvedValue(order);
    const approvedOrder = { ...order, status: 'APPROVED', version: 2 };
    const tx = {
      paymentOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue(approvedOrder),
      },
      entitlement: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'entitlement-1' }),
      },
      ledgerEntry: { create: jest.fn().mockResolvedValue({ id: 'ledger-1' }) },
    };
    (db.$transaction as jest.Mock).mockImplementation(
      (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    await expect(
      service.review(actor, order.id, {
        decision: 'APPROVED',
        version: 1,
      }),
    ).resolves.toEqual(approvedOrder);

    expect(tx.paymentOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reviewNote: null }),
      }),
    );
    expect(tx.ledgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ description: 'تم اعتماد الدفع' }),
    });
    expect(audit.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ reason: undefined }),
    );
  });
});
