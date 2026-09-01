// 客製化菜單樣數上限採兩段式，依「訂單單價」（客戶每桌/份的單價，非菜色加總的總價）判斷：
// 訂單單價200元以內最多6樣；訂單單價超過200元，上限放寬為12樣（可由使用者手動新增至上限）。
export const PRICE_THRESHOLD = 200;
export const LOW_TIER_MAX_ITEMS = 6;
export const HIGH_TIER_MAX_ITEMS = 12;

export function getMaxItemsForPrice(unitPrice) {
  return unitPrice > PRICE_THRESHOLD ? HIGH_TIER_MAX_ITEMS : LOW_TIER_MAX_ITEMS;
}

async function fetchDailySlot(db, menuDate, slotCategory) {
  const { results } = await db
    .prepare(
      `SELECT mmi.variant, d.* FROM monthly_menu_items mmi
       JOIN dishes d ON d.id = mmi.dish_id
       WHERE mmi.menu_date = ? AND mmi.slot_category = ?
       ORDER BY mmi.sort_order`
    )
    .bind(menuDate, slotCategory)
    .all();
  return results;
}

async function fetchDishPool(db, category) {
  const { results } = await db.prepare(`SELECT * FROM dishes WHERE category = ?`).bind(category).all();
  return results;
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

export async function generateCustomMenu(db, order) {
  const deliveryDate = order.delivery_date;
  const warnings = [];
  const unitPrice = Number(order.unit_price) || 0;
  const maxItemsAllowed = getMaxItemsForPrice(unitPrice);
  const maxBudget = unitPrice > 0 ? unitPrice : PRICE_THRESHOLD;

  let mains = await fetchDailySlot(db, deliveryDate, '主菜');
  let sides = await fetchDailySlot(db, deliveryDate, '副菜');
  let vegSlot = await fetchDailySlot(db, deliveryDate, '時蔬');
  const vegPool = await fetchDishPool(db, '配菜');
  const staplePool = await fetchDishPool(db, '主食');
  const soupPool = await fetchDishPool(db, '湯品');
  const dessertPool = await fetchDishPool(db, '甜點');
  const drinkPool = await fetchDishPool(db, '飲料');

  if (mains.length === 0 || sides.length === 0 || vegSlot.length === 0) {
    warnings.push(`出貨當天（${deliveryDate}）尚未排定當天的月菜單（主菜/副菜/時蔬），請先於「月菜單管理」排這一天的菜單`);
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
    if (picks.length >= maxItemsAllowed) return false;
    if (totalPrice + dish.price > maxBudget) return false;
    if (picks.some((p) => p.dish_id === dish.id)) return false;
    picks.push({ category, dish_id: dish.id, name: dish.name, price: dish.price });
    totalPrice += dish.price;
    return true;
  }

  // 1) 主食
  if (!tryAdd('主食', sortedStaple[0])) {
    warnings.push('無法在預算內加入主食，請確認主食價格設定');
  }

  // 2) 主菜：預設抓2樣
  const mainCount = 2;
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
      if (picks.length >= maxItemsAllowed) break;
      if (tryAdd(cat, d)) break;
    }
  }

  // 粗飽：若仍有名額與預算，優先再補一樣主菜或主食，而非甜點/飲料
  if (order.opt_hearty && picks.length < maxItemsAllowed) {
    const extraMain = sortedMains.find((d) => !picks.some((p) => p.dish_id === d.id));
    if (extraMain) tryAdd('主菜', extraMain);
  }

  return {
    deliveryDate,
    items: picks,
    totalPrice,
    itemCount: picks.length,
    unitPrice,
    maxPrice: maxBudget,
    maxItems: maxItemsAllowed,
    warnings,
  };
}
