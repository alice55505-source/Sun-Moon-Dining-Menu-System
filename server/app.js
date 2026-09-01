const path = require('path');
const express = require('express');
const db = require('./db');
const seed = require('./seed');
const { validateMonthlyMenu } = require('./monthlyMenuRules');
const {
  generateCustomMenu,
  PRICE_THRESHOLD,
  HIGH_TIER_MAX_ITEMS,
  getMaxItemsForPrice,
} = require('./customMenuGenerator');
const { getOrderIngredientBreakdown, getPurchaseListByDate } = require('./purchase');

seed();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const DISH_CATEGORIES = ['主食', '主菜', '副菜', '時蔬', '配菜', '湯品', '甜點', '飲料'];

// ---------- 菜色資料庫 ----------

app.get('/api/dishes', (req, res) => {
  const { category } = req.query;
  const rows = category
    ? db.prepare('SELECT * FROM dishes WHERE category = ? ORDER BY name').all(category)
    : db.prepare('SELECT * FROM dishes ORDER BY category, name').all();
  const ingStmt = db.prepare('SELECT id, name, qty, unit FROM dish_ingredients WHERE dish_id = ?');
  const withIngredients = rows.map((d) => ({ ...d, ingredients: ingStmt.all(d.id) }));
  res.json(withIngredients);
});

app.get('/api/dishes/:id', (req, res) => {
  const dish = db.prepare('SELECT * FROM dishes WHERE id = ?').get(req.params.id);
  if (!dish) return res.status(404).json({ error: '找不到菜色' });
  dish.ingredients = db.prepare('SELECT id, name, qty, unit FROM dish_ingredients WHERE dish_id = ?').all(dish.id);
  res.json(dish);
});

app.post('/api/dishes', (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.category) return res.status(400).json({ error: 'name 與 category 為必填' });
  const insert = db.prepare(`
    INSERT INTO dishes (name, category, is_pork, protein_type, cooking_method, color_tag, is_spicy, is_soft, price, notes)
    VALUES (@name, @category, @is_pork, @protein_type, @cooking_method, @color_tag, @is_spicy, @is_soft, @price, @notes)
  `);
  const info = insert.run({
    name: b.name,
    category: b.category,
    is_pork: b.is_pork ? 1 : 0,
    protein_type: b.protein_type || '素',
    cooking_method: b.cooking_method || '其他',
    color_tag: b.color_tag || '其他',
    is_spicy: b.is_spicy ? 1 : 0,
    is_soft: b.is_soft ? 1 : 0,
    price: b.price || 0,
    notes: b.notes || '',
  });
  const dishId = info.lastInsertRowid;
  if (Array.isArray(b.ingredients)) {
    const ins = db.prepare('INSERT INTO dish_ingredients (dish_id, name, qty, unit) VALUES (?, ?, ?, ?)');
    for (const ing of b.ingredients) {
      if (ing.name && ing.qty != null && ing.unit) ins.run(dishId, ing.name, ing.qty, ing.unit);
    }
  }
  res.json(db.prepare('SELECT * FROM dishes WHERE id = ?').get(dishId));
});

app.put('/api/dishes/:id', (req, res) => {
  const b = req.body || {};
  const existing = db.prepare('SELECT * FROM dishes WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '找不到菜色' });
  db.prepare(`
    UPDATE dishes SET name=@name, category=@category, is_pork=@is_pork, protein_type=@protein_type,
      cooking_method=@cooking_method, color_tag=@color_tag, is_spicy=@is_spicy, is_soft=@is_soft,
      price=@price, notes=@notes WHERE id=@id
  `).run({
    id: req.params.id,
    name: b.name ?? existing.name,
    category: b.category ?? existing.category,
    is_pork: b.is_pork ? 1 : 0,
    protein_type: b.protein_type || existing.protein_type,
    cooking_method: b.cooking_method || existing.cooking_method,
    color_tag: b.color_tag || existing.color_tag,
    is_spicy: b.is_spicy ? 1 : 0,
    is_soft: b.is_soft ? 1 : 0,
    price: b.price ?? existing.price,
    notes: b.notes ?? existing.notes,
  });
  if (Array.isArray(b.ingredients)) {
    db.prepare('DELETE FROM dish_ingredients WHERE dish_id = ?').run(req.params.id);
    const ins = db.prepare('INSERT INTO dish_ingredients (dish_id, name, qty, unit) VALUES (?, ?, ?, ?)');
    for (const ing of b.ingredients) {
      if (ing.name && ing.qty != null && ing.unit) ins.run(req.params.id, ing.name, ing.qty, ing.unit);
    }
  }
  const dish = db.prepare('SELECT * FROM dishes WHERE id = ?').get(req.params.id);
  dish.ingredients = db.prepare('SELECT id, name, qty, unit FROM dish_ingredients WHERE dish_id = ?').all(dish.id);
  res.json(dish);
});

app.delete('/api/dishes/:id', (req, res) => {
  db.prepare('DELETE FROM dishes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/meta/categories', (req, res) => {
  res.json({
    dishCategories: DISH_CATEGORIES,
    proteinTypes: ['雞', '豬', '牛', '羊', '魚', '海鮮', '蛋', '豆', '素', '其他'],
    cookingMethods: ['炒', '炸', '滷', '蒸', '煮', '涼拌', '烤', '生食', '其他'],
    colorTags: ['紅', '橙', '黃', '綠', '藍', '紫', '白', '黑', '褐', '其他'],
  });
});

// ---------- 月菜單 ----------

app.get('/api/monthly-menu', (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const items = db
    .prepare(
      `SELECT mmi.id, mmi.month, mmi.slot_category, mmi.variant, mmi.sort_order, d.*
       FROM monthly_menu_items mmi JOIN dishes d ON d.id = mmi.dish_id
       WHERE mmi.month = ? ORDER BY mmi.slot_category, mmi.sort_order`
    )
    .all(month);
  const warnings = validateMonthlyMenu(
    items.map((it) => ({ slot_category: it.slot_category, variant: it.variant, dish: it }))
  );
  res.json({ month, items, warnings });
});

app.post('/api/monthly-menu', (req, res) => {
  const { month, slot_category, variant, dish_id, sort_order } = req.body || {};
  if (!month || !slot_category || !dish_id) return res.status(400).json({ error: 'month, slot_category, dish_id 為必填' });
  const info = db
    .prepare('INSERT INTO monthly_menu_items (month, slot_category, variant, dish_id, sort_order) VALUES (?, ?, ?, ?, ?)')
    .run(month, slot_category, variant || '一般', dish_id, sort_order || 0);
  res.json({ id: info.lastInsertRowid });
});

app.delete('/api/monthly-menu/:id', (req, res) => {
  db.prepare('DELETE FROM monthly_menu_items WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.post('/api/monthly-menu/validate', (req, res) => {
  const { items } = req.body || {}; // [{slot_category, variant, dish_id}]
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items 為必填陣列' });
  const dishStmt = db.prepare('SELECT * FROM dishes WHERE id = ?');
  const resolved = items.map((it) => ({ slot_category: it.slot_category, variant: it.variant, dish: dishStmt.get(it.dish_id) })).filter((it) => it.dish);
  res.json({ warnings: validateMonthlyMenu(resolved) });
});

// ---------- 訂單（合菜）----------

const ORDER_FIELDS = [
  'delivery_date', 'delivery_time', 'quantity', 'unit_price', 'customer_name', 'customer_phone',
  'deposit', 'driver', 'delivery_address',
  'tableware_veg_clip', 'tableware_veg_spoon', 'tableware_rice_spoon', 'tableware_soup_spoon',
  'tableware_bowl', 'tableware_plate', 'tableware_chopsticks', 'tableware_cup',
  'notes', 'opt_no_pork', 'opt_no_spicy', 'opt_hearty', 'opt_kids', 'opt_elderly',
];

function normalizeOrderBody(b) {
  const out = {};
  for (const f of ORDER_FIELDS) {
    if (f.startsWith('opt_')) out[f] = b[f] ? 1 : 0;
    else if (f.startsWith('tableware_')) out[f] = Number(b[f]) || 0;
    else out[f] = b[f] ?? '';
  }
  out.quantity = Number(b.quantity) || 1;
  out.unit_price = Number(b.unit_price) || 0;
  out.deposit = Number(b.deposit) || 0;
  return out;
}

app.get('/api/orders', (req, res) => {
  const { date, status } = req.query;
  let sql = 'SELECT * FROM orders';
  const conds = [];
  const params = [];
  if (date) { conds.push('delivery_date = ?'); params.push(date); }
  if (status) { conds.push('menu_status = ?'); params.push(status); }
  if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
  sql += ' ORDER BY delivery_date, delivery_time';
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/orders/:id', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: '找不到訂單' });
  const menuItems = db
    .prepare(`SELECT omi.*, d.name AS dish_name, d.category AS dish_category FROM order_menu_items omi JOIN dishes d ON d.id = omi.dish_id WHERE omi.order_id = ? ORDER BY omi.sort_order`)
    .all(order.id);
  res.json({ ...order, menuItems });
});

app.post('/api/orders', (req, res) => {
  const b = normalizeOrderBody(req.body || {});
  if (!b.delivery_date || !b.customer_name) return res.status(400).json({ error: '出貨日期與客戶姓名為必填' });
  const cols = ORDER_FIELDS.join(', ');
  const placeholders = ORDER_FIELDS.map((f) => `@${f}`).join(', ');
  const info = db.prepare(`INSERT INTO orders (${cols}) VALUES (${placeholders})`).run(b);
  res.json(db.prepare('SELECT * FROM orders WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/orders/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '找不到訂單' });
  const merged = normalizeOrderBody({ ...existing, ...req.body });
  const setSql = ORDER_FIELDS.map((f) => `${f}=@${f}`).join(', ');
  db.prepare(`UPDATE orders SET ${setSql}, updated_at=datetime('now') WHERE id=@id`).run({ ...merged, id: req.params.id });
  res.json(db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id));
});

app.delete('/api/orders/:id', (req, res) => {
  db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// 依訂單條件（不豬/不辣/粗飽/孩子/老人）+ 當月月菜單，自動產生客製化菜單建議
app.post('/api/orders/:id/generate-menu', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: '找不到訂單' });
  const plan = generateCustomMenu(order);
  res.json(plan);
});

// 儲存/確認客製化菜單（可編輯後的最終版本，price 可修改）
app.put('/api/orders/:id/menu', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: '找不到訂單' });
  const { items, confirm } = req.body || {};
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items 為必填陣列' });
  const totalPrice = items.reduce((s, it) => s + (Number(it.price) || 0), 0);
  if (items.length > HIGH_TIER_MAX_ITEMS) {
    return res.status(400).json({ error: `最多 ${HIGH_TIER_MAX_ITEMS} 樣菜色` });
  }
  const maxItemsAllowed = getMaxItemsForPrice(totalPrice);
  if (items.length > maxItemsAllowed) {
    return res.status(400).json({
      error: `總價 $${totalPrice} 在 ${PRICE_THRESHOLD} 元以內最多 ${maxItemsAllowed} 樣，若要選 ${items.length} 樣，總價需超過 ${PRICE_THRESHOLD} 元`,
    });
  }

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM order_menu_items WHERE order_id = ?').run(order.id);
    const ins = db.prepare('INSERT INTO order_menu_items (order_id, category, dish_id, price, sort_order) VALUES (?, ?, ?, ?, ?)');
    items.forEach((it, idx) => {
      ins.run(order.id, it.category, it.dish_id, Number(it.price) || 0, idx);
    });
    db.prepare(`UPDATE orders SET menu_status = ?, updated_at = datetime('now') WHERE id = ?`).run(
      confirm ? 'confirmed' : 'draft',
      order.id
    );
  });
  tx();

  const menuItems = db
    .prepare(`SELECT omi.*, d.name AS dish_name FROM order_menu_items omi JOIN dishes d ON d.id = omi.dish_id WHERE omi.order_id = ? ORDER BY omi.sort_order`)
    .all(order.id);
  res.json({ order: db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id), menuItems });
});

// 訂單食材需求（依訂單數量放大）與預算
app.get('/api/orders/:id/ingredients', (req, res) => {
  const breakdown = getOrderIngredientBreakdown(req.params.id);
  if (!breakdown) return res.status(404).json({ error: '找不到訂單' });
  res.json(breakdown);
});

// ---------- 採購清單 ----------

app.get('/api/purchase', (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date 查詢參數為必填 (YYYY-MM-DD)' });
  res.json(getPurchaseListByDate(date));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`日月自助餐出菜單系統已啟動: http://localhost:${PORT}`);
});
