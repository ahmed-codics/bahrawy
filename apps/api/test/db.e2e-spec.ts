import '@bahrawy/config';
import { db } from '@bahrawy/db';

describe('Database Integration', () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it('should connect to the configured database', async () => {
    try {
      const result = await db.$queryRaw`SELECT 1 as result`;
      expect(result).toBeDefined();
    } catch (e: any) {
      console.error(e);
      throw e;
    }
  });
});
