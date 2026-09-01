import { json, errorJson } from '../../_lib/http.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const category = url.searchParams.get('category');

  const rows = category
    ? (await env.DB.prepare('SELECT * FROM dishes WHERE category = ? ORDER BY name').bind(category).all()).results
    : (await env.DB.prepare('SELECT * FROM dishes ORDER BY category, name').all()).results;

  const withIngredients = [];
  for (const d of rows) {
    const { results: ingredients } = await env.DB
      .prepare('SELECT id, name, qty, unit FROM dish_ingredients WHERE dish_id = ?')
      .bind(d.id)
      .all();
    withIngredients.push({ ...d, ingredients });
  }
  return json(withIngredients);
}

export async function onRequestPost({ request, env }) {
  const b = await request.json().catch(() => ({}));
  if (!b.name || !b.category) return errorJson('name 與 category 為必填');

  const result = await env.DB.prepare(
    `INSERT INTO dishes (name, category, is_pork, protein_type, cooking_method, color_tag, is_spicy, is_soft, price, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      b.name,
      b.category,
      b.is_pork ? 1 : 0,
      b.protein_type || '素',
      b.cooking_method || '其他',
      b.color_tag || '其他',
      b.is_spicy ? 1 : 0,
      b.is_soft ? 1 : 0,
      b.price || 0,
      b.notes || ''
    )
    .run();

  const dishId = result.meta.last_row_id;
  if (Array.isArray(b.ingredients)) {
    for (const ing of b.ingredients) {
      if (ing.name && ing.qty != null && ing.unit) {
        await env.DB.prepare('INSERT INTO dish_ingredients (dish_id, name, qty, unit) VALUES (?, ?, ?, ?)')
          .bind(dishId, ing.name, ing.qty, ing.unit)
          .run();
      }
    }
  }

  const dish = await env.DB.prepare('SELECT * FROM dishes WHERE id = ?').bind(dishId).first();
  return json(dish);
}
