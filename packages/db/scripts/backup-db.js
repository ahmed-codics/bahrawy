const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("ERROR: DATABASE_URL environment variable is missing.");
  process.exit(1);
}

if (dbUrl.includes('neon.tech') && !process.env.CONFIRM_PROD_BACKUP) {
  console.error("ERROR: Refusing to backup a Neon production database without CONFIRM_PROD_BACKUP=true.");
  process.exit(1);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(__dirname, '..', 'backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const outputFile = path.join(backupDir, `backup-${timestamp}.sql`);

try {
  console.log(`Starting backup of database to ${outputFile}...`);
  const result = spawnSync('pg_dump', [dbUrl, '-F', 'p', '-f', outputFile], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });

  if (result.error || result.status !== 0) {
    throw new Error(result.error ? result.error.message : `pg_dump exited with code ${result.status}`);
  }

  const stat = fs.statSync(outputFile);
  if (stat.size === 0) {
    fs.unlinkSync(outputFile);
    throw new Error('pg_dump produced an empty file. Backup failed.');
  }

  console.log('Backup completed successfully. Size:', stat.size, 'bytes');
} catch (error) {
  console.error('Backup failed:', error.message);
  process.exit(1);
}
