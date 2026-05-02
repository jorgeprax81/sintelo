export const prerender = false;

import type { APIRoute } from 'astro';
import { getPool } from '../../lib/db';
import { buildValueBridge, calcLevers, type BalanceRow, type IncomeRow } from '../../lib/roic-engine';

export const GET: APIRoute = async () => {
  try {
    const pool = getPool('bigretailer');

    const [incomeRes, balanceRes, cashFlowRes] = await Promise.all([
      pool.query(`
        SELECT periodo, revenue, sga, ebit, impuestos, ebt
        FROM clientes.income_statement
        WHERE empresa_id = 1
        ORDER BY periodo
      `),
      pool.query(`
        SELECT periodo, ppe, cuentas_por_cobrar, inventario, cuentas_por_pagar
        FROM clientes.balance_sheet
        WHERE empresa_id = 1
        ORDER BY periodo
      `),
      pool.query(`
        SELECT periodo, capex
        FROM clientes.cash_flow
        WHERE empresa_id = 1
        ORDER BY periodo
      `)
    ]);

    if (incomeRes.rows.length === 0 || balanceRes.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'No hay datos suficientes para calcular el value bridge.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const capexByPeriodo = new Map<string, number>(
      cashFlowRes.rows.map((row) => [String(row.periodo), Number(row.capex || 0)])
    );

    const incomeRows: IncomeRow[] = incomeRes.rows.map((row) => ({
      periodo: String(row.periodo),
      revenue: row.revenue,
      sga: row.sga,
      ebit: row.ebit,
      impuestos: row.impuestos,
      ebt: row.ebt,
      capex: capexByPeriodo.get(String(row.periodo)) ?? 0
    }));

    const balanceRows: BalanceRow[] = balanceRes.rows.map((row) => ({
      periodo: String(row.periodo),
      ppe: row.ppe,
      cuentas_por_cobrar: row.cuentas_por_cobrar,
      inventario: row.inventario,
      cuentas_por_pagar: row.cuentas_por_pagar
    }));

    const preferredPeriod = 'Year 7';
    const actualIncome = incomeRows.find((row) => row.periodo === preferredPeriod) ?? incomeRows[incomeRows.length - 1];
    const actualBalanceRaw = balanceRows.find((row) => row.periodo === actualIncome.periodo) ?? balanceRows[balanceRows.length - 1];

    const historicalInventories = balanceRows
      .filter((row) => row.periodo !== actualBalanceRaw.periodo)
      .map((row) => Number(row.inventario || 0));

    const inventarioPromedioHistorico = historicalInventories.length > 0
      ? historicalInventories.reduce((sum, value) => sum + value, 0) / historicalInventories.length
      : Number(actualBalanceRaw.inventario || 0);

    const actualBalance: BalanceRow = {
      ...actualBalanceRaw,
      inventario_promedio_historico: inventarioPromedioHistorico
    };

    const actualIndex = incomeRows.findIndex((row) => row.periodo === actualIncome.periodo);
    const rowsForEngine = actualIndex >= 0 ? incomeRows.slice(0, actualIndex + 1) : incomeRows;

    const levers = calcLevers(rowsForEngine, actualBalance);
    const bridge = buildValueBridge(actualIncome, actualBalance, levers);

    return new Response(JSON.stringify({
      empresa: 'Big Retailer Inc.',
      periodo: actualIncome.periodo,
      roic_actual: bridge.roic_actual,
      roic_potencial: bridge.roic_potencial,
      delta_roic_pp: bridge.delta_pp,
      total_value_bridge: bridge.total_valor,
      levers: bridge.levers
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Error calculando value bridge',
      detail: error instanceof Error ? error.message : 'Error desconocido'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
