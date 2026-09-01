const db = require('./db');

function getOrderById(orderId) {
  return db.prepare(`SELECT * FROM orders WHERE id = ?`).get(orderId);
}

function getOrderMenuItems(orderId) {
  return db
    .prepare(
      `SELECT omi.*, d.name AS dish_name FROM order_menu_items omi
       JOIN dishes d ON d.id = omi.dish_id
       WHERE omi.order_id = ? ORDER BY omi.sort_order`
    )
    .all(orderId);
}

function getDishIngredients(dishId) {
  return db.prepare(`SELECT name, qty, unit FROM dish_ingredients WHERE dish_id = ?`).all(dishId);
}

// 計算單一訂單的食材採購量（依訂單數量放大）
function getOrderIngredientBreakdown(orderId) {
  const order = getOrderById(orderId);
  if (!order) return null;
  const menuItems = getOrderMenuItems(orderId);

  const perDish = menuItems.map((mi) => {
    const ingredients = getDishIngredients(mi.dish_id).map((ing) => ({
      name: ing.name,
      unit: ing.unit,
      qtyPerUnit: ing.qty,
      qtyTotal: round2(ing.qty * order.quantity),
    }));
    return {
      category: mi.category,
      dish_id: mi.dish_id,
      dish_name: mi.dish_name,
      price: mi.price,
      ingredients,
    };
  });

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
function getPurchaseListByDate(date) {
  const orders = db
    .prepare(`SELECT id FROM orders WHERE delivery_date = ? AND menu_status = 'confirmed'`)
    .all(date);

  const allIngredients = [];
  const orderSummaries = [];
  for (const o of orders) {
    const breakdown = getOrderIngredientBreakdown(o.id);
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

module.exports = {
  getOrderIngredientBreakdown,
  getPurchaseListByDate,
};
