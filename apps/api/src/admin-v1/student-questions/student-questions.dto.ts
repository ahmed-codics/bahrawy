import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { MAX_QUESTION_ATTACHMENTS } from '../../student-questions/student-questions-attachments.service';

export class ListStudentQuestionsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['PENDING_REVIEW', 'ANSWERED', 'CLOSED'])
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  gradeId?: string;
}

export class AdminStudentQuestionReplyDto {
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

export class UpdateStudentQuestionStatusDto {
  @IsIn(['PENDING_REVIEW', 'ANSWERED', 'CLOSED'])
  status!: 'PENDING_REVIEW' | 'ANSWERED' | 'CLOSED';
}
