import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';

export const DEVICE_BLOCK_REASONS = [
  'UNKNOWN_DEVICE',
  'NON_PRIMARY_DEVICE',
  'SESSION_DEVICE_MISMATCH',
] as const;

export class DeviceLockListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  gradeId?: string;

  @IsOptional()
  @IsIn(DEVICE_BLOCK_REASONS)
  reason?: string;

  @IsOptional()
  @IsIn(['DEVICE_BLOCKED', 'ACTIVE', 'SUSPENDED'])
  status?: string;

  @IsOptional()
  @IsString()
  blockedFrom?: string;

  @IsOptional()
  @IsString()
  blockedTo?: string;
}
