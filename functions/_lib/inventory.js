// 庫存清點：只存「目前」這一份快照（不是逐筆進出貨紀錄），key 是 name+unit，
// 跟 purchase.js 的 aggregateIngredients() 用同一組 key，方便食材採買直接對照扣庫存。

export async function listInventory(db) {
  const { results } = await db.prepare(`SELECT * FROM inventory_items ORDER BY name, unit`).all();
  return results;
}

// 回傳 Map<'name__unit', qty>，給食材採買計算「需求 - 庫存」用
export async function getInventoryMap(db) {
  const items = await listInventory(db);
  const map = new Map();
  for (const it of items) map.set(`${it.name}__${it.unit}`, it.qty);
  return map;
}

export async function upsertInventoryItem(db, { name, unit, qty }) {
  await db
    .prepare(
      `INSERT INTO inventory_items (name, unit, qty, updated_at) VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(name, unit) DO UPDATE SET qty = excluded.qty, updated_at = datetime('now')`
    )
    .bind(name, unit, qty)
    .run();
  return db.prepare(`SELECT * FROM inventory_items WHERE name = ? AND unit = ?`).bind(name, unit).first();
}

// 把菜色資料庫裡出現過、但庫存清點裡還沒有的 (食材, 單位) 組合補進來（qty 從 0 開始），
// 讓庫存清點的清單可以一次涵蓋所有正在用的食材，不用手動一筆一筆新增
export async function syncInventoryFromDishes(db) {
  const { results: distinctIngredients } = await db
    .prepare(`SELECT DISTINCT name, unit FROM dish_ingredients ORDER BY name, unit`)
    .all();
  let added = 0;
  for (const ing of distinctIngredients) {
    const result = await db
      .prepare(`INSERT INTO inventory_items (name, unit, qty) VALUES (?, ?, 0) ON CONFLICT(name, unit) DO NOTHING`)
      .bind(ing.name, ing.unit)
      .run();
    if (result.meta.changes > 0) added += 1;
  }
  return { added };
}
