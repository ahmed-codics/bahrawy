# Video providers

Video lessons support `YOUTUBE`, `R2`, and `LOCAL`.

The API needs the following variables for R2:

```env
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=bahrawy-videos
R2_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
R2_REGION=auto
```

Keep the R2 bucket private. Browser uploads use short-lived presigned URLs, so
the bucket also needs a CORS policy. For local development, add this under
**R2 bucket > Settings > CORS Policy**:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3001",
      "http://localhost:3002"
    ],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedHeaders": ["Content-Type", "Range"],
    "ExposeHeaders": [
      "ETag",
      "Content-Length",
      "Content-Range",
      "Accept-Ranges"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

Replace or extend the origins with the real academy and staff-admin HTTPS
origins when deploying. CORS does not make objects public; every upload and
playback request still requires a short-lived signature from the API.
