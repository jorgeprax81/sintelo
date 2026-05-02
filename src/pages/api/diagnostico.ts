import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';
import pg from 'pg';

const { Pool } = pg;
export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { pregunta, sql: sqlOverride } = await request.json();

    const schema = `
      Tablas disponibles en PostgreSQL:
      - sales.salesorderheader: salesorderid, orderdate, status(5=completada), totaldue, customerid, territoryid
      - sales.salesorderdetail: salesorderid, orderqty, productid, unitprice, unitpricediscount, linetotal
      - production.product: productid, name, standardcost, listprice, productsubcategoryid
      - production.productsubcategory: productsubcategoryid, productcategoryid, name
      - production.productcategory: productcategoryid, name
      - production.productcosthistory: productid, startdate, enddate, standardcost
      - production.productinventory: productid, locationid, quantity
      - sales.salesterritory: territoryid, name, "group"
      - purchasing.purchaseorderheader: purchaseorderid, orderdate, shipdate, totaldue
      - purchasing.purchaseorderdetail: purchaseorderid, productid, orderqty, unitprice, linetotal

      IMPORTANTE: 
      - Todos los nombres de columnas y tablas van en MINÚSCULAS
      - Filtra SIEMPRE status=5 en salesorderheader
      - Devuelve SOLO el SQL sin markdown ni explicaciones
    `;

    const client = new Anthropic({
      apiKey: import.meta.env.ANTHROPIC_API_KEY
    });

    const sqlResponse = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{ role: 'user', content: `${schema}\n\nPregunta: ${pregunta}\n\nSQL:` }]
    });

    const sql = sqlOverride || sqlResponse.content[0].type === 'text' 
      ? sqlResponse.content[0].text.trim().replace(/```sql|```/g, '').trim()
      : '';

    const pool = new Pool({
      connectionString: process.env.ADVENTUREWORKS_DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    let datos = [];
    let columnas = [];
    let sqlError = null;

    try {
      const result = await pool.query(sql);
      datos = result.rows;
      columnas = result.fields.map((f: any) => f.name);
    } catch (err: any) {
      sqlError = err.message;
    } finally {
      await pool.end();
    }

    const interpretacion = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Eres Sintelo, motor de diagnóstico financiero para empresas medianas en México.
        El usuario preguntó: "${pregunta}"
        ${sqlError ? `Hubo un error al ejecutar el SQL: ${sqlError}. Explica que no pudiste calcular esto y sugiere una pregunta alternativa.` : `Los datos son: ${JSON.stringify(datos.slice(0, 20))}`}
        Da un análisis ejecutivo conciso en español, máximo 3 párrafos.
        Declara si los cálculos son proxies operativos.`
      }]
    });

    const analisis = interpretacion.content[0].type === 'text' 
      ? interpretacion.content[0].text 
      : '';

    return new Response(JSON.stringify({ sql, columnas, datos, analisis, sqlError }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ 
      error: err.message,
      stack: err.stack?.split('\n').slice(0, 5)
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
