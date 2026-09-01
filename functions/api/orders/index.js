import { json, errorJson } from '../../_lib/http.js';
import { ORDER_FIELDS, normalizeOrderBody } from '../../_lib/orderFields.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  const status = url.searchParams.get('status');

  let sql = 'SELECT * FROM orders';
  const conds = [];
  const params = [];
  if (date) { conds.push('delivery_date = ?'); params.push(date); }
  if (status) { conds.push('menu_status = ?'); params.push(status); }
  if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
  sql += ' ORDER BY delivery_date, delivery_time';

  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json(results);
}

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const b = normalizeOrderBody(body);
  if (!b.delivery_date || !b.customer_name) return errorJson('出貨日期與客戶姓名為必填');

  const cols = ORDER_FIELDS.join(', ');
  const placeholders = ORDER_FIELDS.map(() => '?').join(', ');
  const result = await env.DB.prepare(`INSERT INTO orders (${cols}) VALUES (${placeholders})`)
    .bind(...ORDER_FIELDS.map((f) => b[f]))
    .run();

  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(result.meta.last_row_id).first();
  return json(order);
}
