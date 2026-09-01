import { json, errorJson } from '../../../_lib/http.js';
import { PRICE_THRESHOLD, HIGH_TIER_MAX_ITEMS, getMaxItemsForPrice } from '../../../_lib/customMenuGenerator.js';

export async function onRequestPut({ request, params, env }) {
  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(params.id).first();
  if (!order) return errorJson('找不到訂單', 404);

  const body = await request.json().catch(() => ({}));
  const { items, confirm } = body;
  if (!Array.isArray(items)) return errorJson('items 為必填陣列');

  const totalPrice = items.reduce((s, it) => s + (Number(it.price) || 0), 0);
  if (items.length > HIGH_TIER_MAX_ITEMS) {
    return errorJson(`最多 ${HIGH_TIER_MAX_ITEMS} 樣菜色`);
  }
  const maxItemsAllowed = getMaxItemsForPrice(totalPrice);
  if (items.length > maxItemsAllowed) {
    return errorJson(
      `總價 $${totalPrice} 在 ${PRICE_THRESHOLD} 元以內最多 ${maxItemsAllowed} 樣，若要選 ${items.length} 樣，總價需超過 ${PRICE_THRESHOLD} 元`
    );
  }

  await env.DB.prepare('DELETE FROM order_menu_items WHERE order_id = ?').bind(order.id).run();
  let idx = 0;
  for (const it of items) {
    await env.DB.prepare(
      'INSERT INTO order_menu_items (order_id, category, dish_id, price, sort_order) VALUES (?, ?, ?, ?, ?)'
    )
      .bind(order.id, it.category, it.dish_id, Number(it.price) || 0, idx)
      .run();
    idx += 1;
  }
  await env.DB.prepare(`UPDATE orders SET menu_status = ?, updated_at = datetime('now') WHERE id = ?`)
    .bind(confirm ? 'confirmed' : 'draft', order.id)
    .run();

  const { results: menuItems } = await env.DB
    .prepare(
      `SELECT omi.*, d.name AS dish_name FROM order_menu_items omi
       JOIN dishes d ON d.id = omi.dish_id WHERE omi.order_id = ? ORDER BY omi.sort_order`
    )
    .bind(order.id)
    .all();
  const updatedOrder = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(order.id).first();

  return json({ order: updatedOrder, menuItems });
}
