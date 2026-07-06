import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.ts';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

let pool: pg.Pool;

const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl) {
  console.log('Connecting to PostgreSQL using DATABASE_URL...');
  pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000, // Fail fast if unreachable
  });
} else {
  console.log('Connecting to PostgreSQL using detailed environment parameters...');
  pool = new Pool({
    host: process.env.SQL_HOST || process.env.PGHOST || 'localhost',
    port: parseInt(process.env.SQL_PORT || process.env.PGPORT || '5432', 10),
    user: process.env.SQL_USER || process.env.PGUSER || 'postgres',
    password: process.env.SQL_PASSWORD || process.env.PGPASSWORD,
    database: process.env.SQL_DB_NAME || process.env.PGDATABASE || 'postgres',
    connectionTimeoutMillis: 5000, // Fail fast if unreachable
  });
}

pool.on('error', (err) => {
  console.error('Unexpected error on idle SQL pool client:', err);
});

export const db = drizzle(pool, { schema });
export { pool };

export async function testDbConnection(): Promise<boolean> {
  if (!databaseUrl && !process.env.SQL_HOST) {
    console.log('No PostgreSQL configuration found in environment variables.');
    return false;
  }
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('PostgreSQL connection successful!');
    return true;
  } catch (err: any) {
    console.warn('PostgreSQL connection test failed:', err?.message || err);
    return false;
  }
}
