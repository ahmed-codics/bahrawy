import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import DeviceLocksPage from '../app/dashboard/device-locks/page';
import { fetchApi } from '../lib/api';

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { error: jest.fn(), success: jest.fn() },
}));

jest.mock('../lib/api', () => ({
  fetchApi: jest.fn(),
}));

const mockedFetchApi = jest.mocked(fetchApi);

const blockRow = {
  accountId: 'student-1',
  studentNumber: 10200,
  displayName: 'أحمد محمد',
  gradeId: 'grade-1',
  gradeName: 'الصف الثالث الثانوي',
  accountStatus: 'DEVICE_BLOCKED',
  version: 2,
  createdAt: '2026-08-01T10:00:00Z',
  primaryDevice: {
    id: 'dev-primary',
    label: 'Chrome / Mac',
    fingerprint: 'primary-…3456',
    lastUsedAt: '2026-08-01T09:00:00Z',
  },
  blockedAt: '2026-08-01T10:00:00Z',
  blockReason: 'UNKNOWN_DEVICE',
  ipAddress: '10.0.0.5',
  userAgent: 'Mozilla/5.0 (Macintosh)',
  previousStatus: 'ACTIVE',
  attemptCount: 2,
  attemptedDevice: {
    fingerprint: 'unknown-…cdef',
    reason: 'UNKNOWN_DEVICE',
    blockedAt: '2026-08-01T10:00:00Z',
  },
};

describe('DeviceLocksPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFetchApi.mockResolvedValue({
      data: {
        items: [blockRow],
        meta: { page: 1, pageSize: 25, total: 1, pageCount: 1 },
        grades: [{ id: 'grade-1', nameAr: 'الصف الثالث الثانوي' }],
      },
    });
  });

  it('renders blocked students with forensic columns and filters', async () => {
    render(<DeviceLocksPage />);

    expect(await screen.findByText('أحمد محمد')).toBeInTheDocument();
    expect(screen.getAllByText('الصف الثالث الثانوي').length).toBeGreaterThan(0);
    expect(screen.getByText('10.0.0.5')).toBeInTheDocument();
    expect(screen.getByText(/Mozilla\/5.0/)).toBeInTheDocument();
    expect(screen.getAllByText('جهاز غير معروف').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);

    expect(screen.getByLabelText('تصفية بالسبب')).toBeInTheDocument();
    expect(screen.getByLabelText('تصفية بالحالة')).toBeInTheDocument();
    expect(screen.getByLabelText('تصفية بالمرحلة الدراسية')).toBeInTheDocument();
    expect(screen.getByLabelText('تاريخ الإيقاف من')).toBeInTheDocument();
    expect(screen.getByLabelText('تاريخ الإيقاف إلى')).toBeInTheDocument();
  });

  it('sends reason, status and date filters to the API', async () => {
    render(<DeviceLocksPage />);
    await screen.findByText('أحمد محمد');

    fireEvent.change(screen.getByLabelText('تصفية بالسبب'), {
      target: { value: 'SESSION_DEVICE_MISMATCH' },
    });
    fireEvent.change(screen.getByLabelText('تصفية بالحالة'), {
      target: { value: 'DEVICE_BLOCKED' },
    });
    fireEvent.change(screen.getByLabelText('تاريخ الإيقاف من'), {
      target: { value: '2026-08-01' },
    });

    await waitFor(() => {
      expect(mockedFetchApi).toHaveBeenLastCalledWith(
        expect.stringMatching(
          /reason=SESSION_DEVICE_MISMATCH&status=DEVICE_BLOCKED&blockedFrom=2026-08-01/,
        ),
      );
    });
  });

  it('unlocks a student account and reloads the list', async () => {
    render(<DeviceLocksPage />);
    await screen.findByText('أحمد محمد');

    fireEvent.click(screen.getByRole('button', { name: /فتح الحساب/ }));
    expect(await screen.findByText('فتح حساب الطالب')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /نعم، فتح الحساب/ }));

    await waitFor(() =>
      expect(mockedFetchApi).toHaveBeenCalledWith(
        '/admin/v1/device-locks/student-1/unlock',
        { method: 'POST' },
      ),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('تم فتح حساب الطالب'),
    );
  });
});