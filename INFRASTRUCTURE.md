# Infraestructura Sintelo

Single source of truth de la infraestructura técnica de Sintelo.
Última revisión: 2026-05-01

## Convenciones de código

### Conexión a bases de datos por cliente

Toda conexión a Postgres pasa por `src/lib/db.ts`:

```ts
import { getPool } from '../lib/db';
const pool = getPool('bigretailer');  // o 'adventureworks', etc.
```

Internamente:
- Cache de pools por cliente (lazy init, una sola conexión por cliente por lambda).
- Cada cliente mapea a una env var en `ENV_VAR_MAP`.
- Falta env var → throw con mensaje claro (no ECONNREFUSED críptico).

**Para agregar un cliente nuevo:**
1. Agregar entrada a `ENV_VAR_MAP` en `src/lib/db.ts`
2. Crear env var `<CLIENTE>_DATABASE_URL` en Vercel (Production)
3. Usar `getPool('<cliente>')` en código

### Endpoints API

Todos los endpoints en `src/pages/api/*.ts` deben tener:

```ts
export const prerender = false;
```

Sin esto, Astro intenta ejecutarlos en build-time (sin acceso a env vars de runtime).

### Multi-tenant dinámico (vía Supabase)

Cuando la connection string viene del usuario autenticado (no de env var fija),
se lee desde la tabla `conexiones_railway` en Supabase. Ver patrón en
`src/pages/api/upload.ts`.

## Railway

Project: **sintelo**

| Servicio | Schema(s) | Tablas | Conectado a Vercel via |
|---|---|---|---|
| `sintelo-bigretailer` | `clientes` | 4 (empresas, income_statement, balance_sheet, cash_flow) | `BIGRETAILER_DATABASE_URL` |
| `sintelo-adventureworks` | `humanresources`, `person`, `production`, `purchasing`, `sales` | ~68 | `ADVENTUREWORKS_DATABASE_URL` |

## Vercel

- Project: **sintelo** (en team "Sintelo's projects")
- Repo: `github.com/sintelo-ai/sintelo`
- Branch productivo: `main`
- Domain: `sintelo.com` (CNAME desde Namecheap → Vercel)
- Adapter: `@astrojs/vercel/serverless`
- Output mode: `hybrid` (TODO: evaluar cambio a `server`)

### Environment variables (Production)

| Variable | Uso |
|---|---|
| `BIGRETAILER_DATABASE_URL` | Postgres de Big Retailer (demo + value bridge) |
| `ADVENTUREWORKS_DATABASE_URL` | Postgres de AdventureWorks (demo + diagnóstico) |
| `PUBLIC_SUPABASE_URL` | URL de Supabase (cliente browser) |
| `PUBLIC_SUPABASE_ANON_KEY` | Anon key de Supabase |
| `ANTHROPIC_API_KEY` | Para endpoint `api/diagnostico.ts` (LLM-as-SQL-translator) |

## Supabase

- Project: **sintelo-saas**
- URL: `https://dkzxpmmzaezawmdufsky.supabase.co`
- Auth: magic link

### Tablas (schema `public`)

| Tabla | Propósito |
|---|---|
| `empresas` | Clientes de Sintelo |
| `usuarios` | Acceso por empresa |
| `suscripciones` | Plan de cada cliente |
| `conexiones_railway` | URL de DB Railway por cliente (multi-tenant) |

## Mapa de endpoints/páginas → DB

| Ruta | DB | Mecanismo |
|---|---|---|
| `/api/value-bridge` | bigretailer | `pool` default de `lib/db.ts` |
| `/demo/big-retailer` | bigretailer | `process.env.BIGRETAILER_DATABASE_URL` directo |
| `/demo/adventureworks` | adventureworks | `process.env.ADVENTUREWORKS_DATABASE_URL` directo |
| `/api/diagnostico` | adventureworks | `process.env.ADVENTUREWORKS_DATABASE_URL` directo |
| `/api/upload` | dinámico por cliente | `conexion.railway_db_url` desde Supabase |

## Otros

- **DNS**: Namecheap (CNAME `www` → Vercel)
- **Drive**: `Sintelo — Clientes` (intake de archivos de cliente, Railway no soporta storage)
- **GitHub org**: `sintelo-ai`
- **Node.js**: pinned a `20.x` en `package.json` engines

## Pendientes / Deuda técnica

- [ ] Rotar contraseñas de Postgres en Railway (expuestas en logs de chat)
- [ ] Evaluar `output: 'server'` en `astro.config.mjs` (vs. `'hybrid'` actual)
- [ ] Inventariar Drive (carpetas vivas vs. abandonadas)
- [ ] Confirmar que GitHub Actions / Vercel deploy hooks no tienen credenciales hardcoded
- [ ] Documentar flow completo cuando QLH entre a producción (será el primer cliente real, no demo)

