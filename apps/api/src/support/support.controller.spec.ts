import { SupportController } from './support.controller';
import { SupportService } from './support.service';

describe('SupportController.createTicket (tenant isolation)', () => {
  let controller: SupportController;
  let service: SupportService;

  beforeEach(() => {
    service = {
      createTicket: jest.fn(),
      getTickets: jest.fn(),
      getTicket: jest.fn(),
      replyToTicket: jest.fn(),
    };
    controller = new SupportController(service);
  });

  const req = (account: {
    id: string;
    organizationId: string;
    kind: string;
  }) => ({ account });

  it('creates a ticket using the authenticated student organization', async () => {
    (service.createTicket as jest.Mock).mockResolvedValue({ id: 't-1' });

    await controller.createTicket(
      req({ id: 's-1', organizationId: 'org-x', kind: 'STUDENT' }),
      {
        subject: 'Hello',
        description: 'Help',
      },
    );

    expect(service.createTicket).toHaveBeenCalledWith(
      's-1',
      'org-x',
      'Hello',
      'Help',
    );
  });

  it('ignores a supplied organizationId that matches the account (no client override)', async () => {
    (service.createTicket as jest.Mock).mockResolvedValue({ id: 't-1' });

    await controller.createTicket(
      req({ id: 's-1', organizationId: 'org-x', kind: 'STUDENT' }),
      {
        subject: 'Hello',
        description: 'Help',
        organizationId: 'org-x',
      } as any,
    );

    expect(service.createTicket).toHaveBeenCalledWith(
      's-1',
      'org-x',
      'Hello',
      'Help',
    );
  });

  it('does not create a ticket in another student-supplied organization', async () => {
    (service.createTicket as jest.Mock).mockResolvedValue({ id: 't-1' });

    await controller.createTicket(
      req({ id: 's-1', organizationId: 'org-x', kind: 'STUDENT' }),
      {
        subject: 'Hello',
        description: 'Help',
        organizationId: 'org-evil',
      } as any,
    );

    // The call must use the authenticated account org, never the spoofed one.
    expect(service.createTicket).toHaveBeenCalledTimes(1);
    expect(service.createTicket).toHaveBeenCalledWith(
      's-1',
      'org-x',
      'Hello',
      'Help',
    );
    expect(service.createTicket).not.toHaveBeenCalledWith(
      expect.anything(),
      'org-evil',
      expect.anything(),
      expect.anything(),
    );
  });
});
