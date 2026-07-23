import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// Set DATABASE_URL before PrismaClient is imported
process.env.DATABASE_URL = 'postgresql://mock';
import { PrismaClient } from './generated/client';

describe('Database Connection', () => {
  let pool: Pool;
  let prisma: PrismaClient;

  beforeAll(() => {
    pool = new Pool({
      connectionString: 'postgresql://academy:academy_secret@127.0.0.1:5432/bahrawy_db',
    });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

  it('should initialize the prisma client without crashing', () => {
    expect(prisma).toBeDefined();
  });
});
