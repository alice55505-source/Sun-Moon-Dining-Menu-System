import { json, errorJson } from '../../_lib/http.js';

export async function onRequestPut({ request, params, env }) {
  const existing = await env.DB.prepare('SELECT * FROM inventory_items WHERE id = ?').bind(params.id).first();
  if (!existing) return errorJson('找不到食材', 404);

  const body = await request.json().catch(() => ({}));
  const name = body.name != null ? String(body.name).trim() : existing.name;
  const unit = body.unit != null ? String(body.unit).trim() : existing.unit;
  const qty = body.qty != null ? Number(body.qty) || 0 : existing.qty;
  if (!name || !unit) return errorJson('食材名稱與單位為必填');

  await env.DB.prepare(`UPDATE inventory_items SET name=?, unit=?, qty=?, updated_at=datetime('now') WHERE id=?`)
    .bind(name, unit, qty, params.id)
    .run();

  const item = await env.DB.prepare('SELECT * FROM inventory_items WHERE id = ?').bind(params.id).first();
  return json(item);
}

export async function onRequestDelete({ params, env }) {
  await env.DB.prepare('DELETE FROM inventory_items WHERE id = ?').bind(params.id).run();
  return json({ ok: true });
}
