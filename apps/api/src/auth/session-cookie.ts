const IS_PRODUCTION = process.env.NODE_ENV === 'production';

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

  if (IS_PRODUCTION) {
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

export const SESSION_COOKIE_SECURE = IS_PRODUCTION;

export const SESSION_COOKIE_OPTIONS: {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: '/';
} = {
  httpOnly: true,
  secure: SESSION_COOKIE_SECURE,
  sameSite: 'lax',
  path: '/',
};

// Persistent (remember-me) sessions get a Max-Age cookie so the browser keeps
// it across restarts. Normal sessions stay as session cookies (no Max-Age)
// and are dropped when the browser closes.
export const SESSION_COOKIE_REMEMBER_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export function getSessionCookieOptions(
  rememberMe = false,
): typeof SESSION_COOKIE_OPTIONS & { maxAge?: number } {
  if (!rememberMe) return SESSION_COOKIE_OPTIONS;
  // Express cookie `maxAge` is in milliseconds; the Set-Cookie Max-Age
  // attribute (seconds) is derived from it by cookie-parser.
  return { ...SESSION_COOKIE_OPTIONS, maxAge: SESSION_COOKIE_REMEMBER_MS };
}

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
