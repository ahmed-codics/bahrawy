import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LifecycleDialog } from '../app/dashboard/_components/LifecycleDialog';
import { fetchApi } from '../lib/api';

jest.mock('../lib/api', () => ({
  fetchApi: jest.fn(),
}));

const mockedFetchApi = jest.mocked(fetchApi);

describe('LifecycleDialog', () => {
  beforeEach(() => {
    mockedFetchApi.mockReset();
  });

  it('loads deletion impact before allowing an archive request', async () => {
    mockedFetchApi
      .mockResolvedValueOnce({
        data: {
          label: 'كورس تجريبي',
          currentStatus: 'PUBLISHED',
          actions: ['ARCHIVE'],
          blockers: [{ code: 'HAS_PROGRESS', label: 'تقدم الطلاب', count: 4 }],
          affectedChildren: [{ type: 'LESSON', label: 'الدروس', count: 8 }],
          requiresReason: true,
          requiresTypedConfirmation: false,
        },
      })
      .mockResolvedValueOnce({ data: { id: 'course-1' }, message: 'تمت الأرشفة' });
    const onComplete = jest.fn();
    const onClose = jest.fn();

    render(
      <LifecycleDialog
        open
        endpoint="/admin/v1/courses/course-1"
        version={3}
        onClose={onClose}
        onComplete={onComplete}
      />,
    );

    expect(await screen.findByText('تقدم الطلاب')).toBeInTheDocument();
    const archiveButton = screen.getByRole('button', { name: 'أرشفة' });
    expect(archiveButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/سبب الإجراء/), {
      target: { value: 'انتهى الموسم الدراسي' },
    });
    fireEvent.click(archiveButton);

    await waitFor(() =>
      expect(mockedFetchApi).toHaveBeenLastCalledWith(
        '/admin/v1/courses/course-1/archive',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            version: 3,
            reason: 'انتهى الموسم الدراسي',
          }),
        }),
      ),
    );
    expect(onComplete).toHaveBeenCalledWith('ARCHIVE');
    expect(onClose).toHaveBeenCalled();
  });

  it('requires the exact entity label before permanent deletion', async () => {
    mockedFetchApi.mockResolvedValueOnce({
      data: {
        label: 'مسودة بلا استخدام',
        currentStatus: 'DRAFT',
        actions: ['ARCHIVE', 'PERMANENT_DELETE'],
        blockers: [],
        affectedChildren: [],
        requiresReason: true,
        requiresTypedConfirmation: true,
      },
    });

    render(
      <LifecycleDialog
        open
        endpoint="/admin/v1/courses/draft-1"
        version={1}
        onClose={jest.fn()}
        onComplete={jest.fn()}
      />,
    );

    fireEvent.click(await screen.findByDisplayValue('PERMANENT_DELETE'));
    fireEvent.change(screen.getByLabelText(/سبب الإجراء/), {
      target: { value: 'مسودة مكررة وغير مستخدمة' },
    });

    const deleteButton = screen.getByRole('button', { name: 'حذف نهائي' });
    expect(deleteButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/اكتب "مسودة بلا استخدام" للتأكيد/), {
      target: { value: 'اسم غير صحيح' },
    });
    expect(deleteButton).toBeDisabled();
    expect(mockedFetchApi).toHaveBeenCalledTimes(1);
  });
});
