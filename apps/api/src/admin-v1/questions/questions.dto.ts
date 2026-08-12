import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  Validate,
  ValidateNested,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';

export class QuestionOptionDto {
  @IsString()
  @MinLength(1)
  id!: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  textAr?: string;

  @IsOptional()
  @IsString()
  titleAr?: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  value?: string;
}

@ValidatorConstraint({ name: 'validQuestionOptions', async: false })
export class QuestionOptionsConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as QuestionInputDto;
    const options = Array.isArray(value) ? (value as unknown[]) : [];
    if (options.length < 2) return false;
    const ids = new Set<string>();
    for (const raw of options) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
      const id = Object.entries(raw).find(([key]) => key === 'id')?.[1];
      if (typeof id !== 'string' || id.trim().length === 0) return false;
      if (ids.has(id)) return false;
      ids.add(id);
      const hasText = Object.entries(raw).some(
        ([key, val]) =>
          key !== 'id' && typeof val === 'string' && val.trim().length > 0,
      );
      if (!hasText) return false;
    }
    const correct = dto.correctOptionId;
    return (
      typeof correct === 'string' && correct.length > 0 && ids.has(correct)
    );
  }

  defaultMessage(): string {
    return 'options must contain at least 2 options with unique non-empty ids and text, and correctOptionId must reference one of the submitted options';
  }
}

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
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  @Validate(QuestionOptionsConstraint)
  options!: QuestionOptionDto[];

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

export class ListQuestionsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  gradeId?: string;

  @IsOptional()
  @IsString()
  archived?: string;
}
