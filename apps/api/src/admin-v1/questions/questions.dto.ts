import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class QuestionInputDto {
  @IsString()
  @MinLength(1)
  titleAr!: string;

  @IsOptional()
  @IsString()
  titleEn?: string;

  @IsOptional()
  @IsString()
  passage?: string;

  @IsArray()
  options!: unknown[];

  @IsString()
  correctOptionId!: string;

  @IsOptional()
  @IsString()
  explanation?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  gradeId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  points?: number;
}

export class UpdateQuestionDto extends QuestionInputDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}

export class AssignQuestionsDto {
  @IsArray()
  @IsString({ each: true })
  questionIds!: string[];
}
