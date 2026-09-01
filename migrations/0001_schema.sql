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

-- ==================== 便當板塊 ====================
-- 工廠訂單：便當（依 50/55/60/65/70/75/80 元價位分級）或合菜（68/70/75/80 元）。
-- 工廠訂便當原則上是整個月都固定訂，所以訂單是「掛在某個月份」（order_month，YYYY-MM），
-- 一旦建立就視為那個月每一天都沿用同樣的價位/份數，不用每天重新下單。
-- 菜色組合不用人工客製化，是依當天日期 + order_type + price_tier + opt_no_pork
-- 即時算出來的（見 functions/_lib/bentoOrderResolve.js），所以不需要另一張逐筆菜單表。
CREATE TABLE IF NOT EXISTS bento_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_month TEXT NOT NULL,
  meal_period TEXT NOT NULL DEFAULT '午餐',
  order_type TEXT NOT NULL DEFAULT '便當',
  price_tier REAL NOT NULL DEFAULT 50,
  vendor_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  opt_no_pork INTEGER NOT NULL DEFAULT 0,
  opt_soup INTEGER NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  menu_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bento_orders_month ON bento_orders(order_month);

-- 便當「每一天」的菜單。主菜: variant=一般/不豬（各1道）；
-- 副菜: variant=基本/70加/80加（各1道，共3道，價位達門檻才計入）；
-- 時蔬: variant=一般（固定2道，所有價位都有）。
CREATE TABLE IF NOT EXISTS bento_menu_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  menu_date TEXT NOT NULL,
  slot_category TEXT NOT NULL,
  variant TEXT NOT NULL DEFAULT '一般',
  dish_id INTEGER NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_bento_menu_items_date ON bento_menu_items(menu_date);

-- ==================== 庫存板塊（取代採購清單） ====================
-- 庫存清點：目前每項食材手上有多少（只存「目前」這一份快照，不是逐筆進出貨紀錄）。
-- 食材採買（functions/_lib/purchase.js）會拿「當天訂單需求」減掉這裡的庫存量，
-- 算出實際還要採買多少，key 用 name+unit 跟 aggregateIngredients() 對齊。
CREATE TABLE IF NOT EXISTS inventory_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  qty REAL NOT NULL DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_items_name_unit ON inventory_items(name, unit);
