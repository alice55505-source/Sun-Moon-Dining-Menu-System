import { json, errorJson } from '../../../_lib/http.js';
import { BENTO_ORDER_FIELDS, normalizeBentoOrderBody } from '../../../_lib/bentoOrderFields.js';

export async function onRequestGet({ params, env }) {
  const order = await env.DB.prepare('SELECT * FROM bento_orders WHERE id = ?').bind(params.id).first();
  if (!order) return errorJson('找不到訂單', 404);
  return json(order);
}

export async function onRequestPut({ request, params, env }) {
  const existing = await env.DB.prepare('SELECT * FROM bento_orders WHERE id = ?').bind(params.id).first();
  if (!existing) return errorJson('找不到訂單', 404);

  const body = await request.json().catch(() => ({}));
  const merged = normalizeBentoOrderBody({ ...existing, ...body });
  const setSql = BENTO_ORDER_FIELDS.map((f) => `${f}=?`).join(', ');
  const menuStatus = body.menu_status || existing.menu_status;

  await env.DB.prepare(`UPDATE bento_orders SET ${setSql}, menu_status=?, updated_at=datetime('now') WHERE id=?`)
    .bind(...BENTO_ORDER_FIELDS.map((f) => merged[f]), menuStatus, params.id)
    .run();

  const order = await env.DB.prepare('SELECT * FROM bento_orders WHERE id = ?').bind(params.id).first();
  return json(order);
}

export async function onRequestDelete({ params, env }) {
  await env.DB.prepare('DELETE FROM bento_orders WHERE id = ?').bind(params.id).run();
  return json({ ok: true });
}
