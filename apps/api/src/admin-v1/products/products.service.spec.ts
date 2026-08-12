import { BadRequestException } from '@nestjs/common';
import { AdminV1ProductsService } from './products.service';
import { AdminAuditService } from '../common/services/audit.service';

describe('AdminV1ProductsService resolveOriginalAmount', () => {
  const service = new AdminV1ProductsService({} as AdminAuditService);
  const resolve = (
    service as unknown as {
      resolveOriginalAmount: (
        finalAmount?: number,
        originalAmount?: number,
      ) => number | null;
    }
  ).resolveOriginalAmount;

  it('returns null when no original price is provided', () => {
    expect(resolve(200, undefined)).toBeNull();
    expect(resolve(undefined, 300)).toBeNull();
    expect(resolve(undefined, undefined)).toBeNull();
  });

  it('stores the original price when it is strictly greater than final', () => {
    expect(resolve(200, 300)).toBe(300);
    expect(resolve(150.5, 200)).toBe(200);
  });

  it('drops the discount when original equals final (no discount)', () => {
    expect(resolve(200, 200)).toBeNull();
    expect(resolve(0, 0)).toBeNull();
  });

  it('throws when original is below final', () => {
    expect(() => resolve(300, 200)).toThrow(BadRequestException);
    try {
      resolve(300, 200);
    } catch (caught) {
      const err = caught as BadRequestException;
      expect(err.getResponse()).toMatchObject({ code: 'ORIGINAL_BELOW_FINAL' });
    }
  });

  it('does not treat zero final with a positive original as an error (free item)', () => {
    expect(resolve(0, 200)).toBe(200);
  });
});
