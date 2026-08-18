import { IsIn, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { VideoAccessGrantDuration } from '@bahrawy/db';

export const VIDEO_ACCESS_REQUEST_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'REVOKED',
] as const;

export class VideoAccessRequestListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(VIDEO_ACCESS_REQUEST_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  courseId?: string;

  @IsOptional()
  @IsString()
  gradeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}

export class ApproveVideoAccessRequestDto {
  @IsOptional()
  @IsIn(Object.values(VideoAccessGrantDuration))
  durationType?: VideoAccessGrantDuration;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  customDays?: number;
}

export class RejectVideoAccessRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class RevokeVideoAccessGrantDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
