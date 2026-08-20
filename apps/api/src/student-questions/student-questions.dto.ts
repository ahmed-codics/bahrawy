import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { MAX_QUESTION_ATTACHMENTS } from './student-questions-attachments.service';

export class CreateStudentQuestionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsString()
  courseId?: string;

  @IsOptional()
  @IsString()
  lessonId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_QUESTION_ATTACHMENTS)
  @IsUUID('4', { each: true })
  attachmentIds?: string[];

  @IsOptional()
  @IsObject()
  voiceDurations?: Record<string, number>;
}

export class StudentQuestionReplyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_QUESTION_ATTACHMENTS)
  @IsUUID('4', { each: true })
  attachmentIds?: string[];

  @IsOptional()
  @IsObject()
  voiceDurations?: Record<string, number>;
}

export class ListStudentQuestionsQueryDto {
  @IsOptional()
  @IsIn(['PENDING_REVIEW', 'ANSWERED', 'CLOSED'])
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
