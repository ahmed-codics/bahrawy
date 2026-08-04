const crypto = require('crypto');
const { Pool } = require('pg');

const encKey = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
const hmacKey = Buffer.from(process.env.HMAC_KEY, 'hex');

function decrypt(encryptedText) {
  const parts = encryptedText.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted text format');
  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const encrypted = Buffer.from(parts[2], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

function normalizePhone(phone) {
  const clean = phone.replace(/\D/g, '');
  if (clean.startsWith('01') && clean.length === 11) return `+20${clean.substring(1)}`;
  if (clean.startsWith('201') && clean.length === 12) return `+${clean}`;
  if (clean.startsWith('1') && clean.length === 10) return `+20${clean}`;
  if (!phone.startsWith('+')) return `+${clean}`;
  return `+${clean}`;
}

function phoneHmac(phone) {
  return crypto.createHmac('sha256', hmacKey).update(normalizePhone(phone)).digest('hex');
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const { rows } = await pool.query(
    'SELECT "id", "parentPhoneEncrypted" FROM "StudentProfile" WHERE "parentPhoneEncrypted" IS NOT NULL',
  );
  let updated = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const phone = decrypt(row.parentPhoneEncrypted);
      const hmac = phoneHmac(phone);
      await pool.query('UPDATE "StudentProfile" SET "parentPhoneHmac" = $1 WHERE "id" = $2', [
        hmac,
        row.id,
      ]);
      updated++;
    } catch (err) {
      failed++;
      console.warn('Backfill skip (unreadable legacy value):', row.id, err.message);
    }
  }
  console.log(`Backfilled parentPhoneHmac: ${updated} updated, ${failed} skipped.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
