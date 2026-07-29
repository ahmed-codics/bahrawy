import { AdminAuditService } from './audit.service';

describe('AdminAuditService', () => {
  let service: AdminAuditService;

  beforeEach(() => {
    service = new AdminAuditService();
  });

  it('redacts exact secret fields without destroying business codes', () => {
    expect(
      service.redactSensitive({
        code: 'ENG-2',
        password: 'secret',
        nested: {
          activationCode: '123456',
          courseCode: 'ENG-2',
        },
      }),
    ).toEqual({
      code: 'ENG-2',
      password: '[REDACTED]',
      nested: {
        activationCode: '[REDACTED]',
        courseCode: 'ENG-2',
      },
    });
  });

  it('normalizes database values before storing audit JSON', () => {
    const decimalLike = {
      toJSON: () => '100.00',
      constructor: () => undefined,
    };

    expect(
      service.redactSensitive({
        amount: decimalLike,
        reviewedAt: new Date('2026-07-21T00:00:00.000Z'),
        bytes: 42n,
      }),
    ).toEqual({
      amount: '100.00',
      reviewedAt: '2026-07-21T00:00:00.000Z',
      bytes: '42',
    });
  });

  it.each([
    ['password', 'password'],
    ['oldPassword', 'oldPassword'],
    ['oldPasswordAr', 'oldPasswordAr'],
    ['newPassword', 'newPassword'],
    ['newPasswordAr', 'newPasswordAr'],
    ['temporaryPassword', 'temporaryPassword'],
    ['plainCredential', 'plainCredential'],
    ['credentialCode', 'credentialCode'],
    ['activationCode', 'activationCode'],
    ['resetCode', 'resetCode'],
    ['phone', 'phone'],
    ['totpToken', 'totpToken'],
  ])('redacts %s', (_label, key) => {
    expect(service.redactSensitive({ [key]: 'sensitive-value' })).toEqual({
      [key]: '[REDACTED]',
    });
  });

  it('redacts nested sensitive fields in objects', () => {
    const original = {
      user: {
        password: 'secret123',
        phone: '01012345678',
        displayName: 'Ahmed',
      },
    };

    const redacted = service.redactSensitive(original) as any;

    expect(redacted.user.password).toBe('[REDACTED]');
    expect(redacted.user.phone).toBe('[REDACTED]');
    expect(redacted.user.displayName).toBe('Ahmed');
  });

  it('redacts sensitive fields inside arrays of objects', () => {
    const original = {
      accounts: [
        {
          temporaryPassword: 'abc',
          plainCredential: 'xyz',
          displayName: 'User1',
        },
        {
          temporaryPassword: 'def',
          plainCredential: 'uvw',
          displayName: 'User2',
        },
      ],
    };

    const redacted = service.redactSensitive(original) as any;

    expect(redacted.accounts[0].temporaryPassword).toBe('[REDACTED]');
    expect(redacted.accounts[0].plainCredential).toBe('[REDACTED]');
    expect(redacted.accounts[0].displayName).toBe('User1');
    expect(redacted.accounts[1].temporaryPassword).toBe('[REDACTED]');
    expect(redacted.accounts[1].plainCredential).toBe('[REDACTED]');
    expect(redacted.accounts[1].displayName).toBe('User2');
  });

  it('preserves non-sensitive fields unchanged', () => {
    const original = {
      id: 'abc-123',
      displayName: 'Ahmed',
      kind: 'STAFF',
      status: 'ACTIVE',
    };

    expect(service.redactSensitive(original)).toEqual(original);
  });

  it('never mutates the original object', () => {
    const original = {
      password: 'secret',
      nested: {
        phone: '01012345678',
      },
    };

    const frozen = JSON.parse(JSON.stringify(original));

    const redacted = service.redactSensitive(original) as any;

    expect(original).toEqual(frozen);
    expect(original.password).toBe('secret');
    expect(original.nested.phone).toBe('01012345678');
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.nested.phone).toBe('[REDACTED]');
  });
});
