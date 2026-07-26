import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsString,
  Min,
  MinLength,
  IsOptional,
} from 'class-validator';

export class CreateStaffDto {
  @IsString()
  @MinLength(2)
  displayName!: string;

  @IsString()
  @MinLength(8)
  phone!: string;

  @IsArray()
  @IsString({ each: true })
  roleIds!: string[];
}

export class UpdateStaffDto {
  @IsIn(['ACTIVE', 'SUSPENDED'])
  status!: 'ACTIVE' | 'SUSPENDED';

  @IsArray()
  @IsString({ each: true })
  roleIds!: string[];

  @IsString()
  @MinLength(3)
  reason!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}

export class UpdateOrganizationDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  timezone!: string;

  @IsString()
  currency!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @IsString()
  @IsOptional()
  paymentInstapay?: string;

  @IsString()
  @IsOptional()
  paymentWallet?: string;
}
