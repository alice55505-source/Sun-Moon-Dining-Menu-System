const db = require('./db');

const MAX_ITEMS = 6;
const MAX_PRICE = 200;

function getMonth(dateStr) {
  return (dateStr || '').slice(0, 7);
}

function fetchMonthlySlot(month, slotCategory) {
  return db
    .prepare(
      `SELECT mmi.variant, d.* FROM monthly_menu_items mmi
       JOIN dishes d ON d.id = mmi.dish_id
       WHERE mmi.month = ? AND mmi.slot_category = ?
       ORDER BY mmi.sort_order`
    )
    .all(month, slotCategory);
}

function fetchDishPool(category) {
  return db.prepare(`SELECT * FROM dishes WHERE category = ?`).all(category);
}

function applyOptionFilters(pool, order) {
  let out = pool.slice();
  if (order.opt_no_pork) out = out.filter((d) => !d.is_pork);
  if (order.opt_no_spicy || order.opt_kids || order.opt_elderly) {
    out = out.filter((d) => !d.is_spicy);
  }
  return out;
}

function scoreDish(d, order) {
  let score = 0;
  if (order.opt_elderly) {
    if (d.is_soft) score += 3;
    if (d.cooking_method === '炸') score -= 3;
    if (d.cooking_method === '烤') score -= 1;
  }
  if (order.opt_kids) {
    if (d.is_soft) score += 2;
    if (['甜點', '飲料'].includes(d.category)) score += 1;
    if (d.cooking_method === '炸') score += 1; // kids tend to like fried food, but capped by count elsewhere
  }
  if (order.opt_hearty) {
    if (d.category === '主食' || d.category === '主菜') score += 1;
  }
  return score;
}

function sortPool(pool, order) {
  return pool
    .map((d) => ({ d, s: scoreDish(d, order) }))
    .sort((a, b) => b.s - a.s || a.d.price - b.d.price)
    .map((x) => x.d);
}

function generateCustomMenu(order) {
  const month = getMonth(order.delivery_date);
  const warnings = [];

  let mains = fetchMonthlySlot(month, '主菜');
  let sides = fetchMonthlySlot(month, '副菜');
  let vegSlot = fetchMonthlySlot(month, '時蔬');
  const vegPool = fetchDishPool('配菜');
  const staplePool = fetchDishPool('主食');
  const soupPool = fetchDishPool('湯品');
  const dessertPool = fetchDishPool('甜點');
  const drinkPool = fetchDishPool('飲料');

  if (mains.length === 0 || sides.length === 0 || vegSlot.length === 0) {
    warnings.push(`本月（${month}）尚未設定完整的月菜單（主菜/副菜/時蔬），請先於「月菜單管理」建立本月菜單`);
  }

  if (order.opt_no_pork) {
    const noPorkMains = mains.filter((d) => d.variant === '不豬' || !d.is_pork);
    mains = noPorkMains.length > 0 ? noPorkMains : mains.filter((d) => !d.is_pork);
  }

  mains = applyOptionFilters(mains, order);
  sides = applyOptionFilters(sides, order);
  const veg = applyOptionFilters([...vegSlot, ...vegPool], order);
  const staple = applyOptionFilters(staplePool, order);
  const soup = applyOptionFilters(soupPool, order);
  const dessert = applyOptionFilters(dessertPool, order);
  const drink = applyOptionFilters(drinkPool, order);

  const sortedMains = sortPool(mains, order);
  const sortedSides = sortPool(sides, order);
  const sortedVeg = sortPool(veg, order);
  const sortedStaple = sortPool(staple, order);
  const sortedSoup = sortPool(soup, order);
  const sortedDessert = sortPool(dessert, order);
  const sortedDrink = sortPool(drink, order);

  const picks = [];
  let totalPrice = 0;

  function tryAdd(category, dish) {
    if (!dish) return false;
    if (picks.length >= MAX_ITEMS) return false;
    if (totalPrice + dish.price > MAX_PRICE) return false;
    if (picks.some((p) => p.dish_id === dish.id)) return false;
    picks.push({ category, dish_id: dish.id, name: dish.name, price: dish.price });
    totalPrice += dish.price;
    return true;
  }

  // 1) 主食
  if (!tryAdd('主食', sortedStaple[0])) {
    warnings.push('無法在預算內加入主食，請確認主食價格設定');
  }

  // 2) 主菜：一般預設抓2樣，粗飽選項優先保留主菜名額
  const mainCount = order.opt_hearty ? 2 : 2;
  let mainAdded = 0;
  for (const d of sortedMains) {
    if (mainAdded >= mainCount) break;
    if (tryAdd('主菜', d)) mainAdded += 1;
  }
  if (mainAdded === 0) warnings.push('沒有符合條件的主菜可加入（可能是預算或不豬/不辣限制過嚴）');

  // 3) 副菜
  if (!tryAdd('副菜', sortedSides[0])) {
    warnings.push('沒有符合條件的副菜可加入');
  }

  // 4) 配菜（時蔬／拼盤）
  if (!tryAdd('配菜', sortedVeg[0])) {
    warnings.push('沒有符合條件的配菜/時蔬可加入');
  }

  // 5) 依剩餘預算與名額，依序嘗試加湯品→甜點/孩子優先甜點→飲料
  const optionalOrder = order.opt_kids
    ? [['甜點', sortedDessert], ['飲料', sortedDrink], ['湯品', sortedSoup]]
    : [['湯品', sortedSoup], ['甜點', sortedDessert], ['飲料', sortedDrink]];

  for (const [cat, pool] of optionalOrder) {
    for (const d of pool) {
      if (picks.length >= MAX_ITEMS) break;
      if (tryAdd(cat, d)) break;
    }
  }

  // 粗飽：若仍有名額與預算，優先再補一樣主菜或主食，而非甜點/飲料
  if (order.opt_hearty && picks.length < MAX_ITEMS) {
    const extraMain = sortedMains.find((d) => !picks.some((p) => p.dish_id === d.id));
    if (extraMain) tryAdd('主菜', extraMain);
  }

  return {
    month,
    items: picks,
    totalPrice,
    itemCount: picks.length,
    maxPrice: MAX_PRICE,
    maxItems: MAX_ITEMS,
    warnings,
  };
}

module.exports = { generateCustomMenu, MAX_ITEMS, MAX_PRICE };
