import type { Response } from 'express';
import { createReadStream, statSync } from 'fs';

const DEFAULT_CHUNK_BYTES = 16 * 1024 * 1024;

export function streamVideoFile(
  filePath: string,
  range: string | undefined,
  response: Response,
) {
  const fileSize = statSync(filePath).size;

  if (!range) {
    response.status(200).set({
      'Content-Type': 'video/mp4',
      'Content-Length': fileSize,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=3600',
    });
    return createReadStream(filePath).pipe(response);
  }

  const match = /^bytes=(\d*)-(\d*)$/i.exec(range.trim());
  if (!match || (!match[1] && !match[2])) {
    return rangeNotSatisfiable(response, fileSize);
  }

  let start: number;
  let end: number;

  if (!match[1]) {
    const suffixLength = Number.parseInt(match[2], 10);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return rangeNotSatisfiable(response, fileSize);
    }
    start = Math.max(0, fileSize - suffixLength);
    end = fileSize - 1;
  } else {
    start = Number.parseInt(match[1], 10);
    const requestedEnd = match[2]
      ? Number.parseInt(match[2], 10)
      : start + DEFAULT_CHUNK_BYTES - 1;
    end = Math.min(requestedEnd, fileSize - 1);
  }

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    start >= fileSize ||
    end < start
  ) {
    return rangeNotSatisfiable(response, fileSize);
  }

  response.status(206).set({
    'Content-Type': 'video/mp4',
    'Content-Length': end - start + 1,
    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=3600',
  });

  return createReadStream(filePath, { start, end }).pipe(response);
}

function rangeNotSatisfiable(response: Response, fileSize: number) {
  response.status(416).set({
    'Content-Range': `bytes */${fileSize}`,
    'Accept-Ranges': 'bytes',
  });
  return response.end();
}
