export type VideoLessonRecord = {
  id: string;
  lessonId: string;
  provider: 'YOUTUBE' | 'R2' | 'LOCAL';
  sourceRef: string;
  originalFileName?: string | null;
  mimeType?: string | null;
  durationSeconds: number;
  status: string;
};

export type QuestionOption = {
  id: string;
  text: string;
};

export type AssessmentRecord = {
  id: string;
  titleAr: string;
  type: 'HOMEWORK' | 'QUIZ' | string;
  durationMinutes: number;
  passingScore?: number | null;
  maxAttempts?: number | null;
  shuffleQuestions?: boolean;
  status: string;
  resultReleaseRule?: string;
  version: number;
  _count?: { questions: number };
  questions: Array<{
    sort: number;
    question: {
      id: string;
      titleAr: string;
      options: QuestionOption[];
      correctOptionId: string;
      explanation?: string | null;
      imageUrl?: string | null;
      points: number;
    };
  }>;
};

export type ContentItem = {
  id: string;
  titleAr: string;
  titleEn?: string | null;
  contentType: string;
  contentUrl: string | null;
  attachedPdfUrl?: string | null;
  homeworkPdfUrl?: string | null;
  durationSeconds?: number;
  status: string;
  version: number;
  videoLesson: VideoLessonRecord | null;
};

export type UnitRecord = {
  id: string;
  prerequisiteAssessmentId?: string | null;
  prerequisiteAssessment?: {
    id: string;
    titleAr: string;
    type: string;
  } | null;
  titleAr: string;
  titleEn?: string | null;
  sort: number;
  status: string;
  version: number;
  lessonProduct?: {
    id: string;
    titleAr: string;
    coverImageUrl?: string | null;
    prices?: Array<{ amount: number | string; currency: string }>;
  } | null;
  lessons: ContentItem[];
  assessments: AssessmentRecord[];
};

export type AssessmentPrerequisiteOption = {
  id: string;
  titleAr: string;
  type: string;
  unitId: string;
  unitTitleAr: string;
  position: number;
};

export type ChapterRecord = {
  id: string;
  titleAr: string;
  titleEn?: string | null;
  sort: number;
  status: string;
  version: number;
  units: UnitRecord[];
};

export type CourseWithContent = {
  id: string;
  code: string;
  titleAr: string;
  titleEn?: string | null;
  descriptionAr?: string | null;
  coverImageUrl?: string | null;
  status: string;
  publishAt?: string | null;
  unpublishAt?: string | null;
  version: number;
  courseProduct?: {
    id: string;
    titleAr: string;
    coverImageUrl?: string | null;
    prices?: Array<{ amount: number | string; currency: string }>;
  } | null;
  chapters: ChapterRecord[];
  assessmentByLessonId?: Record<string, AssessmentRecord>;
};
