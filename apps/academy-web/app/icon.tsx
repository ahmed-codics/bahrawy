import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 112,
          background: '#06101e',
          color: '#69ddeb',
          fontSize: 220,
          fontWeight: 900,
          fontFamily: 'sans-serif',
        }}
      >
        ب
      </div>
    ),
    size,
  );
}
