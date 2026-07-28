import { render, screen } from '@testing-library/react';
import Home from '../app/page';

describe('Academy Web Home', () => {
  const apiGrades = [
    {
      id: 'prep-3',
      code: 'g3-prep',
      nameAr: 'الصف الثالث الإعدادي',
      nameEn: 'Third Preparatory',
      sort: 1,
      status: 'ACTIVE',
    },
    {
      id: 'sec-1',
      code: 'g1-sec',
      nameAr: 'الصف الأول الثانوي',
      nameEn: 'First Secondary',
      sort: 2,
      status: 'ACTIVE',
    },
    {
      id: 'sec-2',
      code: 'g2-sec',
      nameAr: 'الصف الثاني الثانوي',
      nameEn: 'Second Secondary',
      sort: 3,
      status: 'ACTIVE',
    },
    {
      id: 'sec-3',
      code: 'g3-sec',
      nameAr: '[DEV ONLY] الصف الثالث الثانوي',
      nameEn: '[DEV ONLY] Third Secondary',
      sort: 4,
      status: 'ACTIVE',
    },
  ];

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: apiGrades }),
    }) as jest.Mock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the student-first Arabic hero and both entry actions', async () => {
    render(await Home());
    expect(screen.getByRole('heading', { name: /منصة البحراوي English/ })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /اختار مرحلتك/ }).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'أنا طالب بالفعل' })).toHaveAttribute('href', '/login');
  });

  it('renders all four grades with filtered course links', async () => {
    render(await Home());
    expect(screen.getByText('الصف الثالث الإعدادي')).toBeInTheDocument();
    expect(screen.getByText('الصف الأول الثانوي')).toBeInTheDocument();
    expect(screen.getByText('الصف الثاني الثانوي')).toBeInTheDocument();
    expect(screen.getByText('الصف الثالث الثانوي')).toBeInTheDocument();
    expect(screen.queryByText(/\[DEV ONLY\]/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /الصف الثالث الإعدادي/ })).toHaveAttribute(
      'href',
      '/courses?gradeId=prep-3',
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('uses the four-grade fallback without blocking the landing page', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as jest.Mock;
    render(await Home());

    expect(screen.getByText('الصف الثالث الإعدادي')).toBeInTheDocument();
    expect(screen.getByText('الصف الثالث الثانوي')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('بنحدّث قائمة الكورسات');
    expect(screen.getByRole('link', { name: /الصف الثالث الإعدادي/ })).toHaveAttribute(
      'href',
      '/courses',
    );
  });

  it('renders the teacher story, accessible artwork, and native FAQ', async () => {
    render(await Home());

    expect(screen.getByRole('heading', { name: /نفس شرح مستر البحراوي/ })).toBeInTheDocument();
    expect(screen.getByAltText('مستر السيد البحراوي')).toBeInTheDocument();
    expect(screen.getByText('أختار المرحلة بتاعتي إزاي؟')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('does not publish unverified social proof claims', async () => {
    render(await Home());

    expect(screen.queryByText(/٥٠٠٠/)).not.toBeInTheDocument();
    expect(screen.queryByText(/٩٨%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/آلاف الطلاب/)).not.toBeInTheDocument();
  });
});
