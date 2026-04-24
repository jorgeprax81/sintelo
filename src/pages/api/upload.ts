import type { APIRoute } from 'astro';
import { createServerClient } from '@supabase/ssr';
import pg from 'pg';
import * as XLSX from 'xlsx';

const { Pool } = pg;

export const prerender = false;

const FAMILIAS: Record<string, string> = {
  'MOLIDO': 'Molido',
  'OAXACA': 'Oaxaca',
  'PANELA': 'Panela',
  'ASADERO': 'Asadero',
  'REQUESON': 'Requesón',
  'CUAJADA': 'Cuajada',
  'YOGURT': 'Yogurt',
  'CREMA': 'Crema',
  'SUERO': 'Suero',
  'GRASA': 'Grasa',
  'CHEDDAR': 'Cheddar',
  'MONTERREY': 'Monterrey Jack',
};

function extraerFamilia(producto: string): string {
  const p = (producto || '').toUpperCase();
  for (const [key, nombre] of Object.entries(FAMILIAS)) {
    if (p.includes(key)) return nombre;
  }
  return 'Otro';
}

function limpiarNumero(val: any): number {
  if (val === null || val === undefined) return 0;
  const str = String(val).replace(/[$,\s]/g, '');
  return parseFloat(str) || 0;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // 1. Verificar sesión
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name) { return cookies.get(name)?.value; },
        set() {},
        remove() {},
      }
    });

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
    }

    const email = session.user.email;

    // 2. Obtener empresa y DB del usuario
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('empresa_id')
      .eq('email', email)
      .single();

    if (!usuario) {
      return new Response(JSON.stringify({ error: 'Usuario no encontrado en el sistema' }), { status: 404 });
    }

    const { data: conexion } = await supabase
      .from('conexiones_railway')
      .select('railway_db_url')
      .eq('empresa_id', usuario.empresa_id)
      .single();

    if (!conexion) {
      return new Response(JSON.stringify({ error: 'No hay base de datos configurada para esta empresa' }), { status: 404 });
    }

    // 3. Leer archivo
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const tipo = formData.get('tipo') as string;

    if (!file) {
      return new Response(JSON.stringify({ error: 'No se recibió ningún archivo' }), { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    // 4. Parsear según tipo
    if (tipo === 'ventas') {
      // Buscar fila de headers (contiene CLIENTE, PRODUCTO, IMPORTE)
      let headerRow = -1;
      for (let i = 0; i < Math.min(10, rows.length); i++) {
        const row = rows[i];
        if (row && row.some((cell: any) => String(cell || '').toUpperCase().includes('PRODUCTO'))) {
          headerRow = i;
          break;
        }
      }

      if (headerRow === -1) {
        return new Response(JSON.stringify({ error: 'No se encontraron los encabezados del archivo' }), { status: 400 });
      }

      const headers: string[] = rows[headerRow].map((h: any) => String(h || '').toUpperCase().trim());
      const idx = {
        tipo_cliente: headers.findIndex(h => h === 'CLIENTE'),
        razon_social: headers.findIndex(h => h.includes('RAZON') || h.includes('RAZÓN')),
        rfc: headers.findIndex(h => h === 'RFC'),
        pedido: headers.findIndex(h => h === 'PEDIDO'),
        serie: headers.findIndex(h => h === 'SERIE'),
        folio: headers.findIndex(h => h === 'FOLIO'),
        fecha: headers.findIndex(h => h === 'FECHA'),
        estatus: headers.findIndex(h => h === 'ESTATUS'),
        producto: headers.findIndex(h => h === 'PRODUCTO'),
        cantidad: headers.findIndex(h => h === 'CANTIDAD'),
        precio: headers.findIndex(h => h === 'PRECIO'),
        importe: headers.findIndex(h => h === 'IMPORTE'),
        uuid: headers.findIndex(h => h === 'UUID'),
      };

      const registros: any[] = [];

      for (let i = headerRow + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[idx.producto]) continue;

        const estatus = String(row[idx.estatus] || '').trim();
        if (estatus !== 'Vigente') continue;

        const importe = limpiarNumero(row[idx.importe]);
        if (importe <= 0) continue;

        let fecha: Date | null = null;
        const fechaRaw = row[idx.fecha];
        if (fechaRaw instanceof Date) {
          fecha = fechaRaw;
        } else if (typeof fechaRaw === 'string') {
          fecha = new Date(fechaRaw);
        }
        if (!fecha || isNaN(fecha.getTime())) continue;

        const producto = String(row[idx.producto] || '').trim();

        registros.push([
          fecha,
          String(row[idx.folio] || '').trim() || null,
          String(row[idx.serie] || '').trim() || null,
          String(row[idx.tipo_cliente] || '').trim() || null,
          String(row[idx.razon_social] || '').trim() || null,
          String(row[idx.rfc] || '').trim() || null,
          producto,
          extraerFamilia(producto),
          limpiarNumero(row[idx.cantidad]),
          limpiarNumero(row[idx.precio]),
          importe,
          String(row[idx.uuid] || '').trim() || null,
        ]);
      }

      if (registros.length === 0) {
        return new Response(JSON.stringify({ error: 'No se encontraron registros vigentes en el archivo' }), { status: 400 });
      }

      // 5. Cargar a Railway
      const pool = new Pool({
        connectionString: conexion.railway_db_url,
        ssl: { rejectUnauthorized: false }
      });

      const client = await pool.connect();
      try {
        await client.query(`
          CREATE SCHEMA IF NOT EXISTS qlh;
          CREATE TABLE IF NOT EXISTS qlh.ventas (
            id            SERIAL PRIMARY KEY,
            fecha         DATE,
            folio         VARCHAR(50),
            serie         VARCHAR(10),
            tipo_cliente  VARCHAR(100),
            razon_social  VARCHAR(200),
            rfc           VARCHAR(20),
            producto      VARCHAR(200),
            familia       VARCHAR(100),
            cantidad      NUMERIC(12,2),
            precio        NUMERIC(12,2),
            importe       NUMERIC(14,2),
            uuid          VARCHAR(100),
            cargado_en    TIMESTAMP DEFAULT NOW()
          );
        `);

        await client.query('TRUNCATE TABLE qlh.ventas RESTART IDENTITY;');

        // Insertar en lotes de 500
        const loteSize = 500;
        for (let i = 0; i < registros.length; i += loteSize) {
          const lote = registros.slice(i, i + loteSize);
          const values = lote.map((_, j) => {
            const base = j * 12;
            return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9},$${base+10},$${base+11},$${base+12})`;
          }).join(',');
          const flat = lote.flat();
          await client.query(`
            INSERT INTO qlh.ventas (fecha,folio,serie,tipo_cliente,razon_social,rfc,producto,familia,cantidad,precio,importe,uuid)
            VALUES ${values}
          `, flat);
        }

        const { rows: [{ count }] } = await client.query('SELECT COUNT(*) FROM qlh.ventas');

        return new Response(JSON.stringify({
          message: `${Number(count).toLocaleString('es-MX')} registros cargados exitosamente`
        }), { status: 200 });

      } finally {
        client.release();
        await pool.end();
      }
    }

    return new Response(JSON.stringify({ error: 'Tipo de datos no soportado' }), { status: 400 });

  } catch (err: any) {
    console.error('Upload error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Error interno del servidor' }), { status: 500 });
  }
};
