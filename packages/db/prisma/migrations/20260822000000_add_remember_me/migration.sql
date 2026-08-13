-- Remember Me: persistent student/staff sessions.
-- Applied manually to the local dev DB (migration history has drift that
-- blocks `prisma migrate dev`), matching the device_lock precedent.
--
-- AuthSession.rememberMe: marks whether the session was created with the
-- "تذكرني على هذا الجهاز" checkbox. Persistent sessions get a much longer
-- idle + absolute expiry (30 days) and their session cookie is issued with
-- Max-Age so it survives browser restarts. Normal sessions keep the short
-- 1h idle / 7d absolute policy and a session (non-persistent) cookie.

ALTER TABLE "AuthSession" ADD COLUMN "rememberMe" BOOLEAN NOT NULL DEFAULT false;
