import pg from 'pg';
const { Pool } = pg;

let _pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!_pool) {
    const connectionString = process.env.BIGRETAILER_DATABASE_URL;
    if (!connectionString) {
      throw new Error('BIGRETAILER_DATABASE_URL no está definida en el entorno');
    }
    _pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false }
    });
  }
  return _pool;
}

export const pool = new Proxy({} as pg.Pool, {
  get(_target, prop) {
    return (getPool() as any)[prop];
  }
});
