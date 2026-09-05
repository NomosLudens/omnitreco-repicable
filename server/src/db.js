import pg from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

export const pool = new pg.Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export async function testDb() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT 1 as ok');
    return res.rows[0].ok === 1;
  } finally {
    client.release();
  }
}
