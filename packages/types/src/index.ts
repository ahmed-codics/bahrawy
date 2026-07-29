// API Response and Request Types

export type ApiResponse<T> = {
  data?: T;
  message?: string;
  error?: string;
};

// Auth Types
export type AuthResponse = {
  status: 'SUCCESS' | 'REQUIRES_TOTP' | 'FAILED';
  accountId?: string;
  kind?: string;
  mustChangePassword?: boolean;
};

export enum StaffPermission {
  CATALOG_MANAGE = 'CATALOG_MANAGE',
  PRODUCT_MANAGE = 'PRODUCT_MANAGE',
  STUDENT_MANAGE = 'STUDENT_MANAGE',
  PAYMENT_MANAGE = 'PAYMENT_MANAGE',
  SUPPORT_MANAGE = 'SUPPORT_MANAGE',
  STAFF_MANAGE = 'STAFF_MANAGE',
  ASSESSMENT_MANAGE = 'ASSESSMENT_MANAGE',
}

// Product Types
export type ProductDTO = {
  id: string;
  titleAr: string;
  titleEn?: string;
  descriptionAr?: string | null;
  coverImageUrl?: string | null;
  isEntitled?: boolean;
  status: string;
  prices: ProductPriceDTO[];
  courses?: any[];
};

export type ProductPriceDTO = {
  id: string;
  amount: number;
  currency: string;
};

// User / Account Types
export type AccountDTO = {
  id: string;
  phone: string;
  kind: string;
  status: string;
  displayName: string;
};

export type StudentDTO = {
  id: string;
  accountId: string;
  displayName: string;
  phone: string;
  status: string;
};

// Course Types
export type CourseProgressDTO = {
  id: string;
  titleAr: string;
  progressPercentage: number;
  completedLessons: number;
  totalLessons: number;
  lastLessonId?: string;
};

export type CourseDetailDTO = {
  id: string;
  titleAr: string;
  descriptionAr?: string;
  description?: string;
  chapters?: ChapterDTO[];
};

export type ChapterDTO = {
  id: string;
  titleAr: string;
  units?: UnitDTO[];
};

export type UnitDTO = {
  id: string;
  titleAr: string;
  lessons?: LessonDTO[];
};

export type LessonDTO = {
  id: string;
  titleAr: string;
  contentType: string;
  isCompleted?: boolean;
};

// Payment / Order Types
export type OrderDTO = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
};

// Support Ticket Types
export type SupportTicketDTO = {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
};

// Admin API Types
export type AdminApiResponse<T> = {
  data: T;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    pageCount?: number;
    nextCursor?: string | null;
  };
  message?: string;
};

export type AdminApiError = {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
  traceId: string;
  conflict?: {
    currentVersion: number;
  };
};

export type AdminListMeta = {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

export type AdminListResult<T> = {
  items: T[];
  meta: AdminListMeta;
};

export type AdminLifecycleAction = 'ARCHIVE' | 'RESTORE' | 'PERMANENT_DELETE';

export type AdminDeletionBlocker = {
  code: string;
  label: string;
  count: number;
};

export type AdminAffectedChildren = {
  type: string;
  label: string;
  count: number;
};

export type AdminDeletionImpact = {
  id: string;
  resource: string;
  label: string;
  currentStatus: string;
  actions: AdminLifecycleAction[];
  blockers: AdminDeletionBlocker[];
  affectedChildren: AdminAffectedChildren[];
  requiresReason: boolean;
  requiresTypedConfirmation: boolean;
};
