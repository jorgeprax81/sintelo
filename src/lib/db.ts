import pg from 'pg';
const { Pool } = pg;

const _pools: Map<string, pg.Pool> = new Map();

const ENV_VAR_MAP: Record<string, string> = {
  bigretailer: 'BIGRETAILER_DATABASE_URL',
  adventureworks: 'ADVENTUREWORKS_DATABASE_URL',
};

export function getPool(cliente: string): pg.Pool {
  const key = cliente.toLowerCase();
  if (_pools.has(key)) {
    return _pools.get(key)!;
  }
  const envVar = ENV_VAR_MAP[key];
  if (!envVar) {
    throw new Error(`Cliente no registrado en getPool: ${cliente}. Agrégalo a ENV_VAR_MAP en src/lib/db.ts`);
  }
  const connectionString = process.env[envVar];
  if (!connectionString) {
    throw new Error(`${envVar} no está definida en el entorno`);
  }
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  _pools.set(key, pool);
  return pool;
}

// Compatibilidad con value-bridge.ts que importa { pool } directamente.
// Por convención, este alias apunta a bigretailer (el demo principal).
export const pool = new Proxy({} as pg.Pool, {
  get(_target, prop) {
    return (getPool('bigretailer') as any)[prop];
  }
});
