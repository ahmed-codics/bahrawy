import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ArrayMinSize } from 'class-validator';

export class LessonQuizOptionDto {
  @IsString()
  @MinLength(1)
  id!: string;

  @IsString()
  @MinLength(1)
  text!: string;
}

export class LessonQuizQuestionDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  questionId?: string;

  @IsString()
  @MinLength(1)
  titleAr!: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => LessonQuizOptionDto)
  options!: LessonQuizOptionDto[];

  @IsString()
  @MinLength(1)
  correctOptionId!: string;

  @IsOptional()
  @IsString()
  explanation?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  points?: number;
}

export class UpsertLessonQuizDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsString()
  titleAr?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  passingScore?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LessonQuizQuestionDto)
  questions?: LessonQuizQuestionDto[];
}
