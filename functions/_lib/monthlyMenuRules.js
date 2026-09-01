// 月菜單五大原則檢核
// 1. 一個月不重複（同食材+同烹調方式不可重複出現，同食材不同烹調方式可接受）
// 2. 考量整體色彩搭配（避免同色系過多）
// 3. 考量烹調方式（如炸物不能太多項）
// 4. 主菜和副菜不能用同一種肉類（同一保護級蛋白質重疊）
// 5. 辣菜只能1~2樣

export function validateMonthlyMenu(items) {
  // items: [{ slot_category, variant, dish }] dish has name/cooking_method/color_tag/is_spicy/protein_type
  const warnings = [];

  // 規則1：同食材(name)+同烹調方式不可重複
  const seen = new Map();
  for (const it of items) {
    const key = `${it.dish.name}__${it.dish.cooking_method}`;
    if (seen.has(key)) {
      warnings.push({
        rule: 1,
        level: 'error',
        message: `「${it.dish.name}」的烹調方式「${it.dish.cooking_method}」在本月菜單中重複出現`,
      });
    }
    seen.set(key, true);
  }

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

  return warnings;
}
