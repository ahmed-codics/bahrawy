import { SupportService } from './support.service';
import { db } from '@bahrawy/db';
import { NotFoundException } from '@nestjs/common';

jest.mock('@bahrawy/db', () => {
  const mockDbClient: any = {
    supportTicket: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  return { db: mockDbClient };
});

describe('SupportService (cross-tenant/student access)', () => {
  let service: SupportService;

  beforeEach(() => {
    service = new SupportService();
  });

  afterEach(() => jest.clearAllMocks());

  it('allows a student to read their own ticket', async () => {
    (db.supportTicket.findUnique as jest.Mock).mockResolvedValue({
      id: 't-1',
      accountId: 's-1',
      organizationId: 'org-x',
    });

    await expect(service.getTicket('t-1', 's-1', false)).resolves.toEqual(
      expect.objectContaining({ id: 't-1', accountId: 's-1' }),
    );
  });

  it('denies a student reading another student ticket (different org too)', async () => {
    (db.supportTicket.findUnique as jest.Mock).mockResolvedValue({
      id: 't-1',
      accountId: 's-other',
      organizationId: 'org-x',
    });

    await expect(service.getTicket('t-1', 's-1', false)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws NotFound when a non-staff account reads an unknown ticket', async () => {
    (db.supportTicket.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.getTicket('t-unknown', 's-1', false)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('preserves staff cross-organization read access', async () => {
    (db.supportTicket.findUnique as jest.Mock).mockResolvedValue({
      id: 't-1',
      accountId: 's-other',
      organizationId: 'org-y',
    });

    await expect(service.getTicket('t-1', 'staff-1', true)).resolves.toEqual(
      expect.objectContaining({ id: 't-1' }),
    );
  });
});
