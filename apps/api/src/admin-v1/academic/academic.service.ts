import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { db } from '@bahrawy/db';
import type { AdminDeletionImpact } from '@bahrawy/types';
import {
  CreateAcademicEntityDto,
  CreateAcademicYearDto,
  CreateCohortDto,
  CreateTermDto,
  UpdateAcademicEntityDto,
} from './academic.dto';
import {
  LifecycleMutationDto,
  PermanentDeleteDto,
} from '../common/dto/lifecycle.dto';
import { AdminAuditService } from '../common/services/audit.service';

type AcademicEntity = 'grades' | 'subjects';
type AdminActor = { id: string; organizationId: string };

@Injectable()
export class AdminV1AcademicService {
  constructor(private readonly audit: AdminAuditService) {}

  async overview(organizationId: string) {
    const [academicYears, grades, subjects, cohorts] = await Promise.all([
      db.academicYear.findMany({
        where: { organizationId },
        orderBy: { startsOn: 'desc' },
      }),
      db.grade.findMany({
        where: { organizationId },
        orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
        include: {
          _count: { select: { courses: true, studentProfiles: true } },
        },
      }),
      db.subject.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'asc' },
        include: { _count: { select: { courses: true } } },
      }),
      db.cohort.findMany({
        where: { organizationId },
        orderBy: { startsAt: 'desc' },
        include: {
          academicYear: true,
          grade: true,
          terms: { orderBy: { sort: 'asc' } },
        },
      }),
    ]);
    return { academicYears, grades, subjects, cohorts };
  }

  async createEntity(
    actor: AdminActor,
    entity: AcademicEntity,
    input: CreateAcademicEntityDto,
  ) {
    this.assertEntity(entity);
    const created =
      entity === 'grades'
        ? await db.grade.create({
            data: {
              organizationId: actor.organizationId,
              code: input.code,
              nameAr: input.nameAr,
              nameEn: input.nameEn,
              sort: input.sort ?? 0,
            },
          })
        : await db.subject.create({
            data: {
              organizationId: actor.organizationId,
              code: input.code,
              nameAr: input.nameAr,
              nameEn: input.nameEn,
            },
          });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: `${this.targetType(entity)}_CREATED`,
      targetType: this.targetType(entity),
      targetId: created.id,
      after: created,
    });
    return created;
  }

  async updateEntity(
    actor: AdminActor,
    entity: AcademicEntity,
    id: string,
    input: UpdateAcademicEntityDto,
  ) {
    this.assertEntity(entity);
    const existing =
      entity === 'grades'
        ? await db.grade.findFirst({
            where: { id, organizationId: actor.organizationId },
          })
        : await db.subject.findFirst({
            where: { id, organizationId: actor.organizationId },
          });
    if (!existing) throw new NotFoundException('Academic record not found');
    this.assertVersion(existing.version, input.version);
    const data = {
      nameAr: input.nameAr,
      nameEn: input.nameEn,
      status: input.status,
      archivedAt:
        input.status === 'ARCHIVED'
          ? new Date()
          : input.status === 'ACTIVE'
            ? null
            : undefined,
      version: { increment: 1 },
      ...(entity === 'grades' ? { sort: input.sort } : {}),
    };
    const updated =
      entity === 'grades'
        ? await db.grade.update({ where: { id }, data })
        : await db.subject.update({ where: { id }, data });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: `${this.targetType(entity)}_UPDATED`,
      targetType: this.targetType(entity),
      targetId: id,
      before: existing,
      after: updated,
    });
    return updated;
  }

  async createAcademicYear(actor: AdminActor, input: CreateAcademicYearDto) {
    this.assertDateRange(input.startsOn, input.endsOn);
    const created = await db.academicYear.create({
      data: {
        organizationId: actor.organizationId,
        label: input.label,
        startsOn: new Date(input.startsOn),
        endsOn: new Date(input.endsOn),
      },
    });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: 'ACADEMIC_YEAR_CREATED',
      targetType: 'ACADEMIC_YEAR',
      targetId: created.id,
      after: created,
    });
    return created;
  }

  async createCohort(actor: AdminActor, input: CreateCohortDto) {
    this.assertDateRange(input.startsAt, input.expiresAt);
    const [academicYear, grade] = await Promise.all([
      db.academicYear.findFirst({
        where: {
          id: input.academicYearId,
          organizationId: actor.organizationId,
        },
      }),
      db.grade.findFirst({
        where: { id: input.gradeId, organizationId: actor.organizationId },
      }),
    ]);
    if (!academicYear || !grade) {
      throw new BadRequestException('Academic year or grade is invalid');
    }
    const created = await db.cohort.create({
      data: {
        organizationId: actor.organizationId,
        academicYearId: input.academicYearId,
        gradeId: input.gradeId,
        startsAt: new Date(input.startsAt),
        expiresAt: new Date(input.expiresAt),
      },
      include: { academicYear: true, grade: true, terms: true },
    });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: 'COHORT_CREATED',
      targetType: 'COHORT',
      targetId: created.id,
      after: created,
    });
    return created;
  }

  async createTerm(actor: AdminActor, input: CreateTermDto) {
    this.assertDateRange(input.startsAt, input.endsAt);
    const cohort = await db.cohort.findFirst({
      where: { id: input.cohortId, organizationId: actor.organizationId },
    });
    if (!cohort) throw new NotFoundException('Cohort not found');
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (startsAt < cohort.startsAt || endsAt > cohort.expiresAt) {
      throw new BadRequestException(
        'Term dates must be inside the cohort date range',
      );
    }
    const created = await db.term.create({
      data: {
        cohortId: input.cohortId,
        code: input.code,
        titleAr: input.titleAr,
        titleEn: input.titleEn,
        startsAt,
        endsAt,
        sort: input.sort ?? 0,
      },
    });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: 'TERM_CREATED',
      targetType: 'TERM',
      targetId: created.id,
      after: created,
    });
    return created;
  }

  async reorderGrades(actor: AdminActor, ids: string[]) {
    const count = await db.grade.count({
      where: { organizationId: actor.organizationId, id: { in: ids } },
    });
    if (count !== ids.length) {
      throw new BadRequestException('One or more grades are invalid');
    }
    await db.$transaction(
      ids.map((id, sort) =>
        db.grade.update({
          where: { id },
          data: { sort, version: { increment: 1 } },
        }),
      ),
    );
    const grades = await db.grade.findMany({
      where: { organizationId: actor.organizationId },
      orderBy: { sort: 'asc' },
    });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: 'GRADE_REORDERED',
      targetType: 'GRADE',
      targetId: 'COLLECTION',
      after: { ids },
    });
    return grades;
  }

  async deletionImpact(
    organizationId: string,
    entity: AcademicEntity,
    id: string,
  ): Promise<AdminDeletionImpact> {
    this.assertEntity(entity);
    if (entity === 'grades') {
      const grade = await db.grade.findFirst({
        where: { id, organizationId },
        include: {
          _count: {
            select: {
              cohorts: true,
              courses: true,
              products: true,
              studentProfiles: true,
            },
          },
        },
      });
      if (!grade) throw new NotFoundException('Grade not found');
      const blockers = [
        {
          code: 'COURSES',
          label: 'كورسات مرتبطة',
          count: grade._count.courses,
        },
        {
          code: 'PRODUCTS',
          label: 'باقات مرتبطة',
          count: grade._count.products,
        },
        {
          code: 'STUDENTS',
          label: 'طلاب مرتبطون',
          count: grade._count.studentProfiles,
        },
        { code: 'COHORTS', label: 'دفعات مرتبطة', count: grade._count.cohorts },
      ].filter((item) => item.count > 0);
      return this.buildImpact(
        grade.id,
        'GRADE',
        grade.nameAr,
        grade.status,
        blockers,
      );
    }
    const subject = await db.subject.findFirst({
      where: { id, organizationId },
      include: { _count: { select: { courses: true } } },
    });
    if (!subject) throw new NotFoundException('Subject not found');
    const blockers = subject._count.courses
      ? [
          {
            code: 'COURSES',
            label: 'كورسات مرتبطة',
            count: subject._count.courses,
          },
        ]
      : [];
    return this.buildImpact(
      subject.id,
      'SUBJECT',
      subject.nameAr,
      subject.status,
      blockers,
    );
  }

  async setArchived(
    actor: AdminActor,
    entity: AcademicEntity,
    id: string,
    archived: boolean,
    input: LifecycleMutationDto,
  ) {
    const existing = await this.findEntity(actor.organizationId, entity, id);
    this.assertVersion(existing.version, input.version);
    const data = {
      status: archived ? 'ARCHIVED' : 'ACTIVE',
      archivedAt: archived ? new Date() : null,
      version: { increment: 1 },
    };
    const updated =
      entity === 'grades'
        ? await db.grade.update({ where: { id }, data })
        : await db.subject.update({ where: { id }, data });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: `${this.targetType(entity)}_${archived ? 'ARCHIVED' : 'RESTORED'}`,
      targetType: this.targetType(entity),
      targetId: id,
      before: existing,
      after: updated,
      reason: input.reason,
    });
    return updated;
  }

  async permanentlyDelete(
    actor: AdminActor,
    entity: AcademicEntity,
    id: string,
    input: PermanentDeleteDto,
  ) {
    const existing = await this.findEntity(actor.organizationId, entity, id);
    this.assertVersion(existing.version, input.version);
    const impact = await this.deletionImpact(actor.organizationId, entity, id);
    if (!impact.actions.includes('PERMANENT_DELETE')) {
      throw new ConflictException({
        code: 'DELETE_BLOCKED',
        message: 'This academic record is referenced and can only be archived',
      });
    }
    const expected = 'nameAr' in existing ? existing.nameAr : '';
    if (input.confirmation !== expected) {
      throw new BadRequestException('Typed confirmation does not match');
    }
    if (entity === 'grades') await db.grade.delete({ where: { id } });
    else await db.subject.delete({ where: { id } });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: `${this.targetType(entity)}_PERMANENTLY_DELETED`,
      targetType: this.targetType(entity),
      targetId: id,
      before: existing,
      reason: input.reason,
    });
    return { id };
  }

  private assertDateRange(start: string, end: string) {
    if (new Date(start) >= new Date(end)) {
      throw new BadRequestException('End date must be after start date');
    }
  }

  private assertEntity(entity: string): asserts entity is AcademicEntity {
    if (entity !== 'grades' && entity !== 'subjects') {
      throw new NotFoundException('Academic entity not found');
    }
  }

  private async findEntity(
    organizationId: string,
    entity: AcademicEntity,
    id: string,
  ) {
    this.assertEntity(entity);
    const found =
      entity === 'grades'
        ? await db.grade.findFirst({ where: { id, organizationId } })
        : await db.subject.findFirst({ where: { id, organizationId } });
    if (!found) throw new NotFoundException('Academic record not found');
    return found;
  }

  private assertVersion(currentVersion: number, version: number) {
    if (currentVersion !== version) {
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        message: 'This record was changed by another staff member',
        currentVersion,
      });
    }
  }

  private targetType(entity: AcademicEntity) {
    return entity === 'grades' ? 'GRADE' : 'SUBJECT';
  }

  private buildImpact(
    id: string,
    resource: string,
    label: string,
    status: string,
    blockers: Array<{ code: string; label: string; count: number }>,
  ): AdminDeletionImpact {
    return {
      id,
      resource,
      label,
      currentStatus: status,
      actions: [
        status === 'ARCHIVED' ? 'RESTORE' : 'ARCHIVE',
        ...(blockers.length === 0 ? (['PERMANENT_DELETE'] as const) : []),
      ],
      blockers,
      affectedChildren: blockers.map(({ code, label, count }) => ({
        type: code,
        label,
        count,
      })),
      requiresReason: true,
      requiresTypedConfirmation: blockers.length === 0,
    };
  }
}
