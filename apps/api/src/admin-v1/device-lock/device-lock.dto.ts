import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';

export class DeviceLockListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  gradeId?: string;
}

export const DEVICE_BLOCK_REASONS = [
  'UNKNOWN_DEVICE',
  'NON_PRIMARY_DEVICE',
  'SESSION_DEVICE_MISMATCH',
] as const;