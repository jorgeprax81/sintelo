import type { APIRoute } from 'astro';
import { pool } from '../../lib/db';

export const GET: APIRoute = async () => {
  const income = await pool.query(`
    SELECT periodo, revenue, cogs, gross_profit, sga, ebitda, ebit, net_income
    FROM clientes.income_statement
    WHERE empresa_id = 1
    ORDER BY periodo DESC
    LIMIT 2
  `);

  const balance = await pool.query(`
    SELECT periodo, cuentas_por_cobrar, inventario, ppe,
           total_activos, cuentas_por_pagar
    FROM clientes.balance_sheet
    WHERE empresa_id = 1
    ORDER BY periodo DESC
    LIMIT 1
  `);

  if (income.rows.length < 2 || balance.rows.length < 1) {
    return new Response(JSON.stringify({ error: 'Datos insuficientes para calcular value bridge.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const actual = income.rows[0];
  const prev = income.rows[1];
  const bal = balance.rows[0];

  const revenue = Number(actual.revenue);
  const ebitda = Number(actual.ebitda);
  const sgaAct = Number(actual.sga);
  const sgaPrev = Number(prev.sga);
  const revPrev = Number(prev.revenue);
  const inv = Number(bal.inventario);
  const cxc = Number(bal.cuentas_por_cobrar);
  const cxp = Number(bal.cuentas_por_pagar);

  const sgaRatioHist = Math.abs(sgaPrev) / revPrev;
  const leverSga = Math.abs(sgaAct) - (revenue * sgaRatioHist);
  const leverPricing = revenue * 0.01;
  const leverInv = inv * 0.20 * 0.10;
  const leverProc = Math.abs(Number(actual.cogs)) * 0.005;
  const leverWc = (cxc * 0.10 + cxp * 0.05) * 0.10;

  const potencial = ebitda + leverSga + leverPricing + leverInv + leverProc + leverWc;

  return new Response(JSON.stringify({
    empresa: 'Big Retailer Inc.',
    revenue,
    ebitda_actual: ebitda,
    ebitda_potencial: Math.round(potencial),
    margen_actual: parseFloat((ebitda / revenue * 100).toFixed(1)),
    margen_potencial: parseFloat((potencial / revenue * 100).toFixed(1)),
    levers: [
      { nombre: 'Normalizar SGA', palanca: 'Overhead', impacto: Math.round(leverSga), color: '#7F77DD', descripcion: 'SGA crecio por encima del revenue - recuperar ratio historico' },
      { nombre: 'Pricing mix', palanca: 'Revenue', impacto: Math.round(leverPricing), color: '#85B7EB', descripcion: '+1pp de margen bruto via mejora en mezcla de categorias' },
      { nombre: 'Inventario', palanca: 'Capital', impacto: Math.round(leverInv), color: '#9FE1CB', descripcion: 'Reduccion de inventario excesivo -> liberacion de costo de capital' },
      { nombre: 'Procurement', palanca: 'Costos', impacto: Math.round(leverProc), color: '#D3D1C7', descripcion: 'Negociacion de condiciones con proveedores clave' },
      { nombre: 'Working capital', palanca: 'Capital', impacto: Math.round(leverWc), color: '#9FE1CB', descripcion: 'Optimizacion de DSO y extension de DPO' }
    ]
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
};
