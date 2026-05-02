export const prerender = false;

import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  const levers = [
    {
      nombre: 'Reducir SG&A / Overhead',
      palanca: 'A (Margen)',
      impacto: 11000,
      color: '#7F77DD',
      descripcion: 'SG&A crecio 25% en 8 anos. Revenue crecio 15%.',
      unidad: 'NOPAT'
    },
    {
      nombre: 'Criterio ROIC en capex',
      palanca: 'B (Capital)',
      impacto: 8000,
      color: '#85B7EB',
      descripcion: '$126B en capex en 4 anos sin criterio de ROIC minimo',
      unidad: 'capital liberado',
      frecuencia: 'anual'
    },
    {
      nombre: 'Normalizar inventario',
      palanca: 'B (Capital)',
      impacto: 17000,
      color: '#9FE1CB',
      descripcion: 'Inventario salto $20B en Year 7 sin crecimiento de revenue',
      unidad: 'capital liberado'
    }
  ];

  const totalValueBridge = levers.reduce((sum, lever) => sum + lever.impacto, 0);

  return new Response(JSON.stringify({
    empresa: 'Big Retailer Inc.',
    roic_actual: 10.1,
    roic_potencial: 13.5,
    delta_roic_pp: 3.4,
    total_value_bridge: totalValueBridge,
    levers
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
};
