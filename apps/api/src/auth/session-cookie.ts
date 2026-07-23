export function getSessionCookieName(req: any): string {
  const referer = req.headers?.referer || '';
  const origin = req.headers?.origin || '';
  const xPortal = req.headers?.['x-portal-type'] || '';

  const isStaff =
    xPortal === 'staff' ||
    referer.includes('3002') ||
    origin.includes('3002') ||
    referer.includes('admin') ||
    origin.includes('admin');

  if (
    process.env.NODE_ENV === 'production' &&
    process.env.COOKIE_FORCE_SECURE === 'true'
  ) {
    return isStaff
      ? '__Host-Session-Token-Staff'
      : '__Host-Session-Token-Student';
  }
  return isStaff ? 'bahrawy_session_staff' : 'bahrawy_session_student';
}

export const SESSION_COOKIE_NAMES = [
  'bahrawy_session_staff',
  'bahrawy_session_student',
  '__Host-Session-Token-Staff',
  '__Host-Session-Token-Student',
  '__Host-bahrawy_session_staff',
  '__Host-bahrawy_session_student',
];

export function getSessionTokenFromCookies(req: any): string | null {
  const preferredCookieName = getSessionCookieName(req);
  const cookies = req.cookies ?? {};
  const signedCookies = req.signedCookies ?? {};
  return (
    cookies[preferredCookieName] ??
    signedCookies[preferredCookieName] ??
    cookies.bahrawy_session_staff ??
    signedCookies.bahrawy_session_staff ??
    cookies.bahrawy_session_student ??
    signedCookies.bahrawy_session_student ??
    cookies['__Host-Session-Token-Staff'] ??
    signedCookies['__Host-Session-Token-Staff'] ??
    cookies['__Host-Session-Token-Student'] ??
    signedCookies['__Host-Session-Token-Student'] ??
    cookies['__Host-bahrawy_session_staff'] ??
    signedCookies['__Host-bahrawy_session_staff'] ??
    cookies['__Host-bahrawy_session_student'] ??
    signedCookies['__Host-bahrawy_session_student'] ??
    null
  );
}

export const SESSION_COOKIE_SECURE =
  process.env.NODE_ENV === 'production' &&
  process.env.COOKIE_FORCE_SECURE === 'true';
