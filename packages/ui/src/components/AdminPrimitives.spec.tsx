import { fireEvent, render, screen } from '@testing-library/react';
import { DataTable, Drawer } from './AdminPrimitives';

describe('AdminPrimitives', () => {
  it('renders stable typed table cells and an empty state', () => {
    const { rerender } = render(
      <DataTable
        columns={[
          {
            id: 'name',
            header: 'الاسم',
            cell: (row: { id: string; name: string }) => row.name,
          },
        ]}
        data={[{ id: '1', name: 'Course one' }]}
        keyExtractor={(row) => row.id}
      />,
    );
    expect(screen.getByText('Course one')).toBeInTheDocument();

    rerender(
      <DataTable<{ id: string; name: string }>
        columns={[
          {
            id: 'name',
            header: 'الاسم',
            cell: (row) => row.name,
          },
        ]}
        data={[]}
        keyExtractor={(row) => row.id}
      />,
    );
    expect(screen.getByText('لا توجد بيانات')).toBeInTheDocument();
  });

  it('closes a drawer with Escape and restores focus', () => {
    const onClose = jest.fn();
    const { rerender } = render(
      <>
        <button type="button">فتح</button>
        <Drawer isOpen={false} onClose={onClose} title="تفاصيل">
          المحتوى
        </Drawer>
      </>,
    );
    screen.getByRole('button', { name: 'فتح' }).focus();

    rerender(
      <>
        <button type="button">فتح</button>
        <Drawer isOpen onClose={onClose} title="تفاصيل">
          المحتوى
        </Drawer>
      </>,
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps focus inside a modal field when its parent rerenders', () => {
    const { rerender } = render(
      <Drawer isOpen onClose={() => undefined} title="تفاصيل">
        <input aria-label="ملاحظة" />
      </Drawer>,
    );
    const input = screen.getByRole('textbox', { name: 'ملاحظة' });
    input.focus();

    rerender(
      <Drawer isOpen onClose={() => undefined} title="تفاصيل">
        <input aria-label="ملاحظة" defaultValue="ا" />
      </Drawer>,
    );

    expect(input).toHaveFocus();
  });
});
