// 產生 migrations/0002_seed.sql：把 scripts/seedData.js 內的示範資料轉成純 SQL INSERT語句，
// 供 D1（Cloudflare）與本地 SQLite 共用同一份種子資料。
//
// 使用多列 VALUES（一個 INSERT 塞多筆資料）而不是一筆資料一個 INSERT，是為了大幅
// 減少陳述式數量——菜色資料庫有 300 多道菜、上千筆食材，逐筆 INSERT 會產生上千個
// 陳述式，透過 D1 REST API 執行時光是回傳的執行結果（每個陳述式一份 meta）就會超
// 過訊息大小上限。
const fs = require('fs');
const path = require('path');

const { DISHES } = require('./seedData');

function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const lines = [];
lines.push('-- 自動產生，請勿手動編輯。來源：scripts/seedData.js（執行 node scripts/generate-seed-sql.js 重新產生）');
lines.push('DELETE FROM order_menu_items;');
lines.push('DELETE FROM orders;');
lines.push('DELETE FROM monthly_menu_items;');
lines.push('DELETE FROM dish_ingredients;');
lines.push('DELETE FROM dishes;');
lines.push('');

const dishRows = DISHES.map((d, idx) => {
  const id = idx + 1;
  return {
    id,
    row: `(${id}, ${esc(d.name)}, ${esc(d.category)}, ${d.is_pork ? 1 : 0}, ${esc(d.protein_type || '素')}, ${esc(
      d.cooking_method || '其他'
    )}, ${esc(d.color_tag || '其他')}, ${d.is_spicy ? 1 : 0}, ${d.is_soft ? 1 : 0}, ${d.price || 0}, ${esc(
      d.notes || ''
    )}, ${esc(d.flavor_style || '')}, ${esc(d.main_ingredient || '')})`,
  };
});

for (const group of chunk(dishRows, 40)) {
  lines.push(
    'INSERT INTO dishes (id, name, category, is_pork, protein_type, cooking_method, color_tag, is_spicy, is_soft, price, notes, flavor_style, main_ingredient) VALUES\n' +
      group.map((g) => g.row).join(',\n') +
      ';'
  );
}
lines.push('');

const ingredientRows = [];
DISHES.forEach((d, idx) => {
  const id = idx + 1;
  for (const ing of d.ingredients || []) {
    ingredientRows.push(`(${id}, ${esc(ing.name)}, ${ing.qty}, ${esc(ing.unit)})`);
  }
});

for (const group of chunk(ingredientRows, 80)) {
  lines.push('INSERT INTO dish_ingredients (dish_id, name, qty, unit) VALUES\n' + group.join(',\n') + ';');
}

// 月菜單改為每日行事曆，由「月菜單管理」頁面的「自動排本月菜單」功能產生，
// 不再於種子資料中預先寫入固定的月菜單。

fs.writeFileSync(path.join(__dirname, '..', 'migrations', '0002_seed.sql'), lines.join('\n') + '\n');
console.log('已產生 migrations/0002_seed.sql');
