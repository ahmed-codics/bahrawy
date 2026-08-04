import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AdminApiResponse } from '@bahrawy/types';

@Injectable()
export class AdminApiResponseInterceptor<T> implements NestInterceptor<
  T,
  AdminApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<AdminApiResponse<T>> {
    return next.handle().pipe(map((data) => ({ data })));
  }
}
