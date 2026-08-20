import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
} from '@nestjs/common';
import { PayloadTooLargeException } from '@nestjs/common';

/**
 * Converts the 413 produced by multer's file-size limit into a 400 with a
 * user-facing Arabic message. Instantiate with `'voice'` for the audio upload
 * endpoint; defaults to the image message.
 */
@Catch(PayloadTooLargeException)
export class MulterSizeErrorFilter implements ExceptionFilter {
  constructor(private readonly kind: 'image' | 'voice' = 'image') {}

  catch(_exception: PayloadTooLargeException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const error = new BadRequestException({
      code: 'FILE_TOO_LARGE',
      message:
        this.kind === 'voice'
          ? 'حجم التسجيل يجب ألا يتجاوز 10 ميجابايت'
          : 'حجم الصورة يجب ألا يتجاوز 5 ميجابايت',
    });
    const status = error.getStatus();
    const body = error.getResponse();
    response.status(status).json(body);
  }
}
