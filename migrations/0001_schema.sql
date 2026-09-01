CREATE TABLE IF NOT EXISTS dishes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  is_pork INTEGER NOT NULL DEFAULT 0,
  protein_type TEXT NOT NULL DEFAULT '素',
  cooking_method TEXT NOT NULL DEFAULT '其他',
  color_tag TEXT NOT NULL DEFAULT '其他',
  is_spicy INTEGER NOT NULL DEFAULT 0,
  is_soft INTEGER NOT NULL DEFAULT 0,
  price REAL NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  -- flavor_style（調味風格，如 紅燒/塔香/涼拌/麻辣）與 main_ingredient（主食材，如 娃娃菜/牛小排）
  -- 只用於主菜/副菜/時蔬：月菜單排菜時，同一天不可出現兩道相同調味風格或相同主食材的菜
  flavor_style TEXT DEFAULT '',
  main_ingredient TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dish_ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dish_id INTEGER NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  qty REAL NOT NULL,
  unit TEXT NOT NULL
);

-- 月菜單其實是「每一天」的菜單集合：每天固定 2 主菜(1一般+1不豬)+2副菜+2時蔬。
-- menu_date 是實際日期（YYYY-MM-DD），而不是整個月共用同一份菜單。
CREATE TABLE IF NOT EXISTS monthly_menu_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  menu_date TEXT NOT NULL,
  slot_category TEXT NOT NULL,
  variant TEXT NOT NULL DEFAULT '一般',
  dish_id INTEGER NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_monthly_menu_items_date ON monthly_menu_items(menu_date);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  delivery_date TEXT NOT NULL,
  delivery_time TEXT DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  customer_name TEXT NOT NULL,
  customer_phone TEXT DEFAULT '',
  deposit REAL NOT NULL DEFAULT 0,
  driver TEXT DEFAULT '',
  delivery_address TEXT DEFAULT '',
  tableware_veg_clip INTEGER NOT NULL DEFAULT 0,
  tableware_veg_spoon INTEGER NOT NULL DEFAULT 0,
  tableware_rice_spoon INTEGER NOT NULL DEFAULT 0,
  tableware_soup_spoon INTEGER NOT NULL DEFAULT 0,
  tableware_bowl INTEGER NOT NULL DEFAULT 0,
  tableware_plate INTEGER NOT NULL DEFAULT 0,
  tableware_chopsticks INTEGER NOT NULL DEFAULT 0,
  tableware_cup INTEGER NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  opt_no_pork INTEGER NOT NULL DEFAULT 0,
  opt_no_spicy INTEGER NOT NULL DEFAULT 0,
  opt_hearty INTEGER NOT NULL DEFAULT 0,
  opt_kids INTEGER NOT NULL DEFAULT 0,
  opt_elderly INTEGER NOT NULL DEFAULT 0,
  menu_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_menu_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  dish_id INTEGER NOT NULL REFERENCES dishes(id),
  price REAL NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);
