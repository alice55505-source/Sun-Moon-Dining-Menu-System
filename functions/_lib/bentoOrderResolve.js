// 把一筆廠商訂單（便當或合菜加味）解析成「這份訂單實際吃到哪些菜」。
// 便當：主菜依不豬篩一般/不豬；副菜依 price_tier 門檻疊加 基本/70加/80加；時蔬固定兩道都算。
// 合菜（合菜加味）：直接套用當天「合菜月菜單」（monthly_menu_items）排的那組菜，
//   主菜依不豬篩一般/不豬，副菜與時蔬全拿——與現有合菜訂單客製化菜單同一套資料來源。
// 採購清單（purchase.js）與當天食材表（daily-sheet.js）共用這個函式，避免兩處各寫一份邏輯。

export async function fetchBentoMenuItems(db, menuDate) {
  const { results } = await db
    .prepare(
      `SELECT bmi.id, bmi.slot_category, bmi.variant, bmi.dish_id, bmi.sort_order,
              d.name, d.price, d.is_pork, d.protein_type, d.notes
       FROM bento_menu_items bmi JOIN dishes d ON d.id = bmi.dish_id
       WHERE bmi.menu_date = ? ORDER BY bmi.sort_order`
    )
    .bind(menuDate)
    .all();
  return results;
}

export async function fetchBanquetMenuItems(db, menuDate) {
  const { results } = await db
    .prepare(
      `SELECT mmi.id, mmi.slot_category, mmi.variant, mmi.dish_id, mmi.sort_order,
              d.name, d.price, d.is_pork, d.protein_type, d.notes
       FROM monthly_menu_items mmi JOIN dishes d ON d.id = mmi.dish_id
       WHERE mmi.menu_date = ? ORDER BY mmi.sort_order`
    )
    .bind(menuDate)
    .all();
  return results;
}

export async function resolveBentoOrderDishes(db, order) {
  const mainVariant = order.opt_no_pork ? '不豬' : '一般';

  if (order.order_type === '合菜') {
    const items = await fetchBanquetMenuItems(db, order.delivery_date);
    return items
      .filter((it) => it.slot_category !== '主菜' || it.variant === mainVariant)
      .map((it) => ({ category: it.slot_category, dish_id: it.dish_id, name: it.name, price: it.price }));
  }

  const items = await fetchBentoMenuItems(db, order.delivery_date);
  const sideVariants = ['基本'];
  if (order.price_tier >= 70) sideVariants.push('70加');
  if (order.price_tier >= 80) sideVariants.push('80加');

  return items
    .filter((it) => {
      if (it.slot_category === '主菜') return it.variant === mainVariant;
      if (it.slot_category === '副菜') return sideVariants.includes(it.variant);
      return true; // 時蔬固定兩道都算
    })
    .map((it) => ({ category: it.slot_category, dish_id: it.dish_id, name: it.name, price: it.price }));
}
