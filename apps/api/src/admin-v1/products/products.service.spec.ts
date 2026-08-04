import { db } from '@bahrawy/db';
import { AdminV1ProductsService } from './products.service';

jest.mock('@bahrawy/db', () => ({
  db: {
    product: { findFirst: jest.fn() },
    paymentOrder: { count: jest.fn() },
  },
}));

describe('AdminV1ProductsService lifecycle', () => {
  const service = new AdminV1ProductsService({
    logEvent: jest.fn(),
  } as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows permanent deletion of an unused published bundle', async () => {
    (db.product.findFirst as jest.Mock).mockResolvedValue({
      id: 'product-1',
      titleAr: 'باقة تجريبية',
      status: 'PUBLISHED',
      _count: {
        entitlements: 0,
        courses: 2,
        unitEntries: 0,
      },
    });
    (db.paymentOrder.count as jest.Mock).mockResolvedValue(0);

    const impact = await service.deletionImpact('org-1', 'product-1');

    expect(impact.actions).toEqual(['ARCHIVE', 'PERMANENT_DELETE']);
    expect(impact.blockers).toEqual([]);
    expect(impact.requiresTypedConfirmation).toBe(true);
  });
});
