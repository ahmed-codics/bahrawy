import { Injectable, NotFoundException } from '@nestjs/common';
import { db } from '@bahrawy/db';

@Injectable()
export class AdminAssessmentService {
  async listQuestions(organizationId: string, gradeId?: string) {
    const questions = await db.question.findMany({
      where: gradeId ? { organizationId, gradeId } : { organizationId },
      orderBy: { createdAt: 'desc' },
    });
    return { data: questions };
  }

  async getQuestionById(id: string) {
    const question = await db.question.findUnique({
      where: { id },
    });
    if (!question) throw new NotFoundException('Question not found');
    return { data: question };
  }

  async createQuestion(organizationId: string, data: any) {
    const question = await db.question.create({
      data: {
        organizationId,
        gradeId: data.gradeId || null,
        titleAr: data.titleAr,
        titleEn: data.titleEn,
        passage: data.passage,
        options: data.options || [],
        correctOptionId: data.correctOptionId,
        explanation: data.explanation,
        imageUrl: data.imageUrl,
        tags: data.tags || [],
        points: parseInt(data.points) || 1,
      },
    });
    return { data: question, message: 'تم إنشاء السؤال بنجاح' };
  }

  async updateQuestion(id: string, data: any) {
    const question = await db.question.update({
      where: { id },
      data: {
        titleAr: data.titleAr,
        titleEn: data.titleEn,
        passage: data.passage,
        options: data.options,
        correctOptionId: data.correctOptionId,
        explanation: data.explanation,
        imageUrl: data.imageUrl,
        tags: data.tags,
        points: data.points ? parseInt(data.points) : undefined,
      },
    });
    return { data: question, message: 'تم تحديث السؤال بنجاح' };
  }

  async deleteQuestion(id: string) {
    await db.question.delete({ where: { id } });
    return { message: 'تم حذف السؤال بنجاح' };
  }

  // --- Assessments ---
  async listAssessments(courseId: string) {
    const assessments = await db.assessment.findMany({
      where: { courseId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { questions: true },
        },
      },
    });
    return { data: assessments };
  }

  async getAssessmentByLesson(lessonId: string) {
    const assessment = await db.assessment.findFirst({
      where: { lessonId },
      include: {
        _count: {
          select: { questions: true },
        },
        questions: {
          include: { question: true },
          orderBy: { sort: 'asc' },
        },
      },
    });
    return { data: assessment };
  }

  async createAssessment(courseId: string, data: any) {
    const assessment = await db.assessment.create({
      data: {
        courseId,
        titleAr: data.titleAr,
        titleEn: data.titleEn,
        durationMinutes:
          data.durationMinutes === undefined
            ? 30
            : Number(data.durationMinutes),
        passingScore:
          data.passingScore === null || data.passingScore === undefined
            ? null
            : Number(data.passingScore),
        maxAttempts:
          data.maxAttempts === null || data.maxAttempts === undefined
            ? null
            : Number(data.maxAttempts),
        status: data.status || 'DRAFT',
      },
    });
    return { data: assessment, message: 'تم إنشاء التقييم بنجاح' };
  }

  async getAssessmentById(id: string) {
    const assessment = await db.assessment.findUnique({
      where: { id },
      include: {
        questions: {
          include: { question: true },
          orderBy: { sort: 'asc' },
        },
      },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    return { data: assessment };
  }
}
