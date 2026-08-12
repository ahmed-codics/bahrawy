import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import NewCoursePage from '../app/dashboard/courses/new/page';
import { fetchApi } from '../lib/api';

const router = {
  back: jest.fn(),
  push: jest.fn(),
  prefetch: jest.fn(),
  refresh: jest.fn(),
  replace: jest.fn(),
};

jest.mock('next/navigation', () => ({
  useRouter: () => router,
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { error: jest.fn(), success: jest.fn() },
}));

jest.mock('../lib/api', () => ({
  fetchApi: jest.fn(),
}));

const mockedFetchApi = jest.mocked(fetchApi);

const academic = {
  grades: [{ id: 'g1', nameAr: 'الصف الأول' }],
  subjects: [{ id: 's1', nameAr: 'الرياضيات' }],
  cohorts: [{ terms: [{ id: 't1', titleAr: 'الترم الأول' }] }],
};

describe('NewCoursePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFetchApi.mockImplementation((url: string) => {
      if (url === '/admin/v1/courses') {
        return Promise.resolve({ data: { id: 'course-1' } });
      }
      return Promise.resolve({ data: academic });
    });
  });

  it('swallows an aborted academic fetch after unmount without an unhandled rejection', async () => {
    let rejectLoad!: (reason?: unknown) => void;
    mockedFetchApi.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectLoad = reject;
        }),
    );

    let unhandled: unknown = null;
    const onUnhandled = (reason: unknown) => {
      unhandled = reason;
    };
    process.on('unhandledRejection', onUnhandled);

    const { unmount } = render(<NewCoursePage />);
    unmount();
    rejectLoad(new DOMException('The user aborted a request.', 'AbortError'));

    await new Promise((resolve) => setTimeout(resolve, 20));
    process.off('unhandledRejection', onUnhandled);

    expect(unhandled).toBeNull();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('creates exactly one course on rapid double submit', async () => {
    const { container } = render(<NewCoursePage />);
    await screen.findByText('بيانات الكورس الأساسية');

    const form = container.querySelector('form') as HTMLFormElement;
    fireEvent.submit(form);
    fireEvent.submit(form);

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith('/dashboard/courses/course-1'),
    );

    const createCalls = mockedFetchApi.mock.calls.filter(
      (call) => call[0] === '/admin/v1/courses',
    );
    expect(createCalls).toHaveLength(1);
    expect(toast.error).not.toHaveBeenCalled();
  });
});