import { json, errorJson } from '../../_lib/http.js';
import { BENTO_ORDER_FIELDS, normalizeBentoOrderBody } from '../../_lib/bentoOrderFields.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  const status = url.searchParams.get('status');

  let sql = 'SELECT * FROM bento_orders';
  const conds = [];
  const params = [];
  if (date) { conds.push('delivery_date = ?'); params.push(date); }
  if (status) { conds.push('menu_status = ?'); params.push(status); }
  if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
  sql += ' ORDER BY delivery_date, meal_period';

  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json(results);
}

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const b = normalizeBentoOrderBody(body);
  if (!b.delivery_date || !b.vendor_name) return errorJson('出貨日期與廠商名稱為必填');
  if (!b.price_tier) return errorJson('價位為必填');

  const cols = BENTO_ORDER_FIELDS.join(', ');
  const placeholders = BENTO_ORDER_FIELDS.map(() => '?').join(', ');
  const result = await env.DB.prepare(`INSERT INTO bento_orders (${cols}) VALUES (${placeholders})`)
    .bind(...BENTO_ORDER_FIELDS.map((f) => b[f]))
    .run();

  const order = await env.DB.prepare('SELECT * FROM bento_orders WHERE id = ?').bind(result.meta.last_row_id).first();
  return json(order);
}
