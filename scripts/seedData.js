// 範例菜色資料庫（僅供系統初次啟動示範使用，之後可在「菜色資料庫」頁面自行新增/修改/刪除）
// ingredients 為主要食材，不含調味料；qty 為「每桌（每一份訂購數量）」用量
// 這份資料是 migrations/0002_seed.sql 的來源，修改後請重新執行：
//   node scripts/generate-seed-sql.js
//
// 主菜/副菜/時蔬要求各 100 道，用「食材 × 烹調風格」組合的方式產生（而不是手動列
// 300 筆），確保數量剛好、不重複，且方便日後調整（改食材清單或風格清單即可）。
// 這樣「月菜單管理」的自動排月曆功能（每天2主菜+2副菜+2時蔬，共30天）才有足夠的
// 菜色可以輪替、避免同一道菜在一個月內太快重複出現。

// ==================== 主菜：20 食材 × 5 風格 = 100 道 ====================

const MEAT_PROTEINS = [
  { name: '五花肉', protein_type: '豬', is_pork: 1, qty: 400, unit: 'g', price: 85 },
  { name: '小排骨', protein_type: '豬', is_pork: 1, qty: 500, unit: 'g', price: 90 },
  { name: '梅花肉', protein_type: '豬', is_pork: 1, qty: 450, unit: 'g', price: 90 },
  { name: '松阪豬', protein_type: '豬', is_pork: 1, qty: 350, unit: 'g', price: 100 },
  { name: '豬腳', protein_type: '豬', is_pork: 1, qty: 500, unit: 'g', price: 100 },
  { name: '大里肌', protein_type: '豬', is_pork: 1, qty: 400, unit: 'g', price: 85 },
  { name: '去骨雞腿', protein_type: '雞', is_pork: 0, qty: 500, unit: 'g', price: 95 },
  { name: '雞胸肉', protein_type: '雞', is_pork: 0, qty: 450, unit: 'g', price: 85 },
  { name: '雞翅', protein_type: '雞', is_pork: 0, qty: 500, unit: 'g', price: 90 },
  { name: '土雞腿', protein_type: '雞', is_pork: 0, qty: 600, unit: 'g', price: 100 },
  { name: '牛肋條', protein_type: '牛', is_pork: 0, qty: 400, unit: 'g', price: 140 },
  { name: '牛腩', protein_type: '牛', is_pork: 0, qty: 450, unit: 'g', price: 140 },
  { name: '牛小排', protein_type: '牛', is_pork: 0, qty: 400, unit: 'g', price: 160 },
  { name: '牛柳', protein_type: '牛', is_pork: 0, qty: 400, unit: 'g', price: 140 },
  { name: '羊小排', protein_type: '羊', is_pork: 0, qty: 400, unit: 'g', price: 160 },
];

const SEAFOOD_PROTEINS = [
  { name: '鱸魚', protein_type: '魚', is_pork: 0, qty: 500, unit: 'g', price: 130 },
  { name: '鮭魚', protein_type: '魚', is_pork: 0, qty: 450, unit: 'g', price: 140 },
  { name: '虱目魚肚', protein_type: '魚', is_pork: 0, qty: 400, unit: 'g', price: 120 },
  { name: '白蝦', protein_type: '海鮮', is_pork: 0, qty: 450, unit: 'g', price: 150 },
  { name: '中卷', protein_type: '海鮮', is_pork: 0, qty: 400, unit: 'g', price: 120 },
];

const MEAT_STYLES = [
  { label: '塔香', cooking_method: '炒', color_tag: '褐', is_spicy: 0, is_soft: 0, priceAdd: 10, extra: { name: '九層塔', qty: 20, unit: 'g' } },
  { label: '蒜香', cooking_method: '炒', color_tag: '褐', is_spicy: 0, is_soft: 0, priceAdd: 5, extra: { name: '蒜末', qty: 30, unit: 'g' } },
  { label: '紅燒', cooking_method: '滷', color_tag: '褐', is_spicy: 0, is_soft: 1, priceAdd: 5, extra: null },
  { label: '京都', cooking_method: '炸', color_tag: '紅', is_spicy: 0, is_soft: 0, priceAdd: 5, extra: { name: '洋蔥', qty: 60, unit: 'g' } },
  { label: '麻辣', cooking_method: '炒', color_tag: '紅', is_spicy: 1, is_soft: 0, priceAdd: 10, extra: { name: '乾辣椒', qty: 20, unit: 'g' } },
];

const SEAFOOD_STYLES = [
  { label: '塔香', cooking_method: '炒', color_tag: '黃', is_spicy: 0, is_soft: 0, priceAdd: 10, extra: { name: '九層塔', qty: 20, unit: 'g' } },
  { label: '蒜蒸', cooking_method: '蒸', color_tag: '白', is_spicy: 0, is_soft: 0, priceAdd: 5, extra: { name: '蒜蓉', qty: 40, unit: 'g' } },
  { label: '清蒸', cooking_method: '蒸', color_tag: '白', is_spicy: 0, is_soft: 0, priceAdd: 0, extra: { name: '薑絲', qty: 20, unit: 'g' } },
  { label: '避風塘', cooking_method: '炸', color_tag: '黃', is_spicy: 1, is_soft: 0, priceAdd: 15, extra: { name: '蒜酥', qty: 50, unit: 'g' } },
  { label: 'XO醬', cooking_method: '炒', color_tag: '紅', is_spicy: 1, is_soft: 0, priceAdd: 20, extra: { name: 'XO醬', qty: 40, unit: 'g' } },
];

function generateMainDishes() {
  const dishes = [];
  for (const p of MEAT_PROTEINS) {
    for (const s of MEAT_STYLES) {
      dishes.push({
        name: `${s.label}${p.name}`,
        category: '主菜',
        protein_type: p.protein_type,
        is_pork: p.is_pork,
        cooking_method: s.cooking_method,
        color_tag: s.color_tag,
        is_spicy: s.is_spicy,
        is_soft: s.is_soft,
        price: p.price + s.priceAdd,
        ingredients: [{ name: p.name, qty: p.qty, unit: p.unit }, ...(s.extra ? [s.extra] : [])],
      });
    }
  }
  for (const p of SEAFOOD_PROTEINS) {
    for (const s of SEAFOOD_STYLES) {
      dishes.push({
        name: `${s.label}${p.name}`,
        category: '主菜',
        protein_type: p.protein_type,
        is_pork: p.is_pork,
        cooking_method: s.cooking_method,
        color_tag: s.color_tag,
        is_spicy: s.is_spicy,
        is_soft: s.is_soft,
        price: p.price + s.priceAdd,
        ingredients: [{ name: p.name, qty: p.qty, unit: p.unit }, ...(s.extra ? [s.extra] : [])],
      });
    }
  }
  return dishes;
}

// ==================== 副菜：20 食材 × 5 風格 = 100 道 ====================

const SIDE_BASES = [
  { name: '豆干', protein_type: '素', is_pork: 0, qty: 250, unit: 'g', price: 40, color: '褐' },
  { name: '板豆腐', protein_type: '素', is_pork: 0, qty: 400, unit: 'g', price: 40, color: '白' },
  { name: '嫩豆腐', protein_type: '素', is_pork: 0, qty: 400, unit: 'g', price: 40, color: '白' },
  { name: '皮蛋', protein_type: '蛋', is_pork: 0, qty: 4, unit: '顆', price: 40, color: '黑' },
  { name: '雞蛋', protein_type: '蛋', is_pork: 0, qty: 5, unit: '顆', price: 40, color: '黃' },
  { name: '黑木耳', protein_type: '素', is_pork: 0, qty: 250, unit: 'g', price: 40, color: '黑' },
  { name: '杏鮑菇', protein_type: '素', is_pork: 0, qty: 300, unit: 'g', price: 45, color: '褐' },
  { name: '鮮香菇', protein_type: '素', is_pork: 0, qty: 250, unit: 'g', price: 45, color: '褐' },
  { name: '金針菇', protein_type: '素', is_pork: 0, qty: 250, unit: 'g', price: 40, color: '黃' },
  { name: '海帶', protein_type: '素', is_pork: 0, qty: 250, unit: 'g', price: 40, color: '黑' },
  { name: '海帶芽', protein_type: '素', is_pork: 0, qty: 200, unit: 'g', price: 35, color: '綠' },
  { name: '冬粉', protein_type: '素', is_pork: 0, qty: 200, unit: 'g', price: 40, color: '白' },
  { name: '小黃瓜', protein_type: '素', is_pork: 0, qty: 300, unit: 'g', price: 35, color: '綠' },
  { name: '干絲', protein_type: '素', is_pork: 0, qty: 200, unit: 'g', price: 40, color: '白' },
  { name: '牛腱', protein_type: '牛', is_pork: 0, qty: 350, unit: 'g', price: 85, color: '褐' },
  { name: '豬耳朵', protein_type: '豬', is_pork: 1, qty: 250, unit: 'g', price: 60, color: '褐' },
  { name: '花枝', protein_type: '海鮮', is_pork: 0, qty: 300, unit: 'g', price: 65, color: '白' },
  { name: '豬肝', protein_type: '豬', is_pork: 1, qty: 300, unit: 'g', price: 55, color: '褐' },
  { name: '小魚乾', protein_type: '海鮮', is_pork: 0, qty: 150, unit: 'g', price: 50, color: '黑' },
  { name: '綠豆芽', protein_type: '素', is_pork: 0, qty: 350, unit: 'g', price: 35, color: '白' },
];

const SIDE_STYLES = [
  { label: '涼拌', cooking_method: '涼拌', is_spicy: 0, priceAdd: 0, colorOverride: null, extra: { name: '蒜末', qty: 15, unit: 'g' } },
  { label: '塔香', cooking_method: '炒', is_spicy: 0, priceAdd: 5, colorOverride: null, extra: { name: '九層塔', qty: 15, unit: 'g' } },
  { label: '紅燒', cooking_method: '滷', is_spicy: 0, priceAdd: 5, colorOverride: '褐', extra: null },
  { label: '蒜炒', cooking_method: '炒', is_spicy: 0, priceAdd: 0, colorOverride: null, extra: { name: '蒜末', qty: 20, unit: 'g' } },
  { label: '麻辣', cooking_method: '炒', is_spicy: 1, priceAdd: 10, colorOverride: '紅', extra: { name: '乾辣椒', qty: 15, unit: 'g' } },
];

function generateSideDishes() {
  const dishes = [];
  for (const b of SIDE_BASES) {
    for (const s of SIDE_STYLES) {
      dishes.push({
        name: `${s.label}${b.name}`,
        category: '副菜',
        protein_type: b.protein_type,
        is_pork: b.is_pork,
        cooking_method: s.cooking_method,
        color_tag: s.colorOverride || b.color,
        is_spicy: s.is_spicy,
        is_soft: s.label === '紅燒' ? 1 : 0,
        price: b.price + s.priceAdd,
        ingredients: [{ name: b.name, qty: b.qty, unit: b.unit }, ...(s.extra ? [s.extra] : [])],
      });
    }
  }
  return dishes;
}

// ==================== 時蔬：25 蔬菜 × 4 風格 = 100 道 ====================

const VEGETABLES = [
  { name: '高麗菜', color: '綠' }, { name: '地瓜葉', color: '綠' }, { name: 'A菜', color: '綠' },
  { name: '空心菜', color: '綠' }, { name: '油菜', color: '綠' }, { name: '山蘇', color: '綠' },
  { name: '龍鬚菜', color: '綠' }, { name: '皇宮菜', color: '綠' }, { name: '紅鳳菜', color: '紅' },
  { name: '莧菜', color: '綠' }, { name: '茄子', color: '紫' }, { name: '四季豆', color: '綠' },
  { name: '秋葵', color: '綠' }, { name: '絲瓜', color: '綠' }, { name: '山藥', color: '白' },
  { name: '白花椰菜', color: '白' }, { name: '青花菜', color: '綠' }, { name: '蘆筍', color: '綠' },
  { name: '高麗菜芽', color: '綠' }, { name: '大陸妹', color: '綠' }, { name: '過貓', color: '綠' },
  { name: '川七', color: '綠' }, { name: '芥藍', color: '綠' }, { name: '甜豆', color: '綠' },
  { name: '娃娃菜', color: '綠' },
];

const VEG_STYLES = [
  { label: '蒜炒', cooking_method: '炒', priceAdd: 0, extra: { name: '蒜末', qty: 15, unit: 'g' } },
  { label: '清炒', cooking_method: '炒', priceAdd: 0, extra: null },
  { label: '塔香炒', cooking_method: '炒', priceAdd: 5, extra: { name: '九層塔', qty: 15, unit: 'g' } },
  { label: '涼拌', cooking_method: '涼拌', priceAdd: 0, extra: { name: '蒜末', qty: 15, unit: 'g' } },
];

function generateVegDishes() {
  const dishes = [];
  for (const v of VEGETABLES) {
    for (const s of VEG_STYLES) {
      dishes.push({
        name: `${s.label}${v.name}`,
        category: '時蔬',
        protein_type: '素',
        is_pork: 0,
        cooking_method: s.cooking_method,
        color_tag: v.color,
        is_spicy: 0,
        is_soft: 0,
        price: 40 + s.priceAdd,
        ingredients: [{ name: v.name, qty: 400, unit: 'g' }, ...(s.extra ? [s.extra] : [])],
      });
    }
  }
  return dishes;
}

// ==================== 其他分類（主食/配菜/湯品/甜點/飲料，數量較少即可） ====================

const OTHER_DISHES = [
  // ---- 主食 ----
  { name: '白飯', category: '主食', protein_type: '素', cooking_method: '煮', color_tag: '白', price: 20,
    ingredients: [{ name: '白米', qty: 600, unit: 'g' }] },
  { name: '炒麵', category: '主食', protein_type: '素', cooking_method: '炒', color_tag: '黃', price: 35,
    ingredients: [{ name: '油麵', qty: 500, unit: 'g' }, { name: '高麗菜', qty: 150, unit: 'g' }, { name: '紅蘿蔔絲', qty: 50, unit: 'g' }] },
  { name: '炒米粉', category: '主食', protein_type: '素', cooking_method: '炒', color_tag: '白', price: 35,
    ingredients: [{ name: '米粉', qty: 400, unit: 'g' }, { name: '高麗菜', qty: 150, unit: 'g' }, { name: '香菇絲', qty: 30, unit: 'g' }] },
  { name: '筒仔米糕', category: '主食', protein_type: '豬', cooking_method: '蒸', color_tag: '褐', price: 40, is_pork: 1,
    ingredients: [{ name: '長糯米', qty: 500, unit: 'g' }, { name: '滷肉燥', qty: 100, unit: 'g' }, { name: '香菇', qty: 20, unit: 'g' }] },
  { name: '芋頭米粉', category: '主食', protein_type: '素', cooking_method: '炒', color_tag: '褐', price: 40,
    ingredients: [{ name: '米粉', qty: 400, unit: 'g' }, { name: '芋頭', qty: 150, unit: 'g' }] },
  { name: '蛋炒飯', category: '主食', protein_type: '蛋', cooking_method: '炒', color_tag: '黃', price: 35,
    ingredients: [{ name: '白飯', qty: 600, unit: 'g' }, { name: '雞蛋', qty: 3, unit: '顆' }] },
  { name: '油飯', category: '主食', protein_type: '豬', cooking_method: '蒸', color_tag: '褐', price: 45, is_pork: 1,
    ingredients: [{ name: '長糯米', qty: 500, unit: 'g' }, { name: '豬肉絲', qty: 100, unit: 'g' }, { name: '香菇', qty: 20, unit: 'g' }] },
  { name: '什錦炒飯', category: '主食', protein_type: '素', cooking_method: '炒', color_tag: '黃', price: 40,
    ingredients: [{ name: '白飯', qty: 600, unit: 'g' }, { name: '玉米粒', qty: 80, unit: 'g' }, { name: '青豆', qty: 50, unit: 'g' }] },

  // ---- 配菜（拼盤） ----
  { name: '五味小卷拼盤', category: '配菜', protein_type: '海鮮', cooking_method: '涼拌', color_tag: '白', price: 100,
    ingredients: [{ name: '小卷', qty: 300, unit: 'g' }] },
  { name: '滷味拼盤', category: '配菜', protein_type: '豬', cooking_method: '滷', color_tag: '褐', price: 90, is_pork: 1,
    ingredients: [{ name: '豬耳朵', qty: 100, unit: 'g' }, { name: '豆干', qty: 100, unit: 'g' }, { name: '海帶', qty: 100, unit: 'g' }] },
  { name: '涼拌三絲', category: '配菜', protein_type: '素', cooking_method: '涼拌', color_tag: '白', price: 45,
    ingredients: [{ name: '干絲', qty: 150, unit: 'g' }, { name: '紅蘿蔔絲', qty: 80, unit: 'g' }, { name: '小黃瓜絲', qty: 80, unit: 'g' }] },
  { name: '水果拼盤', category: '配菜', protein_type: '素', cooking_method: '生食', color_tag: '橙', price: 60,
    ingredients: [{ name: '季節水果', qty: 600, unit: 'g' }] },
  { name: '鹽水雞拼盤', category: '配菜', protein_type: '雞', cooking_method: '煮', color_tag: '白', price: 90,
    ingredients: [{ name: '雞胸肉', qty: 400, unit: 'g' }] },
  { name: '燻鮭魚沙拉', category: '配菜', protein_type: '魚', cooking_method: '生食', color_tag: '橙', price: 100,
    ingredients: [{ name: '燻鮭魚', qty: 200, unit: 'g' }, { name: '生菜', qty: 200, unit: 'g' }] },
  { name: '涼拌海蜇皮', category: '配菜', protein_type: '海鮮', cooking_method: '涼拌', color_tag: '白', price: 90,
    ingredients: [{ name: '海蜇皮', qty: 250, unit: 'g' }] },
  { name: '蔬菜沙拉', category: '配菜', protein_type: '素', cooking_method: '生食', color_tag: '綠', price: 60,
    ingredients: [{ name: '綜合生菜', qty: 400, unit: 'g' }] },

  // ---- 湯品 ----
  { name: '酸辣湯', category: '湯品', protein_type: '豬', cooking_method: '煮', color_tag: '紅', price: 45, is_pork: 1, is_spicy: 1,
    ingredients: [{ name: '豬肉絲', qty: 100, unit: 'g' }, { name: '豆腐', qty: 150, unit: 'g' }, { name: '黑木耳', qty: 50, unit: 'g' }] },
  { name: '玉米濃湯', category: '湯品', protein_type: '素', cooking_method: '煮', color_tag: '黃', price: 35, is_soft: 1,
    ingredients: [{ name: '玉米粒', qty: 200, unit: 'g' }, { name: '玉米醬', qty: 200, unit: 'g' }] },
  { name: '蘿蔔排骨湯', category: '湯品', protein_type: '豬', cooking_method: '煮', color_tag: '白', price: 55, is_pork: 1, is_soft: 1,
    ingredients: [{ name: '白蘿蔔', qty: 300, unit: 'g' }, { name: '排骨', qty: 250, unit: 'g' }] },
  { name: '味噌豆腐湯', category: '湯品', protein_type: '素', cooking_method: '煮', color_tag: '白', price: 35, is_soft: 1,
    ingredients: [{ name: '豆腐', qty: 200, unit: 'g' }, { name: '味噌', qty: 50, unit: 'g' }] },
  { name: '冬瓜蛤蜊湯', category: '湯品', protein_type: '海鮮', cooking_method: '煮', color_tag: '白', price: 45,
    ingredients: [{ name: '冬瓜', qty: 300, unit: 'g' }, { name: '蛤蜊', qty: 200, unit: 'g' }] },
  { name: '苦瓜排骨湯', category: '湯品', protein_type: '豬', cooking_method: '煮', color_tag: '綠', price: 50, is_pork: 1,
    ingredients: [{ name: '苦瓜', qty: 300, unit: 'g' }, { name: '排骨', qty: 250, unit: 'g' }] },
  { name: '竹筍排骨湯', category: '湯品', protein_type: '豬', cooking_method: '煮', color_tag: '白', price: 50, is_pork: 1,
    ingredients: [{ name: '桂竹筍', qty: 300, unit: 'g' }, { name: '排骨', qty: 250, unit: 'g' }] },
  { name: '紫菜蛋花湯', category: '湯品', protein_type: '蛋', cooking_method: '煮', color_tag: '黑', price: 30,
    ingredients: [{ name: '紫菜', qty: 30, unit: 'g' }, { name: '雞蛋', qty: 3, unit: '顆' }] },

  // ---- 甜點 ----
  { name: '紅豆湯圓', category: '甜點', protein_type: '素', cooking_method: '煮', color_tag: '紅', price: 30, is_soft: 1,
    ingredients: [{ name: '紅豆', qty: 200, unit: 'g' }, { name: '小湯圓', qty: 150, unit: 'g' }] },
  { name: '布丁', category: '甜點', protein_type: '素', cooking_method: '其他', color_tag: '黃', price: 25, is_soft: 1,
    ingredients: [{ name: '雞蛋布丁', qty: 6, unit: '個' }] },
  { name: '涼糕', category: '甜點', protein_type: '素', cooking_method: '其他', color_tag: '白', price: 25,
    ingredients: [{ name: '涼糕', qty: 6, unit: '塊' }] },
  { name: '芒果青', category: '甜點', protein_type: '素', cooking_method: '生食', color_tag: '橙', price: 30,
    ingredients: [{ name: '芒果', qty: 400, unit: 'g' }] },
  { name: '仙草凍', category: '甜點', protein_type: '素', cooking_method: '其他', color_tag: '黑', price: 25,
    ingredients: [{ name: '仙草凍', qty: 500, unit: 'g' }] },
  { name: '桂圓紅棗茶凍', category: '甜點', protein_type: '素', cooking_method: '其他', color_tag: '褐', price: 28,
    ingredients: [{ name: '桂圓', qty: 60, unit: 'g' }, { name: '紅棗', qty: 40, unit: 'g' }] },
  { name: '綠豆湯', category: '甜點', protein_type: '素', cooking_method: '煮', color_tag: '綠', price: 25, is_soft: 1,
    ingredients: [{ name: '綠豆', qty: 250, unit: 'g' }] },
  { name: '銀耳蓮子湯', category: '甜點', protein_type: '素', cooking_method: '煮', color_tag: '白', price: 30, is_soft: 1,
    ingredients: [{ name: '白木耳', qty: 60, unit: 'g' }, { name: '蓮子', qty: 100, unit: 'g' }] },

  // ---- 飲料 ----
  { name: '古早味紅茶', category: '飲料', protein_type: '素', cooking_method: '其他', color_tag: '褐', price: 20,
    ingredients: [{ name: '紅茶', qty: 2000, unit: 'ml' }] },
  { name: '冬瓜茶', category: '飲料', protein_type: '素', cooking_method: '其他', color_tag: '褐', price: 20,
    ingredients: [{ name: '冬瓜茶磚', qty: 200, unit: 'g' }] },
  { name: '仙草蜜', category: '飲料', protein_type: '素', cooking_method: '其他', color_tag: '黑', price: 25,
    ingredients: [{ name: '仙草凍', qty: 500, unit: 'g' }] },
  { name: '柳橙汁', category: '飲料', protein_type: '素', cooking_method: '其他', color_tag: '橙', price: 25,
    ingredients: [{ name: '柳橙原汁', qty: 1500, unit: 'ml' }] },
  { name: '檸檬愛玉', category: '飲料', protein_type: '素', cooking_method: '其他', color_tag: '黃', price: 25,
    ingredients: [{ name: '愛玉凍', qty: 500, unit: 'g' }, { name: '檸檬汁', qty: 100, unit: 'ml' }] },
  { name: '梅子綠茶', category: '飲料', protein_type: '素', cooking_method: '其他', color_tag: '綠', price: 25,
    ingredients: [{ name: '綠茶', qty: 1800, unit: 'ml' }, { name: '梅子醬', qty: 100, unit: 'g' }] },
  { name: '決明子茶', category: '飲料', protein_type: '素', cooking_method: '其他', color_tag: '褐', price: 20,
    ingredients: [{ name: '決明子', qty: 60, unit: 'g' }] },
  { name: '米漿', category: '飲料', protein_type: '素', cooking_method: '其他', color_tag: '白', price: 25,
    ingredients: [{ name: '在來米', qty: 200, unit: 'g' }, { name: '花生', qty: 60, unit: 'g' }] },
];

const DISHES = [...generateMainDishes(), ...generateSideDishes(), ...generateVegDishes(), ...OTHER_DISHES];

module.exports = { DISHES };
