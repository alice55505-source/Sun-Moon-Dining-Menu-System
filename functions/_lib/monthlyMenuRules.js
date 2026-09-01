// 月菜單五大原則檢核
// 1. 一個月不重複（同食材+同烹調方式不可重複出現，同食材不同烹調方式可接受）
//    — 月菜單現在是「每天一份」的行事曆，規則1改由 summarizeMonthRepeats() 在整個
//      月的範圍檢查；下面的 validateMonthlyMenu() 負責檢查「同一天」內的規則2~5
//      （一天的菜色本來就不會重複選同一道菜，規則1在單日層級沒有意義）。
// 2. 考量整體色彩搭配（避免同色系過多）
// 3. 考量烹調方式（如炸物不能太多項）
// 4. 主菜和副菜不能用同一種肉類（同一保護級蛋白質重疊）
// 5. 辣菜只能1~2樣
// 6. 同一天不可有兩道相同調味風格（如兩道紅燒、兩道涼拌、兩道麻辣）
// 7. 同一天不可有兩道使用相同主食材（如涼拌娃娃菜+清炒娃娃菜）

export function validateMonthlyMenu(items) {
  // items: [{ slot_category, variant, dish }] dish has name/cooking_method/color_tag/is_spicy/protein_type
  const warnings = [];

  // 規則2：色彩搭配 — 同色系比例過半提出警告
  const colorCount = {};
  for (const it of items) {
    colorCount[it.dish.color_tag] = (colorCount[it.dish.color_tag] || 0) + 1;
  }
  const total = items.length || 1;
  for (const [color, cnt] of Object.entries(colorCount)) {
    if (cnt / total > 0.5) {
      warnings.push({
        rule: 2,
        level: 'warning',
        message: `「${color}」色系菜色比例過高（${cnt}/${total}），建議增加其他顏色搭配`,
      });
    }
  }

  // 規則3：烹調方式 — 炸物不超過2項
  const friedCount = items.filter((it) => it.dish.cooking_method === '炸').length;
  if (friedCount > 2) {
    warnings.push({
      rule: 3,
      level: 'warning',
      message: `油炸類菜色共 ${friedCount} 項，建議不超過 2 項`,
    });
  }

  // 規則4：主菜與副菜不可使用同一種肉類（同一 protein_type，素食除外）
  const mainProteins = new Set(
    items.filter((it) => it.slot_category === '主菜' && it.dish.protein_type !== '素').map((it) => it.dish.protein_type)
  );
  const sideProteins = new Set(
    items.filter((it) => it.slot_category === '副菜' && it.dish.protein_type !== '素').map((it) => it.dish.protein_type)
  );
  for (const p of mainProteins) {
    if (sideProteins.has(p)) {
      warnings.push({
        rule: 4,
        level: 'warning',
        message: `主菜與副菜同時使用「${p}」肉類，建議副菜改用不同肉類或素食`,
      });
    }
  }

  // 規則5：辣菜只能1~2樣
  const spicyCount = items.filter((it) => it.dish.is_spicy).length;
  if (spicyCount > 2) {
    warnings.push({
      rule: 5,
      level: 'warning',
      message: `辣味菜色共 ${spicyCount} 樣，建議控制在 1~2 樣`,
    });
  }

  // 規則6：同一天不可有兩道相同調味風格（僅比對有填 flavor_style 的菜）
  const flavorGroups = new Map();
  for (const it of items) {
    const style = it.dish.flavor_style;
    if (!style) continue;
    if (!flavorGroups.has(style)) flavorGroups.set(style, []);
    flavorGroups.get(style).push(it.dish.name);
  }
  for (const [style, names] of flavorGroups) {
    if (names.length > 1) {
      warnings.push({
        rule: 6,
        level: 'warning',
        message: `「${style}」調味風格重複出現於：${names.join('、')}，建議改用不同調味`,
      });
    }
  }

  // 規則7：同一天不可有兩道使用相同主食材（僅比對有填 main_ingredient 的菜）
  const ingredientGroups = new Map();
  for (const it of items) {
    const ing = it.dish.main_ingredient;
    if (!ing) continue;
    if (!ingredientGroups.has(ing)) ingredientGroups.set(ing, []);
    ingredientGroups.get(ing).push(it.dish.name);
  }
  for (const [ing, names] of ingredientGroups) {
    if (names.length > 1) {
      warnings.push({
        rule: 7,
        level: 'warning',
        message: `主食材「${ing}」重複出現於：${names.join('、')}，建議改用不同食材`,
      });
    }
  }

  return warnings;
}

// 規則1（月層級）：統計整個月當中，同一道「食材+烹調方式」組合出現幾次。
// days: [{ date, items: [{ slot_category, variant, dish }] }]
export function summarizeMonthRepeats(days) {
  const counts = new Map(); // key -> { name, cooking_method, dates: [] }
  for (const day of days) {
    for (const it of day.items) {
      const key = `${it.dish.name}__${it.dish.cooking_method}`;
      if (!counts.has(key)) {
        counts.set(key, { name: it.dish.name, cooking_method: it.dish.cooking_method, dates: [] });
      }
      counts.get(key).dates.push(day.date);
    }
  }
  const repeats = Array.from(counts.values())
    .filter((c) => c.dates.length > 1)
    .sort((a, b) => b.dates.length - a.dates.length);

  return {
    totalSlots: days.reduce((s, d) => s + d.items.length, 0),
    distinctCombos: counts.size,
    repeats,
  };
}
