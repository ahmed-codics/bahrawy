import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { StorageService } from '../storage/storage.service';
import { db } from '@bahrawy/db';

jest.mock('@bahrawy/db', () => ({
  db: {
    product: {
      findFirst: jest.fn(),
    },
  },
}));

describe('PaymentController createOrder', () => {
  let paymentServiceMock: { submitPaymentOrder: jest.Mock };
  let controller: PaymentController;

  beforeEach(() => {
    paymentServiceMock = {
      submitPaymentOrder: jest.fn().mockResolvedValue({
        id: 'order-1',
        status: 'PENDING_REVIEW',
      }),
    };
    controller = new PaymentController(
      paymentServiceMock as unknown as PaymentService,
      {} as StorageService,
    );
    jest.clearAllMocks();
  });

  it('bills the amount stored on the active DB price, ignoring any client hint', async () => {
    (db.product.findFirst as jest.Mock).mockResolvedValue({
      id: 'prod-1',
      organizationId: 'org-1',
      status: 'ACTIVE',
      prices: [{ id: 'price-1', amount: 200, status: 'ACTIVE' }],
    });

    const result = await controller.createOrder(
      { account: { id: 'acc-1', organizationId: 'org-1' } } as any,
      {
        productId: 'prod-1',
        priceId: 'price-1',
        referenceNumber: 'REF-123',
        idempotencyKey: 'idem-1',
      },
    );

    expect(paymentServiceMock.submitPaymentOrder).toHaveBeenCalledWith(
      expect.objectContaining({ amountRequested: 200, priceId: 'price-1' }),
    );
    expect(result.status).toBe('SUCCESS');
  });

  it('rejects unknown products and inactive prices before any order is created', async () => {
    (db.product.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      controller.createOrder(
        { account: { id: 'acc-1', organizationId: 'org-1' } } as any,
        {
          productId: 'nope',
          priceId: 'price-1',
          referenceNumber: 'REF-123',
          idempotencyKey: 'idem-2',
        },
      ),
    ).rejects.toThrow('Product or active price not found');

    expect(paymentServiceMock.submitPaymentOrder).not.toHaveBeenCalled();
  });
});
