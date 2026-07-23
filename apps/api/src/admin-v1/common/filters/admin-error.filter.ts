import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AdminApiError } from '@bahrawy/types';
import * as crypto from 'crypto';

@Catch()
export class AdminApiErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { traceId?: string }>();
    const incomingTraceId = request.headers['x-request-id'];
    const traceId =
      request.traceId ||
      (typeof incomingTraceId === 'string' && incomingTraceId.trim()
        ? incomingTraceId
        : crypto.randomUUID());

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';
    let fieldErrors: Record<string, string[]> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const payload = exceptionResponse as {
          message?: string | string[];
          code?: string;
          fieldErrors?: Record<string, string[]>;
        };
        if (Array.isArray(payload.message)) {
          message = 'Validation failed';
          fieldErrors = { _form: payload.message };
        } else if (payload.message) {
          message = payload.message;
        }
        code =
          payload.code || exception.name.replace('Exception', '').toUpperCase();
        fieldErrors = payload.fieldErrors || fieldErrors;
      } else {
        message = exception.message;
        code = exception.name.replace('Exception', '').toUpperCase();
      }
    }

    const errorResponse: AdminApiError = {
      code,
      message,
      fieldErrors,
      traceId,
    };

    response.setHeader('x-request-id', traceId);
    response.status(status).json(errorResponse);
  }
}
