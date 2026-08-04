# Video Pipeline (Lean V1)

**Encoding (Workstation):**

- FFmpeg scripts run on operator machines, never on the production VPS.
- Target: 720p (H.264/AAC, ~1.0-1.1 Mbps) default, 480p fallback.
- Output: Aligned 6-10 second segments and manifest.

**Storage & Delivery:**

- Stored on Hostinger NVMe outside public web roots.
- Direct DNS resolution (bypassing CDN caching for video segments).
- NGINX authorizes delivery based on short-lived API-issued tokens.

**Player Features:**

- Moving name/ID watermark.
- 90% unique watch completion calculation (server-validated).
- Resume and data saver.
