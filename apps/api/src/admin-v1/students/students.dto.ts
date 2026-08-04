import { Type, Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateStudentDto {
  @IsString()
  @MinLength(2)
  displayName!: string;

  @IsString()
  @MinLength(8)
  phone!: string;

  @IsOptional()
  @IsString()
  gradeId?: string;
}

export class StudentStatusDto {
  @IsIn(['ACTIVE', 'SUSPENDED'])
  status!: 'ACTIVE' | 'SUSPENDED';

  @IsString()
  @MinLength(3)
  reason!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}

export class ReasonDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}

export class GrantEntitlementDto extends ReasonDto {
  @IsString()
  productId!: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class UpdateEntitlementDto extends ReasonDto {
  @IsOptional()
  @IsIn(['ACTIVE', 'SUSPENDED', 'REVOKED', 'EXPIRED'])
  status?: 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'EXPIRED';

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class UpdateStudentProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  phone?: string;

  @IsOptional()
  @IsString()
  gradeId?: string;

  @IsOptional()
  @IsString()
  schoolName?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  parentPhone?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsString()
  @MinLength(3)
  reason!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}
