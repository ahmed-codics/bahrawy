import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { db } from '@bahrawy/db';
import {
  CreateAcademicEntityDto,
  CreateAcademicYearDto,
  CreateCohortDto,
  CreateTermDto,
  UpdateAcademicEntityDto,
} from './academic.dto';

type AcademicEntity = 'grades' | 'subjects';

@Injectable()
export class AdminV1AcademicService {
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
    organizationId: string,
    entity: AcademicEntity,
    input: CreateAcademicEntityDto,
  ) {
    this.assertEntity(entity);
    if (entity === 'grades') {
      return db.grade.create({
        data: {
          organizationId,
          code: input.code,
          nameAr: input.nameAr,
          nameEn: input.nameEn,
          sort: input.sort ?? 0,
        },
      });
    }
    return db.subject.create({
      data: {
        organizationId,
        code: input.code,
        nameAr: input.nameAr,
        nameEn: input.nameEn,
      },
    });
  }

  async updateEntity(
    organizationId: string,
    entity: AcademicEntity,
    id: string,
    input: UpdateAcademicEntityDto,
  ) {
    this.assertEntity(entity);
    const existing =
      entity === 'grades'
        ? await db.grade.findFirst({ where: { id, organizationId } })
        : await db.subject.findFirst({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException('Academic record not found');
    if (input.version && existing.version !== input.version) {
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        message: 'This record was changed by another staff member',
      });
    }
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
    return entity === 'grades'
      ? db.grade.update({ where: { id }, data })
      : db.subject.update({ where: { id }, data });
  }

  async createAcademicYear(
    organizationId: string,
    input: CreateAcademicYearDto,
  ) {
    this.assertDateRange(input.startsOn, input.endsOn);
    return db.academicYear.create({
      data: {
        organizationId,
        label: input.label,
        startsOn: new Date(input.startsOn),
        endsOn: new Date(input.endsOn),
      },
    });
  }

  async createCohort(organizationId: string, input: CreateCohortDto) {
    this.assertDateRange(input.startsAt, input.expiresAt);
    const [academicYear, grade] = await Promise.all([
      db.academicYear.findFirst({
        where: { id: input.academicYearId, organizationId },
      }),
      db.grade.findFirst({
        where: { id: input.gradeId, organizationId },
      }),
    ]);
    if (!academicYear || !grade) {
      throw new BadRequestException('Academic year or grade is invalid');
    }
    return db.cohort.create({
      data: {
        organizationId,
        academicYearId: input.academicYearId,
        gradeId: input.gradeId,
        startsAt: new Date(input.startsAt),
        expiresAt: new Date(input.expiresAt),
      },
      include: { academicYear: true, grade: true, terms: true },
    });
  }

  async createTerm(organizationId: string, input: CreateTermDto) {
    this.assertDateRange(input.startsAt, input.endsAt);
    const cohort = await db.cohort.findFirst({
      where: { id: input.cohortId, organizationId },
    });
    if (!cohort) throw new NotFoundException('Cohort not found');
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (startsAt < cohort.startsAt || endsAt > cohort.expiresAt) {
      throw new BadRequestException(
        'Term dates must be inside the cohort date range',
      );
    }
    return db.term.create({
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
  }

  async reorderGrades(organizationId: string, ids: string[]) {
    const count = await db.grade.count({
      where: { organizationId, id: { in: ids } },
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
    return db.grade.findMany({
      where: { organizationId },
      orderBy: { sort: 'asc' },
    });
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
}
