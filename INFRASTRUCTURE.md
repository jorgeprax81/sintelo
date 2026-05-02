# Infraestructura Sintelo

Single source of truth de la infraestructura técnica de Sintelo.
Última revisión: 2026-05-01

## Convenciones de código

### Conexión a bases de datos por cliente

Toda conexión a Postgres pasa por `src/lib/db.ts`:

```ts
import { getPool } from '../lib/db';
const pool = getPool('bigretailer');
```

Internamente:
- Cache de pools por cliente (lazy init).
- Cada cliente mapea a una env var en `ENV_VAR_MAP`.
- Falta env var → throw con mensaje claro.

**Para agregar un cliente nuevo:**
1. Agregar entrada a `ENV_VAR_MAP` en `src/lib/db.ts`
2. Crear env var `<CLIENTE>_DATABASE_URL` en Vercel (Production)
3. Usar `getPool('<cliente>')` en código

### Endpoints API

Todos los endpoints en `src/pages/api/*.ts` deben tener:

```ts
export const prerender = false;
```

### Multi-tenant dinámico

Cuando la connection string viene del usuario autenticado, se lee desde la
tabla `conexiones_railway` en Supabase. Ver patrón en `src/pages/api/upload.ts`.

## Railway

Project: **sintelo**

| Servicio | Schema(s) | Conectado a Vercel via |
|---|---|---|
| sintelo-bigretailer | clientes | BIGRETAILER_DATABASE_URL |
| sintelo-adventureworks | sales, production, person, etc. | ADVENTUREWORKS_DATABASE_URL |

## Vercel

- Project: **sintelo** (team "Sintelo's projects")
- Repo: github.com/sintelo-ai/sintelo
- Branch productivo: main
- Domain: sintelo.com (CNAME desde Namecheap)
- Adapter: @astrojs/vercel/serverless
- Output: hybrid (TODO: evaluar 'server')

### Environment variables (Production)

| Variable | Uso |
|---|---|
| BIGRETAILER_DATABASE_URL | Postgres Big Retailer |
| ADVENTUREWORKS_DATABASE_URL | Postgres AdventureWorks |
| PUBLIC_SUPABASE_URL | URL pública de Supabase |
| PUBLIC_SUPABASE_ANON_KEY | Anon key de Supabase |
| ANTHROPIC_API_KEY | Para api/diagnostico.ts |

## Supabase

- Project: sintelo-saas
- URL: https://dkzxpmmzaezawmdufsky.supabase.co
- Auth: magic link (login en /login, app en /app)

### Tablas (schema public)

| Tabla | Propósito |
|---|---|
| empresas | Clientes de Sintelo |
| usuarios | Acceso por empresa |
| suscripciones | Plan de cada cliente |
| conexiones_railway | URL de DB Railway por cliente |

## Mapa de endpoints/páginas → DB

| Ruta | DB | Mecanismo |
|---|---|---|
| /api/value-bridge | bigretailer | pool default de lib/db.ts |
| /demo/big-retailer | bigretailer | process.env directo |
| /demo/adventureworks | adventureworks | process.env directo |
| /api/diagnostico | adventureworks | process.env directo |
| /api/upload | dinámico | conexion.railway_db_url desde Supabase |

## Otros

- DNS: Namecheap (CNAME www → Vercel)
- Drive: "Sintelo — Clientes" (intake de archivos de cliente)
- GitHub org: sintelo-ai
- Node.js: pinned a 20.x en package.json engines

## Pendientes / Deuda técnica

- [ ] Rotar contraseñas de Postgres en Railway (expuestas en logs de chat)
- [ ] Evaluar output: 'server' en astro.config.mjs
- [ ] Inventariar Drive (carpetas vivas vs. abandonadas)
- [ ] Documentar flow completo cuando QLH entre a producción
