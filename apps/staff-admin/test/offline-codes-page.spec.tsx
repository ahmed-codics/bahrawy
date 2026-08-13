import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import OfflineCodesPage from '../app/dashboard/offline-codes/page';
import { fetchApi } from '../lib/api';

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { error: jest.fn(), success: jest.fn() },
}));

jest.mock('../lib/api', () => ({
  fetchApi: jest.fn(),
}));

const mockedFetchApi = jest.mocked(fetchApi);

const codeRow = {
  id: 'code-1',
  code: 'ABCD-****-****',
  status: 'ACTIVE',
  courseId: 'course-1',
  gradeId: 'grade-1',
  batchId: 'batch-1',
  maxUses: 1,
  useCount: 0,
  expiresAt: null,
  activatedAt: null,
  createdAt: '2026-08-01T10:00:00Z',
  student: null,
  course: { id: 'course-1', titleAr: 'كورس الأوفلاين' },
  grade: { id: 'grade-1', nameAr: 'الصف الثالث الثانوي' },
};

const batchRow = {
  id: 'batch-1',
  quantity: 2,
  usedCount: 1,
  maxUses: 1,
  expiresAt: null,
  createdAt: '2026-08-01T10:00:00Z',
  course: { id: 'course-1', titleAr: 'كورس الأوفلاين' },
  grade: { id: 'grade-1', nameAr: 'الصف الثالث الثانوي' },
};

function coursesResponse() {
  return { data: { items: [{ id: 'course-1', titleAr: 'كورس الأوفلاين' }] } };
}
function academicResponse() {
  return {
    data: { grades: [{ id: 'grade-1', nameAr: 'الصف الثالث الثانوي' }] },
  };
}

describe('OfflineCodesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFetchApi.mockImplementation((endpoint: string) => {
      if (endpoint.startsWith('/admin/v1/offline-codes?')) {
        return Promise.resolve({
          data: {
            items: [codeRow],
            total: 1,
            page: 1,
            pageSize: 25,
            totalPages: 1,
          },
        });
      }
      if (endpoint.includes('/admin/v1/courses')) {
        return Promise.resolve(coursesResponse());
      }
      if (endpoint.includes('/admin/v1/academic')) {
        return Promise.resolve(academicResponse());
      }
      return Promise.reject(new Error(`unexpected endpoint ${endpoint}`));
    });
  });

  it('renders codes with masked values, status and stats', async () => {
    render(<OfflineCodesPage />);

    expect(await screen.findByText('ABCD-****-****')).toBeInTheDocument();
    expect(screen.getAllByText('كورس الأوفلاين').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('تصفية بالحالة')).toBeInTheDocument();
    expect(screen.getByLabelText('تصفية بالاستخدام')).toBeInTheDocument();
    expect(screen.getAllByText(/إجمالي الأكواد/).length).toBeGreaterThan(0);
  });

  it('opens the generate dialog and submits a generation request', async () => {
    render(<OfflineCodesPage />);
    await screen.findByText('ABCD-****-****');

    fireEvent.click(screen.getByRole('button', { name: /إنشاء أكواد/ }));
    expect(screen.getByText('إنشاء أكواد أوفلاين')).toBeInTheDocument();

    const dialog = screen.getByRole('dialog');
    const drawerSelects = dialog.querySelectorAll('select');
    const courseSelect = drawerSelects[0];
    const gradeSelect = drawerSelects[1];
    const numberInputs = dialog.querySelectorAll('input[type="number"]');
    const quantityInput = numberInputs[0];
    const maxUsesInput = numberInputs[1];

    fireEvent.change(quantityInput, { target: { value: '3' } });
    fireEvent.change(maxUsesInput, { target: { value: '1' } });
    fireEvent.change(gradeSelect, { target: { value: 'grade-1' } });
    fireEvent.change(courseSelect, { target: { value: 'course-1' } });

    mockedFetchApi.mockResolvedValueOnce({
      data: {
        codes: [
          { id: 'c1', code: 'WXYZ-1234-ABCD' },
          { id: 'c2', code: 'WXYZ-1234-EFGH' },
          { id: 'c3', code: 'WXYZ-1234-IJKL' },
        ],
      },
    });

    fireEvent.click(screen.getByRole('button', { name: /إنشاء الأكواد/ }));

    await waitFor(() => {
      expect(mockedFetchApi).toHaveBeenCalledWith(
        '/admin/v1/offline-codes/generate',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    expect(await screen.findByText('WXYZ-1234-ABCD')).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('3'));
  });

  it('sends filters to the API', async () => {
    render(<OfflineCodesPage />);
    await screen.findByText('ABCD-****-****');

    fireEvent.change(screen.getByLabelText('تصفية بالحالة'), {
      target: { value: 'USED' },
    });

    await waitFor(() => {
      const hasFilteredCall = mockedFetchApi.mock.calls.some(
        (call) =>
          typeof call[0] === 'string' &&
          call[0].startsWith('/admin/v1/offline-codes?') &&
          call[0].includes('status=USED'),
      );
      expect(hasFilteredCall).toBe(true);
    });
  });

  it('switches to the batches view and exports a batch', async () => {
    mockedFetchApi.mockImplementation((endpoint: string) => {
      if (endpoint.startsWith('/admin/v1/offline-codes?')) {
        return Promise.resolve({
          data: {
            items: [codeRow],
            total: 1,
            page: 1,
            pageSize: 25,
            totalPages: 1,
          },
        });
      }
      if (endpoint.includes('/batches/list')) {
        return Promise.resolve({
          data: {
            items: [batchRow],
            total: 1,
            page: 1,
            pageSize: 25,
            totalPages: 1,
          },
        });
      }
      if (endpoint.includes('/admin/v1/courses')) {
        return Promise.resolve(coursesResponse());
      }
      if (endpoint.includes('/admin/v1/academic')) {
        return Promise.resolve(academicResponse());
      }
      return Promise.reject(new Error(`unexpected endpoint ${endpoint}`));
    });

    render(<OfflineCodesPage />);
    fireEvent.click(await screen.findByRole('button', { name: /الدفعات/ }));

    const exportButton = await screen.findByRole('button', {
      name: /تصدير الأكواد/,
    });

    mockedFetchApi.mockResolvedValueOnce({
      data: {
        batchId: 'batch-1',
        course: { titleAr: 'كورس الأوفلاين' },
        grade: { nameAr: 'الصف الثالث الثانوي' },
        createdAt: '2026-08-01T10:00:00Z',
        codes: [
          { id: 'c1', code: 'WXYZ-1234-ABCD', status: 'ACTIVE', accountId: null },
          { id: 'c2', code: 'WXYZ-1234-EFGH', status: 'USED', accountId: 's1' },
        ],
      },
    });

    fireEvent.click(exportButton);

    expect(await screen.findByText('WXYZ-1234-ABCD')).toBeInTheDocument();
    expect(screen.getByText('WXYZ-1234-EFGH')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /طباعة/ })).toBeInTheDocument();
  });
});