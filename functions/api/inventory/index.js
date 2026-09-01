import { json, errorJson } from '../../_lib/http.js';
import { listInventory, upsertInventoryItem } from '../../_lib/inventory.js';

export async function onRequestGet({ env }) {
  return json(await listInventory(env.DB));
}

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const name = (body.name || '').trim();
  const unit = (body.unit || '').trim();
  const qty = Number(body.qty) || 0;
  if (!name || !unit) return errorJson('食材名稱與單位為必填');

  const item = await upsertInventoryItem(env.DB, { name, unit, qty });
  return json(item);
}
