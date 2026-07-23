import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateAcademicEntityDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  nameAr!: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sort?: number;
}

export class UpdateAcademicEntityDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  nameAr?: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sort?: number;
}

export class CreateAcademicYearDto {
  @IsString()
  @MinLength(1)
  label!: string;

  @IsDateString()
  startsOn!: string;

  @IsDateString()
  endsOn!: string;
}

export class CreateCohortDto {
  @IsString()
  academicYearId!: string;

  @IsString()
  gradeId!: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  expiresAt!: string;
}

export class CreateTermDto {
  @IsString()
  cohortId!: string;

  @IsString()
  code!: string;

  @IsString()
  @MinLength(1)
  titleAr!: string;

  @IsOptional()
  @IsString()
  titleEn?: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sort?: number;
}

export class ReorderDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];
}
