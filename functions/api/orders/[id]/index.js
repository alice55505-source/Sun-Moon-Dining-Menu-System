import { json, errorJson } from '../../../_lib/http.js';
import { ORDER_FIELDS, normalizeOrderBody } from '../../../_lib/orderFields.js';

export async function onRequestGet({ params, env }) {
  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(params.id).first();
  if (!order) return errorJson('找不到訂單', 404);

  const { results: menuItems } = await env.DB
    .prepare(
      `SELECT omi.*, d.name AS dish_name, d.category AS dish_category FROM order_menu_items omi
       JOIN dishes d ON d.id = omi.dish_id WHERE omi.order_id = ? ORDER BY omi.sort_order`
    )
    .bind(order.id)
    .all();

  return json({ ...order, menuItems });
}

export async function onRequestPut({ request, params, env }) {
  const existing = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(params.id).first();
  if (!existing) return errorJson('找不到訂單', 404);

  const body = await request.json().catch(() => ({}));
  const merged = normalizeOrderBody({ ...existing, ...body });
  const setSql = ORDER_FIELDS.map((f) => `${f}=?`).join(', ');

  await env.DB.prepare(`UPDATE orders SET ${setSql}, updated_at=datetime('now') WHERE id=?`)
    .bind(...ORDER_FIELDS.map((f) => merged[f]), params.id)
    .run();

  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(params.id).first();
  return json(order);
}

export async function onRequestDelete({ params, env }) {
  await env.DB.prepare('DELETE FROM orders WHERE id = ?').bind(params.id).run();
  return json({ ok: true });
}
