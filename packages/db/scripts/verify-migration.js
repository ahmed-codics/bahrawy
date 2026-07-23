const fs = require('fs');
const path = require('path');
const { PGlite } = require('@electric-sql/pglite');

const migrationsDirectory = path.join(__dirname, '..', 'prisma', 'migrations');
const databaseDirectory = path.join(__dirname, '..', 'temp-db');

async function deployMigrations(db) {
  const migrationDirectories = fs
    .readdirSync(migrationsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const migrationName of migrationDirectories) {
    const migrationPath = path.join(
      migrationsDirectory,
      migrationName,
      'migration.sql',
    );
    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log(`Applying ${migrationName}...`);
    await db.exec(sql);
  }
}

async function verifySchema(db) {
  const { rows: columns } = await db.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (
        (table_name = 'Course' AND column_name IN ('subjectId', 'termId', 'publishAt', 'version'))
        OR (table_name = 'Lesson' AND column_name IN ('publishAt', 'unpublishAt', 'archivedAt', 'version'))
        OR (table_name = 'SupportTicket' AND column_name IN ('priority', 'assignedStaffId', 'version'))
        OR (table_name = 'SupportMessage' AND column_name IN ('authorKind', 'authorAccountId'))
      )
  `);
  const found = new Set(
    columns.map(({ table_name, column_name }) => `${table_name}.${column_name}`),
  );
  const expected = [
    'Course.subjectId',
    'Course.termId',
    'Course.publishAt',
    'Course.version',
    'Lesson.publishAt',
    'Lesson.unpublishAt',
    'Lesson.archivedAt',
    'Lesson.version',
    'SupportTicket.priority',
    'SupportTicket.assignedStaffId',
    'SupportTicket.version',
    'SupportMessage.authorKind',
    'SupportMessage.authorAccountId',
  ];
  const missing = expected.filter((column) => !found.has(column));
  if (missing.length) {
    throw new Error(`Missing migrated columns: ${missing.join(', ')}`);
  }

  const { rows: enumRows } = await db.query(`
    SELECT typname
    FROM pg_type
    WHERE typname IN (
      'PublishStatus',
      'SupportTicketStatus',
      'SupportPriority',
      'SupportAuthorKind'
    )
  `);
  if (enumRows.length !== 4) {
    throw new Error('One or more Phase 1 enums are missing');
  }

  await db.exec(`
    INSERT INTO "Organization" (
      "id", "name", "slug", "createdAt", "updatedAt"
    ) VALUES (
      'migration-check-org',
      'Migration Check',
      'migration-check',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    );

    INSERT INTO "Course" (
      "id", "organizationId", "code", "titleAr", "status", "createdAt", "updatedAt"
    ) VALUES (
      'migration-check-course',
      'migration-check-org',
      'migration-check',
      'Migration Check',
      'DRAFT',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    );
  `);
  const { rows: courseRows } = await db.query(`
    SELECT "status"::text AS status, "version"
    FROM "Course"
    WHERE "id" = 'migration-check-course'
  `);
  if (courseRows[0]?.status !== 'DRAFT' || courseRows[0]?.version !== 1) {
    throw new Error('Phase 1 lifecycle defaults are incorrect');
  }
}

async function main() {
  if (fs.existsSync(databaseDirectory)) {
    fs.rmSync(databaseDirectory, { recursive: true, force: true });
  }
  const db = new PGlite(databaseDirectory);

  try {
    console.log('Starting disposable PGlite PostgreSQL database...');
    await db.waitReady;
    await deployMigrations(db);
    await verifySchema(db);
    console.log('Migration verification passed on the disposable database.');
  } finally {
    await db.close();
    if (fs.existsSync(databaseDirectory)) {
      fs.rmSync(databaseDirectory, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  console.error('Migration verification failed:', error.message);
  process.exitCode = 1;
});
