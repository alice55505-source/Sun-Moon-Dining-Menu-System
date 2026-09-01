import { json, errorJson } from '../../_lib/http.js';
import { validateMonthlyMenu, summarizeMonthRepeats } from '../../_lib/monthlyMenuRules.js';

function lastDayOfMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return String(new Date(y, m, 0).getDate()).padStart(2, '0');
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7);
  const from = `${month}-01`;
  const to = `${month}-${lastDayOfMonth(month)}`;

  const { results: rows } = await env.DB.prepare(
    `SELECT bmi.id, bmi.menu_date, bmi.slot_category, bmi.variant, bmi.sort_order, d.*
     FROM bento_menu_items bmi JOIN dishes d ON d.id = bmi.dish_id
     WHERE bmi.menu_date >= ? AND bmi.menu_date <= ?
     ORDER BY bmi.menu_date, bmi.slot_category, bmi.sort_order`
  )
    .bind(from, to)
    .all();

  const byDate = new Map();
  for (const row of rows) {
    if (!byDate.has(row.menu_date)) byDate.set(row.menu_date, []);
    byDate.get(row.menu_date).push(row);
  }

  const days = Array.from(byDate.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, items]) => ({
      date,
      items,
      warnings: validateMonthlyMenu(
        items.map((it) => ({ slot_category: it.slot_category, variant: it.variant, dish: it }))
      ),
    }));

  const monthSummary = summarizeMonthRepeats(
    days.map((d) => ({
      date: d.date,
      items: d.items.map((it) => ({ slot_category: it.slot_category, variant: it.variant, dish: it })),
    }))
  );

  return json({ month, days, monthSummary });
}

export async function onRequestPost({ request, env }) {
  const b = await request.json().catch(() => ({}));
  const { date, slot_category, variant, dish_id, sort_order } = b;
  if (!date || !slot_category || !dish_id) return errorJson('date, slot_category, dish_id 為必填');

  const result = await env.DB.prepare(
    'INSERT INTO bento_menu_items (menu_date, slot_category, variant, dish_id, sort_order) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(date, slot_category, variant || '一般', dish_id, sort_order || 0)
    .run();

  return json({ id: result.meta.last_row_id });
}
