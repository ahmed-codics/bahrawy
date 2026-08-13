import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OfflineCodeActivation } from '../components/OfflineCodeActivation';
import { fetchApi } from '../lib/api';

jest.mock('../lib/api', () => ({
  fetchApi: jest.fn(),
}));

const mockedFetchApi = jest.mocked(fetchApi);

describe('OfflineCodeActivation', () => {
  const onActivated = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the collapsed activation banner', () => {
    render(<OfflineCodeActivation onActivated={onActivated} />);
    expect(screen.getByText('لديك كود تفعيل؟')).toBeInTheDocument();
  });

  it('opens the form and activates a valid code', async () => {
    mockedFetchApi.mockResolvedValueOnce({
      status: 'SUCCESS',
      data: { courseId: 'course-1', productId: 'product-1' },
    });

    render(<OfflineCodeActivation onActivated={onActivated} />);
    fireEvent.click(screen.getByText('لديك كود تفعيل؟'));

    fireEvent.change(screen.getByPlaceholderText('BHW-XXXX-XXXX'), {
      target: { value: 'abcd-efgh-ijkl' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'تفعيل الكود' }));

    await waitFor(() => {
      expect(mockedFetchApi).toHaveBeenCalledWith(
        '/student/offline-codes/activate',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    expect(onActivated).toHaveBeenCalledWith('course-1');
    expect(await screen.findByText(/تم تفعيل الكورس بنجاح/)).toBeInTheDocument();
  });

  it('surfaces the API error message', async () => {
    mockedFetchApi.mockRejectedValueOnce(new Error('الكود مستخدم بالفعل'));

    render(<OfflineCodeActivation onActivated={onActivated} />);
    fireEvent.click(screen.getByText('لديك كود تفعيل؟'));

    fireEvent.change(screen.getByPlaceholderText('BHW-XXXX-XXXX'), {
      target: { value: 'ABCD-EFGH-JKLM' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'تفعيل الكود' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'الكود مستخدم بالفعل',
    );
    expect(onActivated).not.toHaveBeenCalled();
  });
});