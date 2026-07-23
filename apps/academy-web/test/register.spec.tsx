import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import RegisterPage from '../app/register/page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

describe('Student self-registration', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        data: [
          {
            id: 'grade-1',
            code: 'g3-prep',
            nameAr: 'الصف الثالث الإعدادي',
            status: 'ACTIVE',
          },
        ],
      }),
    }) as jest.Mock;
  });

  afterEach(() => jest.restoreAllMocks());

  it('collects identity, family, school, grade, and password details', async () => {
    render(<RegisterPage />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    for (const [label, value] of [
      ['الاسم الأول', 'أحمد'],
      ['الاسم الثاني', 'محمد'],
      ['الاسم الثالث', 'علي'],
      ['الاسم الأخير', 'حسن'],
    ]) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    fireEvent.change(screen.getByLabelText('النوع'), { target: { value: 'MALE' } });
    fireEvent.click(screen.getByRole('button', { name: /التالي/ }));

    for (const [label, value] of [
      ['رقم الهاتف', '01012345678'],
      ['رقم هاتف الأب', '01112345678'],
      ['رقم هاتف الأم', '01212345678'],
      ['المدينة / المحافظة', 'القاهرة'],
    ]) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    fireEvent.click(screen.getByRole('button', { name: /التالي/ }));

    expect(screen.getByLabelText('اسم المدرسة')).toBeInTheDocument();
    expect(screen.getByLabelText('مهنة ولي الأمر')).toBeInTheDocument();
    expect(screen.getByLabelText('المرحلة الدراسية')).toBeInTheDocument();
    const password = screen.getByLabelText('كلمة المرور');
    const confirmPassword = screen.getByLabelText('تأكيد كلمة المرور');
    expect(password).toHaveAttribute('type', 'password');
    expect(confirmPassword).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'إظهار كلمة المرور' }));
    expect(password).toHaveAttribute('type', 'text');
    expect(confirmPassword).toHaveAttribute('type', 'password');
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'الصف الثالث الإعدادي' })).toBeInTheDocument(),
    );
  });
});
