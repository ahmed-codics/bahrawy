import { render, screen } from '@testing-library/react';
import CoursesPage from '../app/courses/page';

describe('Public academy flow', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows the published bundle cover and preserves checkout intent through login', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'semester-one',
              titleAr: 'الفصل الدراسي الأول',
              titleEn: 'Semester one',
              descriptionAr: 'شرح وتدريب ومراجعة للترم الأول.',
              coverImageUrl: '/storage/cover-1',
              prices: [{ amount: '100', currency: 'EGP' }],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'sec-3',
              code: 'g3-sec',
              nameAr: '[DEV ONLY] الصف الثالث الثانوي',
              status: 'ACTIVE',
            },
          ],
        }),
      }) as jest.Mock;

    render(
      await CoursesPage({
        searchParams: Promise.resolve({ gradeId: 'sec-3' }),
      }),
    );

    expect(screen.getByRole('heading', { name: 'الصف الثالث الثانوي' })).toBeInTheDocument();
    expect(screen.queryByText(/\[DEV ONLY\]/)).not.toBeInTheDocument();
    expect(screen.getByAltText('صورة باقة الفصل الدراسي الأول')).toHaveAttribute(
      'src',
      '/api/storage/public/cover-1',
    );
    expect(screen.getByRole('link', { name: /سجّل واشترك/ })).toHaveAttribute(
      'href',
      '/login?next=%2Fstudent%2Fcheckout%2Fsemester-one',
    );
  });

  it('keeps the page useful when no products are published', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: false }) as jest.Mock;

    render(await CoursesPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole('heading', { name: /مفيش محتوى منشور/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /اختار مرحلة تانية/ })).toHaveAttribute(
      'href',
      '/#levels',
    );
  });
});
