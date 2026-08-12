import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';

export enum ExamViolationStatusFilter {
  LOCKED = 'LOCKED',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  SUBMITTED = 'SUBMITTED',
}

export const EXAM_SESSION_STATUSES = [
  'LOCKED',
  'ACTIVE',
  'EXPIRED',
  'SUBMITTED',
] as const;

export enum ExamViolationCaseType {
  ALL = 'ALL',
  SUSPENDED = 'SUSPENDED',
  FAILED = 'FAILED',
}

export const EXAM_VIOLATION_CASE_TYPES = [
  'ALL',
  'SUSPENDED',
  'FAILED',
] as const;

export const EXAM_VIOLATION_SORT_FIELDS = [
  'lastAttemptAt',
  'score',
  'attemptsCount',
  'openCount',
] as const;

export class ExamViolationsListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  gradeId?: string;

  @IsOptional()
  @IsString()
  courseId?: string;

  @IsOptional()
  @IsString()
  assessmentId?: string;

  @IsOptional()
  @IsEnum(ExamViolationStatusFilter)
  status?: ExamViolationStatusFilter;

  @IsOptional()
  @IsEnum(ExamViolationCaseType)
  caseType?: ExamViolationCaseType;

  @IsOptional()
  @IsIn(EXAM_VIOLATION_SORT_FIELDS)
  sortBy?: (typeof EXAM_VIOLATION_SORT_FIELDS)[number];

  @IsOptional()
  @IsIn(['asc', 'desc'])
  direction?: 'asc' | 'desc';
}
