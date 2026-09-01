import { json, errorJson } from '../../_lib/http.js';
import { validateMonthlyMenu } from '../../_lib/monthlyMenuRules.js';

export async function onRequestPost({ request, env }) {
  const b = await request.json().catch(() => ({}));
  const { items } = b; // [{slot_category, variant, dish_id}]
  if (!Array.isArray(items)) return errorJson('items 為必填陣列');

  const resolved = [];
  for (const it of items) {
    const dish = await env.DB.prepare('SELECT * FROM dishes WHERE id = ?').bind(it.dish_id).first();
    if (dish) resolved.push({ slot_category: it.slot_category, variant: it.variant, dish });
  }
  return json({ warnings: validateMonthlyMenu(resolved) });
}
