import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';

export const OFFLINE_CODE_STATUSES = ['ACTIVE', 'DISABLED', 'USED'] as const;

export class GenerateOfflineCodesDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  quantity!: number;

  @IsString()
  courseId!: string;

  @IsOptional()
  @IsString()
  gradeId?: string;

  @IsOptional()
  @IsString()
  expiresAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  maxUses?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class OfflineCodeListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsString()
  gradeId?: string;

  @IsOptional()
  @IsString()
  courseId?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'DISABLED', 'USED', 'EXPIRED'])
  status?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  used?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  expired?: string;

  @IsOptional()
  @IsString()
  batchId?: string;

  @IsOptional()
  @IsString()
  createdFrom?: string;

  @IsOptional()
  @IsString()
  createdTo?: string;

  @IsOptional()
  @IsString()
  activatedFrom?: string;

  @IsOptional()
  @IsString()
  activatedTo?: string;
}

export class UpdateOfflineCodeStatusDto {
  @IsIn(['ACTIVE', 'DISABLED'])
  status!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class BulkOfflineCodeStatusDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];

  @IsIn(['ACTIVE', 'DISABLED'])
  status!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class BulkOfflineCodeDeleteDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class BatchListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  courseId?: string;

  @IsOptional()
  @IsString()
  gradeId?: string;
}

export class ActivateOfflineCodeDto {
  @IsString()
  @MinLength(4)
  @MaxLength(64)
  code!: string;
}
