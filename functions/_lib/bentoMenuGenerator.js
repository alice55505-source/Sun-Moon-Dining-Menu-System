// 自動排「整月」便當菜單：每天固定 2 主菜(1一般+1不豬)、3 副菜(基本/70加/80加)、2 時蔬。
// 排菜邏輯與 monthlyMenuGenerator.js（合菜）相同（洗牌袋 + 當天排除條件），只是每天的
// slot 數量不同（副菜多一道）。兩邊各自維護一份，不抽共用模組，方便日後各自調整規則。

function daysInMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

class ShuffleBag {
  constructor(pool) {
    this.pool = pool;
    this.queue = shuffle(pool);
  }

  draw(excludeIds = []) {
    if (this.pool.length === 0) return null;
    const setAside = [];
    let picked = null;
    while (this.queue.length > 0) {
      const candidate = this.queue.shift();
      if (!excludeIds.includes(candidate.id)) {
        picked = candidate;
        break;
      }
      setAside.push(candidate);
    }
    this.queue.push(...setAside);
    if (!picked) {
      this.queue = shuffle(this.pool);
      picked = this.queue.find((d) => !excludeIds.includes(d.id)) || this.pool[0];
      this.queue = this.queue.filter((d) => d.id !== picked.id);
    }
    return picked;
  }
}

function dayRejectFn(picked, extraRejectFn) {
  return (d) => {
    const friedCount = picked.filter((p) => p.cooking_method === '炸').length;
    const spicyCount = picked.filter((p) => p.is_spicy).length;
    if (d.cooking_method === '炸' && friedCount >= 2) return true;
    if (d.is_spicy && spicyCount >= 2) return true;
    if (d.flavor_style && picked.some((p) => p.flavor_style === d.flavor_style)) return true;
    if (d.main_ingredient && picked.some((p) => p.main_ingredient === d.main_ingredient)) return true;
    if (extraRejectFn && extraRejectFn(d)) return true;
    return false;
  };
}

function drawAvoiding(bag, excludeIds, rejectFn, maxAttempts = 8) {
  const rejected = [];
  let result = null;
  for (let i = 0; i < maxAttempts; i++) {
    const candidate = bag.draw([...excludeIds, ...rejected.map((r) => r.id)]);
    if (!candidate) break;
    if (!rejectFn(candidate)) {
      result = candidate;
      break;
    }
    rejected.push(candidate);
  }
  if (!result) {
    result = bag.draw(excludeIds) || rejected[0] || null;
  }
  return result;
}

export async function generateBentoMonthCalendar(db, month) {
  const [{ results: mainDishes }, { results: sideDishes }, { results: vegDishes }] = await Promise.all([
    db.prepare('SELECT * FROM dishes WHERE category = ?').bind('主菜').all(),
    db.prepare('SELECT * FROM dishes WHERE category = ?').bind('副菜').all(),
    db.prepare('SELECT * FROM dishes WHERE category = ?').bind('時蔬').all(),
  ]);

  if (mainDishes.length === 0 || sideDishes.length === 0 || vegDishes.length === 0) {
    return {
      month,
      days: [],
      error: '菜色資料庫的主菜/副菜/時蔬數量不足，請先到「菜色資料庫」新增菜色',
    };
  }

  const noPorkMains = mainDishes.filter((d) => !d.is_pork);
  const bagMainAll = new ShuffleBag(mainDishes);
  const bagMainNoPork = new ShuffleBag(noPorkMains.length > 0 ? noPorkMains : mainDishes);
  const bagSide = new ShuffleBag(sideDishes);
  const bagVeg = new ShuffleBag(vegDishes);

  const total = daysInMonth(month);
  const days = [];

  for (let day = 1; day <= total; day++) {
    const date = `${month}-${String(day).padStart(2, '0')}`;
    const picked = [];
    const pickedIds = () => picked.map((p) => p.dish_id);
    const mainProteins = () => picked.filter((p) => p.slot_category === '主菜' && p.protein_type !== '素').map((p) => p.protein_type);

    const notPork = drawAvoiding(bagMainNoPork, pickedIds(), dayRejectFn(picked));
    picked.push({ slot_category: '主菜', variant: '不豬', ...notPork, dish_id: notPork.id });

    const general = drawAvoiding(bagMainAll, pickedIds(), dayRejectFn(picked));
    picked.push({ slot_category: '主菜', variant: '一般', ...general, dish_id: general.id });

    for (const variant of ['基本', '70加', '80加']) {
      const mains = mainProteins();
      const side = drawAvoiding(
        bagSide,
        pickedIds(),
        dayRejectFn(picked, (d) => d.protein_type !== '素' && mains.includes(d.protein_type))
      );
      picked.push({ slot_category: '副菜', variant, ...side, dish_id: side.id });
    }

    for (let i = 0; i < 2; i++) {
      const veg = drawAvoiding(bagVeg, pickedIds(), dayRejectFn(picked));
      picked.push({ slot_category: '時蔬', variant: '一般', ...veg, dish_id: veg.id });
    }

    days.push({ date, items: picked });
  }

  return { month, days };
}

export async function saveBentoMonthCalendar(db, month, days) {
  const total = daysInMonth(month);
  const from = `${month}-01`;
  const to = `${month}-${String(total).padStart(2, '0')}`;
  await db.prepare('DELETE FROM bento_menu_items WHERE menu_date >= ? AND menu_date <= ?').bind(from, to).run();

  for (const day of days) {
    let sortOrder = 0;
    for (const it of day.items) {
      await db
        .prepare(
          'INSERT INTO bento_menu_items (menu_date, slot_category, variant, dish_id, sort_order) VALUES (?, ?, ?, ?, ?)'
        )
        .bind(day.date, it.slot_category, it.variant, it.dish_id, sortOrder)
        .run();
      sortOrder += 1;
    }
  }
}

export { daysInMonth };
