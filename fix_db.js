const { Client } = require('pg');

async function fix() {
  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@localhost:5432/bahrawy_dev'
  });
  await client.connect();
  
  await client.query(`UPDATE "Course" SET status='PUBLISHED';`);
  await client.query(`UPDATE "Chapter" SET status='PUBLISHED';`);
  await client.query(`UPDATE "Unit" SET status='PUBLISHED';`);
  await client.query(`UPDATE "Lesson" SET status='PUBLISHED';`);
  
  console.log('All statuses updated to PUBLISHED.');
  await client.end();
}

fix().catch(console.error);
