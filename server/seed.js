const db = require('./db');

// 範例菜色資料庫（僅供系統初次啟動示範使用，之後可在「菜色資料庫」頁面自行新增/修改/刪除）
// ingredients 為主要食材，不含調味料；qty 為「每桌（每一份訂購數量）」用量
const DISHES = [
  // ---- 主食 ----
  { name: '白飯', category: '主食', protein_type: '素', cooking_method: '煮', color_tag: '白', price: 20,
    ingredients: [{ name: '白米', qty: 600, unit: 'g' }] },
  { name: '炒麵', category: '主食', protein_type: '素', cooking_method: '炒', color_tag: '黃', price: 35,
    ingredients: [{ name: '油麵', qty: 500, unit: 'g' }, { name: '高麗菜', qty: 150, unit: 'g' }, { name: '紅蘿蔔絲', qty: 50, unit: 'g' }] },
  { name: '炒米粉', category: '主食', protein_type: '素', cooking_method: '炒', color_tag: '白', price: 35,
    ingredients: [{ name: '米粉', qty: 400, unit: 'g' }, { name: '高麗菜', qty: 150, unit: 'g' }, { name: '香菇絲', qty: 30, unit: 'g' }] },
  { name: '筒仔米糕', category: '主食', protein_type: '豬', cooking_method: '蒸', color_tag: '褐', price: 40, is_pork: 1,
    ingredients: [{ name: '長糯米', qty: 500, unit: 'g' }, { name: '滷肉燥', qty: 100, unit: 'g' }, { name: '香菇', qty: 20, unit: 'g' }] },

  // ---- 主菜（一般，含豬） ----
  { name: '紅燒獅子頭', category: '主菜', protein_type: '豬', cooking_method: '滷', color_tag: '褐', price: 90, is_pork: 1,
    ingredients: [{ name: '豬絞肉', qty: 500, unit: 'g' }, { name: '大白菜', qty: 300, unit: 'g' }, { name: '荸薺', qty: 80, unit: 'g' }] },
  { name: '糖醋排骨', category: '主菜', protein_type: '豬', cooking_method: '炸', color_tag: '紅', price: 95, is_pork: 1,
    ingredients: [{ name: '小排骨', qty: 500, unit: 'g' }, { name: '鳳梨片', qty: 100, unit: 'g' }, { name: '青椒', qty: 50, unit: 'g' }] },
  { name: '客家小炒', category: '主菜', protein_type: '豬', cooking_method: '炒', color_tag: '褐', price: 85, is_pork: 1,
    ingredients: [{ name: '五花肉', qty: 300, unit: 'g' }, { name: '魷魚乾', qty: 100, unit: 'g' }, { name: '豆干', qty: 150, unit: 'g' }, { name: '芹菜', qty: 80, unit: 'g' }] },

  // ---- 主菜（不豬替代） ----
  { name: '香煎雞腿排', category: '主菜', protein_type: '雞', cooking_method: '煎', color_tag: '褐', price: 100,
    ingredients: [{ name: '去骨雞腿', qty: 600, unit: 'g' }] },
  { name: '蔥爆牛肉', category: '主菜', protein_type: '牛', cooking_method: '炒', color_tag: '褐', price: 120,
    ingredients: [{ name: '牛肉片', qty: 400, unit: 'g' }, { name: '青蔥', qty: 100, unit: 'g' }, { name: '洋蔥', qty: 80, unit: 'g' }] },
  { name: '樹子蒸鱈魚', category: '主菜', protein_type: '魚', cooking_method: '蒸', color_tag: '白', price: 150,
    ingredients: [{ name: '鱈魚', qty: 500, unit: 'g' }, { name: '破布子', qty: 30, unit: 'g' }, { name: '薑絲', qty: 20, unit: 'g' }] },
  { name: '塔香三杯雞', category: '主菜', protein_type: '雞', cooking_method: '炒', color_tag: '褐', price: 100, is_spicy: 1,
    ingredients: [{ name: '雞腿肉', qty: 500, unit: 'g' }, { name: '九層塔', qty: 30, unit: 'g' }, { name: '老薑', qty: 50, unit: 'g' } ] },
  { name: '避風塘蝦', category: '主菜', protein_type: '海鮮', cooking_method: '炸', color_tag: '黃', price: 160, is_spicy: 1,
    ingredients: [{ name: '白蝦', qty: 500, unit: 'g' }, { name: '蒜酥', qty: 60, unit: 'g' }, { name: '辣椒末', qty: 20, unit: 'g' }] },

  // ---- 副菜 ----
  { name: '螞蟻上樹', category: '副菜', protein_type: '豬', cooking_method: '炒', color_tag: '紅', price: 60, is_pork: 1, is_spicy: 1,
    ingredients: [{ name: '冬粉', qty: 200, unit: 'g' }, { name: '豬絞肉', qty: 150, unit: 'g' }] },
  { name: '麻婆豆腐', category: '副菜', protein_type: '豬', cooking_method: '煮', color_tag: '紅', price: 55, is_pork: 1, is_spicy: 1,
    ingredients: [{ name: '嫩豆腐', qty: 400, unit: 'g' }, { name: '豬絞肉', qty: 100, unit: 'g' }] },
  { name: '滷豆干海帶', category: '副菜', protein_type: '素', cooking_method: '滷', color_tag: '褐', price: 45, is_soft: 1,
    ingredients: [{ name: '豆干', qty: 200, unit: 'g' }, { name: '海帶', qty: 200, unit: 'g' }] },
  { name: '涼拌小黃瓜', category: '副菜', protein_type: '素', cooking_method: '涼拌', color_tag: '綠', price: 40,
    ingredients: [{ name: '小黃瓜', qty: 300, unit: 'g' }, { name: '蒜末', qty: 20, unit: 'g' }] },
  { name: '蒜泥白肉', category: '副菜', protein_type: '豬', cooking_method: '煮', color_tag: '白', price: 70, is_pork: 1,
    ingredients: [{ name: '五花肉片', qty: 300, unit: 'g' }, { name: '蒜泥', qty: 30, unit: 'g' }] },
  { name: '蔭豉蚵仔', category: '副菜', protein_type: '海鮮', cooking_method: '煮', color_tag: '黑', price: 90,
    ingredients: [{ name: '鮮蚵', qty: 300, unit: 'g' }, { name: '豆豉', qty: 20, unit: 'g' }, { name: '薑絲', qty: 20, unit: 'g' }] },
  { name: '涼拌木耳', category: '副菜', protein_type: '素', cooking_method: '涼拌', color_tag: '黑', price: 40,
    ingredients: [{ name: '黑木耳', qty: 250, unit: 'g' }] },
  { name: '客家封肉', category: '副菜', protein_type: '豬', cooking_method: '滷', color_tag: '褐', price: 85, is_pork: 1, is_soft: 1,
    ingredients: [{ name: '五花肉塊', qty: 400, unit: 'g' }, { name: '梅乾菜', qty: 80, unit: 'g' }] },

  // ---- 時蔬 ----
  { name: '清炒高麗菜', category: '時蔬', protein_type: '素', cooking_method: '炒', color_tag: '綠', price: 40,
    ingredients: [{ name: '高麗菜', qty: 500, unit: 'g' }] },
  { name: '炒地瓜葉', category: '時蔬', protein_type: '素', cooking_method: '炒', color_tag: '綠', price: 40,
    ingredients: [{ name: '地瓜葉', qty: 400, unit: 'g' }] },
  { name: '蒜炒A菜', category: '時蔬', protein_type: '素', cooking_method: '炒', color_tag: '綠', price: 40,
    ingredients: [{ name: 'A菜', qty: 400, unit: 'g' }] },
  { name: '香菇燴時蔬', category: '時蔬', protein_type: '素', cooking_method: '煮', color_tag: '綠', price: 50, is_soft: 1,
    ingredients: [{ name: '綜合時蔬', qty: 400, unit: 'g' }, { name: '乾香菇', qty: 30, unit: 'g' }] },
  { name: '塔香茄子', category: '時蔬', protein_type: '素', cooking_method: '炒', color_tag: '紫', price: 45,
    ingredients: [{ name: '茄子', qty: 400, unit: 'g' }, { name: '九層塔', qty: 20, unit: 'g' }] },
  { name: '炒青花菜', category: '時蔬', protein_type: '素', cooking_method: '炒', color_tag: '綠', price: 45,
    ingredients: [{ name: '青花菜', qty: 400, unit: 'g' }] },

  // ---- 配菜（拼盤） ----
  { name: '五味小卷拼盤', category: '配菜', protein_type: '海鮮', cooking_method: '涼拌', color_tag: '白', price: 100,
    ingredients: [{ name: '小卷', qty: 300, unit: 'g' }] },
  { name: '滷味拼盤', category: '配菜', protein_type: '豬', cooking_method: '滷', color_tag: '褐', price: 90, is_pork: 1,
    ingredients: [{ name: '豬耳朵', qty: 100, unit: 'g' }, { name: '豆干', qty: 100, unit: 'g' }, { name: '海帶', qty: 100, unit: 'g' }] },
  { name: '涼拌三絲', category: '配菜', protein_type: '素', cooking_method: '涼拌', color_tag: '白', price: 45,
    ingredients: [{ name: '干絲', qty: 150, unit: 'g' }, { name: '紅蘿蔔絲', qty: 80, unit: 'g' }, { name: '小黃瓜絲', qty: 80, unit: 'g' }] },
  { name: '水果拼盤', category: '配菜', protein_type: '素', cooking_method: '生食', color_tag: '橙', price: 60,
    ingredients: [{ name: '季節水果', qty: 600, unit: 'g' }] },

  // ---- 湯品 ----
  { name: '酸辣湯', category: '湯品', protein_type: '豬', cooking_method: '煮', color_tag: '紅', price: 45, is_pork: 1, is_spicy: 1,
    ingredients: [{ name: '豬肉絲', qty: 100, unit: 'g' }, { name: '豆腐', qty: 150, unit: 'g' }, { name: '黑木耳', qty: 50, unit: 'g' } ] },
  { name: '玉米濃湯', category: '湯品', protein_type: '素', cooking_method: '煮', color_tag: '黃', price: 35, is_soft: 1,
    ingredients: [{ name: '玉米粒', qty: 200, unit: 'g' }, { name: '玉米醬', qty: 200, unit: 'g' }] },
  { name: '蘿蔔排骨湯', category: '湯品', protein_type: '豬', cooking_method: '煮', color_tag: '白', price: 55, is_pork: 1, is_soft: 1,
    ingredients: [{ name: '白蘿蔔', qty: 300, unit: 'g' }, { name: '排骨', qty: 250, unit: 'g' }] },
  { name: '味噌豆腐湯', category: '湯品', protein_type: '素', cooking_method: '煮', color_tag: '白', price: 35, is_soft: 1,
    ingredients: [{ name: '豆腐', qty: 200, unit: 'g' }, { name: '味噌', qty: 50, unit: 'g' }] },

  // ---- 甜點 ----
  { name: '紅豆湯圓', category: '甜點', protein_type: '素', cooking_method: '煮', color_tag: '紅', price: 30, is_soft: 1,
    ingredients: [{ name: '紅豆', qty: 200, unit: 'g' }, { name: '小湯圓', qty: 150, unit: 'g' }] },
  { name: '布丁', category: '甜點', protein_type: '素', cooking_method: '其他', color_tag: '黃', price: 25, is_soft: 1,
    ingredients: [{ name: '雞蛋布丁', qty: 6, unit: '個' }] },
  { name: '涼糕', category: '甜點', protein_type: '素', cooking_method: '其他', color_tag: '白', price: 25,
    ingredients: [{ name: '涼糕', qty: 6, unit: '塊' }] },
  { name: '芒果青', category: '甜點', protein_type: '素', cooking_method: '生食', color_tag: '橙', price: 30,
    ingredients: [{ name: '芒果', qty: 400, unit: 'g' }] },

  // ---- 飲料 ----
  { name: '古早味紅茶', category: '飲料', protein_type: '素', cooking_method: '其他', color_tag: '褐', price: 20,
    ingredients: [{ name: '紅茶', qty: 2000, unit: 'ml' }] },
  { name: '冬瓜茶', category: '飲料', protein_type: '素', cooking_method: '其他', color_tag: '褐', price: 20,
    ingredients: [{ name: '冬瓜茶磚', qty: 200, unit: 'g' }] },
  { name: '仙草蜜', category: '飲料', protein_type: '素', cooking_method: '其他', color_tag: '黑', price: 25,
    ingredients: [{ name: '仙草凍', qty: 500, unit: 'g' }] },
  { name: '柳橙汁', category: '飲料', protein_type: '素', cooking_method: '其他', color_tag: '橙', price: 25,
    ingredients: [{ name: '柳橙原汁', qty: 1500, unit: 'ml' }] },
];

function seed() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM dishes').get().c;
  if (count > 0) return;

  const insertDish = db.prepare(`
    INSERT INTO dishes (name, category, is_pork, protein_type, cooking_method, color_tag, is_spicy, is_soft, price, notes)
    VALUES (@name, @category, @is_pork, @protein_type, @cooking_method, @color_tag, @is_spicy, @is_soft, @price, @notes)
  `);
  const insertIngredient = db.prepare(`
    INSERT INTO dish_ingredients (dish_id, name, qty, unit) VALUES (?, ?, ?, ?)
  `);

  const insertAll = db.transaction((dishes) => {
    const ids = {};
    for (const d of dishes) {
      const info = insertDish.run({
        name: d.name,
        category: d.category,
        is_pork: d.is_pork ? 1 : 0,
        protein_type: d.protein_type || '素',
        cooking_method: d.cooking_method || '其他',
        color_tag: d.color_tag || '其他',
        is_spicy: d.is_spicy ? 1 : 0,
        is_soft: d.is_soft ? 1 : 0,
        price: d.price || 0,
        notes: d.notes || '',
      });
      const dishId = info.lastInsertRowid;
      ids[d.name] = dishId;
      for (const ing of d.ingredients || []) {
        insertIngredient.run(dishId, ing.name, ing.qty, ing.unit);
      }
    }
    return ids;
  });

  const ids = insertAll(DISHES);

  // 示範月菜單（本月）：主菜2(各配一般/不豬替代共4)、副菜2、時蔬2
  const month = new Date().toISOString().slice(0, 7);
  const insertMenuItem = db.prepare(`
    INSERT INTO monthly_menu_items (month, slot_category, variant, dish_id, sort_order) VALUES (?, ?, ?, ?, ?)
  `);
  const monthlyPlan = [
    ['主菜', '一般', '紅燒獅子頭', 1],
    ['主菜', '不豬', '香煎雞腿排', 1],
    ['主菜', '一般', '糖醋排骨', 2],
    ['主菜', '不豬', '樹子蒸鱈魚', 2],
    ['副菜', '一般', '滷豆干海帶', 1],
    ['副菜', '一般', '涼拌小黃瓜', 2],
    ['時蔬', '一般', '清炒高麗菜', 1],
    ['時蔬', '一般', '炒地瓜葉', 2],
  ];
  const insertMonthly = db.transaction((rows) => {
    for (const [slot, variant, name, order] of rows) {
      if (ids[name] != null) insertMenuItem.run(month, slot, variant, ids[name], order);
    }
  });
  insertMonthly(monthlyPlan);
}

module.exports = seed;
