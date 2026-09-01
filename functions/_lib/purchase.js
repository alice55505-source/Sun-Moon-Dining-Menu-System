async function getOrderById(db, orderId) {
  return db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(orderId).first();
}

async function getOrderMenuItems(db, orderId) {
  const { results } = await db
    .prepare(
      `SELECT omi.*, d.name AS dish_name FROM order_menu_items omi
       JOIN dishes d ON d.id = omi.dish_id
       WHERE omi.order_id = ? ORDER BY omi.sort_order`
    )
    .bind(orderId)
    .all();
  return results;
}

async function getDishIngredients(db, dishId) {
  const { results } = await db
    .prepare(`SELECT name, qty, unit FROM dish_ingredients WHERE dish_id = ?`)
    .bind(dishId)
    .all();
  return results;
}

// 計算單一訂單的食材採購量（依訂單數量放大）
export async function getOrderIngredientBreakdown(db, orderId) {
  const order = await getOrderById(db, orderId);
  if (!order) return null;
  const menuItems = await getOrderMenuItems(db, orderId);

  const perDish = [];
  for (const mi of menuItems) {
    const rawIngredients = await getDishIngredients(db, mi.dish_id);
    const ingredients = rawIngredients.map((ing) => ({
      name: ing.name,
      unit: ing.unit,
      qtyPerUnit: ing.qty,
      qtyTotal: round2(ing.qty * order.quantity),
    }));
    perDish.push({
      category: mi.category,
      dish_id: mi.dish_id,
      dish_name: mi.dish_name,
      price: mi.price,
      ingredients,
    });
  }

  const aggregated = aggregateIngredients(perDish.flatMap((p) => p.ingredients));

  return {
    order,
    perDish,
    aggregated,
  };
}

function aggregateIngredients(ingredientList) {
  const map = new Map();
  for (const ing of ingredientList) {
    const key = `${ing.name}__${ing.unit}`;
    if (!map.has(key)) map.set(key, { name: ing.name, unit: ing.unit, qtyTotal: 0 });
    map.get(key).qtyTotal += ing.qtyTotal;
  }
  return Array.from(map.values())
    .map((x) => ({ ...x, qtyTotal: round2(x.qtyTotal) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
}

// 依日期彙總所有「已確認」訂單的採購量
export async function getPurchaseListByDate(db, date) {
  const { results: orders } = await db
    .prepare(`SELECT id FROM orders WHERE delivery_date = ? AND menu_status = 'confirmed'`)
    .bind(date)
    .all();

  const allIngredients = [];
  const orderSummaries = [];
  for (const o of orders) {
    const breakdown = await getOrderIngredientBreakdown(db, o.id);
    if (!breakdown) continue;
    allIngredients.push(...breakdown.aggregated);
    orderSummaries.push({
      order_id: breakdown.order.id,
      customer_name: breakdown.order.customer_name,
      quantity: breakdown.order.quantity,
    });
  }

  return {
    date,
    orderCount: orders.length,
    orders: orderSummaries,
    aggregated: aggregateIngredients(allIngredients),
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
