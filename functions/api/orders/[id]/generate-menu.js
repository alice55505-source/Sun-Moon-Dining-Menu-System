import { json, errorJson } from '../../../_lib/http.js';
import { generateCustomMenu } from '../../../_lib/customMenuGenerator.js';

export async function onRequestPost({ params, env }) {
  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(params.id).first();
  if (!order) return errorJson('找不到訂單', 404);

  const plan = await generateCustomMenu(env.DB, order);
  return json(plan);
}
