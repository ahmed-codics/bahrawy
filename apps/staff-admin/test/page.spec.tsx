import AdminHome from '../app/page';

const redirect = jest.fn();

jest.mock('next/navigation', () => ({
  redirect: (path: string) => redirect(path),
}));

describe('Staff Admin Home', () => {
  beforeEach(() => redirect.mockClear());

  it('redirects staff to the dashboard', () => {
    AdminHome();
    expect(redirect).toHaveBeenCalledWith('/dashboard');
  });
});
