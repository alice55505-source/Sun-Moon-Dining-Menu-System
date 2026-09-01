import { json, errorJson } from '../../_lib/http.js';
import { validateMonthlyMenu } from '../../_lib/monthlyMenuRules.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7);

  const { results: items } = await env.DB.prepare(
    `SELECT mmi.id, mmi.month, mmi.slot_category, mmi.variant, mmi.sort_order, d.*
     FROM monthly_menu_items mmi JOIN dishes d ON d.id = mmi.dish_id
     WHERE mmi.month = ? ORDER BY mmi.slot_category, mmi.sort_order`
  )
    .bind(month)
    .all();

  const warnings = validateMonthlyMenu(
    items.map((it) => ({ slot_category: it.slot_category, variant: it.variant, dish: it }))
  );
  return json({ month, items, warnings });
}

export async function onRequestPost({ request, env }) {
  const b = await request.json().catch(() => ({}));
  const { month, slot_category, variant, dish_id, sort_order } = b;
  if (!month || !slot_category || !dish_id) return errorJson('month, slot_category, dish_id 為必填');

  const result = await env.DB.prepare(
    'INSERT INTO monthly_menu_items (month, slot_category, variant, dish_id, sort_order) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(month, slot_category, variant || '一般', dish_id, sort_order || 0)
    .run();

  return json({ id: result.meta.last_row_id });
}
