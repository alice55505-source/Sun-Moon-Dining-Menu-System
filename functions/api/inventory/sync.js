import { json } from '../../_lib/http.js';
import { syncInventoryFromDishes } from '../../_lib/inventory.js';

export async function onRequestPost({ env }) {
  const result = await syncInventoryFromDishes(env.DB);
  return json(result);
}
