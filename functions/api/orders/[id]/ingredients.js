import { json, errorJson } from '../../../_lib/http.js';
import { getOrderIngredientBreakdown } from '../../../_lib/purchase.js';

export async function onRequestGet({ params, env }) {
  const breakdown = await getOrderIngredientBreakdown(env.DB, params.id);
  if (!breakdown) return errorJson('找不到訂單', 404);
  return json(breakdown);
}
