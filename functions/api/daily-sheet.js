import { json, errorJson } from '../_lib/http.js';
import { fetchBentoMenuItems, fetchBanquetMenuItems, resolveBentoOrderDishes } from '../_lib/bentoOrderResolve.js';

async function getDishIngredients(db, dishId) {
  const { results } = await db
    .prepare(`SELECT name, qty, unit FROM dish_ingredients WHERE dish_id = ?`)
    .bind(dishId)
    .all();
  return results;
}

function formatIngredients(list) {
  return list.map((i) => `${i.name}${i.qty}${i.unit}`).join('、');
}

// ordersLike：可餵給 resolveBentoOrderDishes 的訂單陣列（bento_orders 原始列，
// 或從 orders 轉成的合菜訂單樣式），用來把「用餐數量」依實際會吃到哪些菜攤算到每道菜上
async function buildMealCountMap(db, ordersLike) {
  const map = new Map();
  for (const order of ordersLike) {
    const items = await resolveBentoOrderDishes(db, order);
    for (const it of items) {
      map.set(it.dish_id, (map.get(it.dish_id) || 0) + (order.quantity || 0));
    }
  }
  return map;
}

async function buildSection(db, menuItems, mealCountMap) {
  const rows = [];
  for (const it of menuItems) {
    const ingredients = await getDishIngredients(db, it.dish_id);
    rows.push({
      slot_category: it.slot_category,
      variant: it.variant,
      dish_id: it.dish_id,
      name: it.name,
      ingredientText: formatIngredients(ingredients),
      mealCount: mealCountMap.get(it.dish_id) || 0,
      notes: it.notes || '',
    });
  }
  return rows;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  if (!date) return errorJson('date 查詢參數為必填 (YYYY-MM-DD)');

  const db = env.DB;

  const [bentoMenuItems, banquetMenuItems, { results: bentoOrdersRaw }, { results: banquetOrders }] = await Promise.all([
    fetchBentoMenuItems(db, date),
    fetchBanquetMenuItems(db, date),
    db.prepare(`SELECT * FROM bento_orders WHERE delivery_date = ? AND menu_status = 'confirmed'`).bind(date).all(),
    db.prepare(`SELECT * FROM orders WHERE delivery_date = ? AND menu_status = 'confirmed'`).bind(date).all(),
  ]);

  // 廠商訂單裡「便當」類型才算便當份數/用餐數量；「合菜（加味）」類型雖然也存在 bento_orders，
  // 但吃到的是當天合菜月菜單那組菜，應併入下方「合菜」區塊統計，而不是便當區塊。
  const bentoTypeOrders = bentoOrdersRaw.filter((o) => o.order_type === '便當');
  const comboTypeOrders = bentoOrdersRaw.filter((o) => o.order_type === '合菜');

  const bentoMealCountMap = await buildMealCountMap(db, bentoTypeOrders);
  const banquetOrdersLike = banquetOrders.map((o) => ({
    order_type: '合菜',
    delivery_date: date,
    opt_no_pork: o.opt_no_pork,
    quantity: o.quantity,
  }));
  const banquetMealCountMap = await buildMealCountMap(db, [...banquetOrdersLike, ...comboTypeOrders]);

  const bentoRows = await buildSection(db, bentoMenuItems, bentoMealCountMap);
  const banquetRows = await buildSection(db, banquetMenuItems, banquetMealCountMap);

  const totalBento = bentoTypeOrders.reduce((s, o) => s + (o.quantity || 0), 0);
  const totalBanquet =
    banquetOrders.reduce((s, o) => s + (o.quantity || 0), 0) + comboTypeOrders.reduce((s, o) => s + (o.quantity || 0), 0);

  return json({
    date,
    bento: { items: bentoRows, total: totalBento },
    banquet: { items: banquetRows, total: totalBanquet },
  });
}
