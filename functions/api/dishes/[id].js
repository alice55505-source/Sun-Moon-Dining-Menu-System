import { json, errorJson } from '../../_lib/http.js';

export async function onRequestGet({ params, env }) {
  const dish = await env.DB.prepare('SELECT * FROM dishes WHERE id = ?').bind(params.id).first();
  if (!dish) return errorJson('找不到菜色', 404);
  const { results: ingredients } = await env.DB
    .prepare('SELECT id, name, qty, unit FROM dish_ingredients WHERE dish_id = ?')
    .bind(dish.id)
    .all();
  dish.ingredients = ingredients;
  return json(dish);
}

export async function onRequestPut({ request, params, env }) {
  const b = await request.json().catch(() => ({}));
  const existing = await env.DB.prepare('SELECT * FROM dishes WHERE id = ?').bind(params.id).first();
  if (!existing) return errorJson('找不到菜色', 404);

  await env.DB.prepare(
    `UPDATE dishes SET name=?, category=?, is_pork=?, protein_type=?,
      cooking_method=?, color_tag=?, is_spicy=?, is_soft=?, price=?, notes=?,
      flavor_style=?, main_ingredient=? WHERE id=?`
  )
    .bind(
      b.name ?? existing.name,
      b.category ?? existing.category,
      b.is_pork ? 1 : 0,
      b.protein_type || existing.protein_type,
      b.cooking_method || existing.cooking_method,
      b.color_tag || existing.color_tag,
      b.is_spicy ? 1 : 0,
      b.is_soft ? 1 : 0,
      b.price ?? existing.price,
      b.notes ?? existing.notes,
      b.flavor_style ?? existing.flavor_style,
      b.main_ingredient ?? existing.main_ingredient,
      params.id
    )
    .run();

  if (Array.isArray(b.ingredients)) {
    await env.DB.prepare('DELETE FROM dish_ingredients WHERE dish_id = ?').bind(params.id).run();
    for (const ing of b.ingredients) {
      if (ing.name && ing.qty != null && ing.unit) {
        await env.DB.prepare('INSERT INTO dish_ingredients (dish_id, name, qty, unit) VALUES (?, ?, ?, ?)')
          .bind(params.id, ing.name, ing.qty, ing.unit)
          .run();
      }
    }
  }

  const dish = await env.DB.prepare('SELECT * FROM dishes WHERE id = ?').bind(params.id).first();
  const { results: ingredients } = await env.DB
    .prepare('SELECT id, name, qty, unit FROM dish_ingredients WHERE dish_id = ?')
    .bind(dish.id)
    .all();
  dish.ingredients = ingredients;
  return json(dish);
}

export async function onRequestDelete({ params, env }) {
  await env.DB.prepare('DELETE FROM dishes WHERE id = ?').bind(params.id).run();
  return json({ ok: true });
}
