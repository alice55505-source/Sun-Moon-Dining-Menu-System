(() => {
  // 客製化菜單樣數上限：依訂單單價（客戶每桌/份單價）判斷，200元以內最多6樣；超過200元後上限放寬為12樣（可手動新增）
  const PRICE_THRESHOLD = 200;
  const LOW_TIER_MAX_ITEMS = 6;
  const HIGH_TIER_MAX_ITEMS = 12;
  function maxItemsForPrice(totalPrice) {
    return totalPrice > PRICE_THRESHOLD ? HIGH_TIER_MAX_ITEMS : LOW_TIER_MAX_ITEMS;
  }

  const state = {
    dishes: [],
    meta: { dishCategories: [], proteinTypes: [], cookingMethods: [], colorTags: [] },
    currentOrderDetailId: null,
    currentOrderUnitPrice: 0, // 目前開啟訂單的單價，用來決定客製化菜單樣數上限（6樣/12樣）
    currentGeneratedMenu: null, // holds items being edited before save
  };

  // ---------------- utils ----------------

  async function api(path, options) {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `請求失敗 (${res.status})`);
    return data;
  }

  function toast(msg, isError) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    el.classList.toggle('error', !!isError);
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.add('hidden'), 3200);
  }

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function money(n) {
    return Number(n || 0).toLocaleString('zh-Hant-TW');
  }

  function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
  function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
  document.querySelectorAll('.modal-backdrop').forEach((bd) => {
    bd.addEventListener('click', (e) => { if (e.target === bd) bd.classList.add('hidden'); });
  });

  // ---------------- tabs（兩層：合菜／便當／共用 -> 各自的子分頁） ----------------

  const TAB_LOADERS = {
    orders: loadOrders,
    monthly: loadMonthlyMenu,
    dishes: loadDishes,
    purchase: renderPurchase,
    'bento-orders': loadBentoOrders,
    'bento-monthly': loadBentoMonthlyMenu,
    'daily-sheet': loadDailySheet,
  };

  function activateTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tabName));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + tabName));
    if (TAB_LOADERS[tabName]) TAB_LOADERS[tabName]();
  }

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => activateTab(btn.dataset.tab));
  });

  document.querySelectorAll('.tab-top-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const group = btn.dataset.group;
      document.querySelectorAll('.tab-top-btn').forEach((b) => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.tab-sub-group').forEach((g) => g.classList.toggle('hidden', g.dataset.group !== group));
      const firstTab = document.querySelector(`.tab-sub-group[data-group="${group}"] .tab-btn`);
      if (firstTab) activateTab(firstTab.dataset.tab);
    });
  });

  // ================= 初始化 =================

  async function init() {
    state.meta = await api('/api/meta/categories');
    await refreshDishCache();
    populateDishFormSelects();
    populateDishFilterCategory();

    document.getElementById('orderFilterDate').addEventListener('change', loadOrders);
    document.getElementById('clearOrderFilter').addEventListener('click', () => {
      document.getElementById('orderFilterDate').value = '';
      loadOrders();
    });
    document.getElementById('btnNewOrder').addEventListener('click', () => openOrderForm());
    document.getElementById('orderForm').addEventListener('submit', submitOrderForm);
    document.getElementById('btnPrintOrder').addEventListener('click', () => window.print());

    const monthlyPicker = document.getElementById('monthlyPicker');
    monthlyPicker.value = new Date().toISOString().slice(0, 7);
    monthlyPicker.addEventListener('change', loadMonthlyMenu);

    document.getElementById('dishFilterCategory').addEventListener('change', loadDishes);
    document.getElementById('btnNewDish').addEventListener('click', () => openDishForm());
    document.getElementById('dishForm').addEventListener('submit', submitDishForm);
    document.getElementById('d_addIngredient').addEventListener('click', () => addIngredientRow());

    const purchaseDate = document.getElementById('purchaseDate');
    purchaseDate.value = new Date().toISOString().slice(0, 10);
    purchaseDate.addEventListener('change', renderPurchase);

    document.getElementById('bentoOrderFilterMonth').addEventListener('change', loadBentoOrders);
    document.getElementById('clearBentoOrderFilter').addEventListener('click', () => {
      document.getElementById('bentoOrderFilterMonth').value = '';
      loadBentoOrders();
    });
    document.getElementById('btnNewBentoOrder').addEventListener('click', () => openBentoOrderForm());
    document.getElementById('bentoOrderForm').addEventListener('submit', submitBentoOrderForm);
    document.getElementById('bo_order_type').addEventListener('change', populateBentoPriceTierOptions);

    const bentoMonthlyPicker = document.getElementById('bentoMonthlyPicker');
    bentoMonthlyPicker.value = new Date().toISOString().slice(0, 7);
    bentoMonthlyPicker.addEventListener('change', loadBentoMonthlyMenu);
    document.getElementById('btnGenerateBentoMonth').addEventListener('click', generateBentoMonth);
    document.getElementById('btnPrintBentoMonth').addEventListener('click', printBentoMonthlyCalendar);

    const dailySheetDate = document.getElementById('dailySheetDate');
    dailySheetDate.value = new Date().toISOString().slice(0, 10);
    dailySheetDate.addEventListener('change', loadDailySheet);
    document.getElementById('btnPrintDailySheet').addEventListener('click', printDailySheet);

    loadOrders();
  }

  async function refreshDishCache() {
    state.dishes = await api('/api/dishes');
  }

  function dishesByCategory(cat) {
    return state.dishes.filter((d) => d.category === cat);
  }

  // ================= 訂單管理 =================

  async function loadOrders() {
    const date = document.getElementById('orderFilterDate').value;
    const qs = date ? `?date=${date}` : '';
    const orders = await api('/api/orders' + qs);
    const tbody = document.getElementById('orderTableBody');
    tbody.innerHTML = '';
    if (orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;color:var(--muted)">尚無訂單</td></tr>';
      return;
    }
    for (const o of orders) {
      const total = o.unit_price * o.quantity;
      const balance = total - o.deposit;
      const statusLabel = { pending: '未排菜', draft: '草稿', confirmed: '已確認' }[o.menu_status] || o.menu_status;
      const tr = el(`
        <tr class="clickable" data-id="${o.id}">
          <td>${o.delivery_date}</td>
          <td>${o.delivery_time || ''}</td>
          <td>${escapeHtml(o.customer_name)}</td>
          <td>${escapeHtml(o.customer_phone || '')}</td>
          <td>${o.quantity}</td>
          <td>${money(o.unit_price)}</td>
          <td>${money(total)}</td>
          <td>${money(o.deposit)}</td>
          <td>${money(balance)}</td>
          <td>${escapeHtml(o.driver || '')}</td>
          <td><span class="status-badge status-${o.menu_status}">${statusLabel}</span></td>
          <td><button class="btn-ghost btn-small" data-edit="${o.id}">編輯</button>
              <button class="btn-danger btn-small" data-del="${o.id}">刪除</button></td>
        </tr>
      `);
      tr.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        openOrderDetail(o.id);
      });
      tbody.appendChild(tr);
    }
    tbody.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => openOrderForm(Number(b.dataset.edit)))
    );
    tbody.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!confirm('確定要刪除此訂單嗎？')) return;
        await api('/api/orders/' + b.dataset.del, { method: 'DELETE' });
        toast('訂單已刪除');
        loadOrders();
      })
    );
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  const ORDER_FORM_FIELDS = [
    'delivery_date', 'delivery_time', 'quantity', 'unit_price', 'customer_name', 'customer_phone',
    'deposit', 'driver', 'delivery_address',
    'tableware_veg_clip', 'tableware_veg_spoon', 'tableware_rice_spoon', 'tableware_soup_spoon',
    'tableware_bowl', 'tableware_plate', 'tableware_chopsticks', 'tableware_cup',
    'notes', 'opt_no_pork', 'opt_no_spicy', 'opt_hearty', 'opt_kids', 'opt_elderly',
  ];

  async function openOrderForm(orderId) {
    document.getElementById('orderForm').reset();
    document.getElementById('orderId').value = orderId || '';
    document.getElementById('orderModalTitle').textContent = orderId ? '編輯訂單' : '新增訂單';
    if (orderId) {
      const order = await api('/api/orders/' + orderId);
      for (const f of ORDER_FORM_FIELDS) {
        const input = document.getElementById('f_' + f);
        if (!input) continue;
        if (input.type === 'checkbox') input.checked = !!order[f];
        else input.value = order[f] ?? '';
      }
    } else {
      document.getElementById('f_quantity').value = 1;
    }
    openModal('orderModal');
  }

  async function submitOrderForm(e) {
    e.preventDefault();
    const orderId = document.getElementById('orderId').value;
    const body = {};
    for (const f of ORDER_FORM_FIELDS) {
      const input = document.getElementById('f_' + f);
      if (!input) continue;
      body[f] = input.type === 'checkbox' ? input.checked : input.value;
    }
    try {
      if (orderId) {
        await api('/api/orders/' + orderId, { method: 'PUT', body: JSON.stringify(body) });
        toast('訂單已更新');
      } else {
        await api('/api/orders', { method: 'POST', body: JSON.stringify(body) });
        toast('訂單已新增');
      }
      closeModal('orderModal');
      loadOrders();
    } catch (err) {
      toast(err.message, true);
    }
  }

  // ---------- 訂單詳情 / 客製化菜單 ----------

  const TABLEWARE_LABELS = {
    tableware_veg_clip: '菜夾', tableware_veg_spoon: '菜匙', tableware_rice_spoon: '飯匙',
    tableware_soup_spoon: '大湯匙', tableware_bowl: '六角碗', tableware_plate: '盤子',
    tableware_chopsticks: '筷子', tableware_cup: '紙杯',
  };
  const OPTION_LABELS = { opt_no_pork: '不豬', opt_no_spicy: '不辣', opt_hearty: '粗飽', opt_kids: '孩子', opt_elderly: '老人' };
  const MENU_CATEGORIES = ['主食', '主菜', '副菜', '配菜', '湯品', '甜點', '飲料'];

  async function openOrderDetail(orderId) {
    state.currentOrderDetailId = orderId;
    const order = await api('/api/orders/' + orderId);
    state.currentOrderUnitPrice = Number(order.unit_price) || 0;
    state.currentGeneratedMenu = order.menuItems.map((mi) => ({ category: mi.category, dish_id: mi.dish_id, name: mi.dish_name, price: mi.price }));
    renderOrderDetail(order);
    openModal('orderDetailModal');
  }

  function renderOrderDetail(order) {
    const total = order.unit_price * order.quantity;
    const balance = total - order.deposit;
    const tableware = Object.entries(TABLEWARE_LABELS)
      .map(([k, label]) => `${label} ${order[k]}`)
      .join('、');
    const options = Object.entries(OPTION_LABELS)
      .filter(([k]) => order[k])
      .map(([, label]) => label)
      .join('、') || '無';

    const body = document.getElementById('orderDetailBody');
    body.innerHTML = `
      <h2 class="print-only">日月自助餐 合菜訂單 - ${escapeHtml(order.customer_name)}（${order.delivery_date}）</h2>
      <div class="detail-grid">
        <div><span>出貨日期</span>${order.delivery_date} ${order.delivery_time || ''}</div>
        <div><span>客戶</span>${escapeHtml(order.customer_name)}（${escapeHtml(order.customer_phone || '')}）</div>
        <div><span>數量</span>${order.quantity}　<span>單價</span>${money(order.unit_price)}</div>
        <div><span>總額</span>${money(total)}　<span>訂金</span>${money(order.deposit)}　<span>尾款</span>${money(balance)}</div>
        <div><span>司機</span>${escapeHtml(order.driver || '')}</div>
        <div><span>送餐地址</span>${escapeHtml(order.delivery_address || '')}</div>
        <div style="grid-column:1/-1"><span>餐具</span>${tableware}</div>
        <div style="grid-column:1/-1"><span>客製化選項</span>${options}</div>
        <div style="grid-column:1/-1"><span>備註</span>${escapeHtml(order.notes || '')}</div>
      </div>

      <div class="section-title">客製化菜單（主食／主菜／副菜／配菜／湯品／甜點／飲料：訂單單價200元以內最多6樣，超過200元最多可達12樣）</div>
      <div id="genWarnings" class="no-print"></div>
      <div id="menuItemsList"></div>
      <div class="add-slot-row no-print" style="margin:10px 0">
        <select id="addMenuCategory">${MENU_CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join('')}</select>
        <select id="addMenuDish"></select>
        <button type="button" class="btn-ghost btn-small" id="addMenuItemBtn">＋ 加入</button>
      </div>
      <div class="menu-summary" id="menuSummary"></div>
      <div class="modal-actions no-print" style="justify-content:space-between">
        <button type="button" class="btn-ghost" id="btnAutoGenerate">🔄 依訂單條件自動產生建議菜單</button>
        <div style="display:flex;gap:10px">
          <button type="button" class="btn-ghost" id="btnSaveDraft">儲存草稿</button>
          <button type="button" class="btn-primary" id="btnConfirmMenu">確認菜單</button>
        </div>
      </div>
      <div id="ingredientSection"></div>
    `;

    populateAddMenuDishOptions();
    document.getElementById('addMenuCategory').addEventListener('change', populateAddMenuDishOptions);
    document.getElementById('addMenuItemBtn').addEventListener('click', addMenuItemFromPicker);
    document.getElementById('btnAutoGenerate').addEventListener('click', () => autoGenerateMenu(order.id));
    document.getElementById('btnSaveDraft').addEventListener('click', () => saveOrderMenu(order.id, false));
    document.getElementById('btnConfirmMenu').addEventListener('click', () => saveOrderMenu(order.id, true));

    renderMenuItemsList();

    if (order.menu_status === 'confirmed') {
      loadIngredientBreakdown(order.id);
    }
  }

  function populateAddMenuDishOptions() {
    const cat = document.getElementById('addMenuCategory').value;
    const sel = document.getElementById('addMenuDish');
    const list = dishesByCategory(cat);
    sel.innerHTML = list.map((d) => `<option value="${d.id}">${escapeHtml(d.name)}（$${d.price}）</option>`).join('') || '<option disabled>此分類尚無菜色</option>';
  }

  function addMenuItemFromPicker() {
    const cat = document.getElementById('addMenuCategory').value;
    const dishId = Number(document.getElementById('addMenuDish').value);
    const dish = state.dishes.find((d) => d.id === dishId);
    if (!dish) { toast('請先在菜色資料庫新增此分類的菜色', true); return; }
    const items = state.currentGeneratedMenu;
    const unitPrice = state.currentOrderUnitPrice;
    const cap = maxItemsForPrice(unitPrice);
    if (items.length >= cap) {
      const hint = unitPrice <= PRICE_THRESHOLD
        ? `訂單單價 $${unitPrice}（${PRICE_THRESHOLD} 元以內）最多 ${LOW_TIER_MAX_ITEMS} 樣，若要選更多樣，訂單單價需超過 ${PRICE_THRESHOLD} 元`
        : `最多只能選 ${HIGH_TIER_MAX_ITEMS} 樣菜`;
      toast(hint, true);
      return;
    }
    items.push({ category: cat, dish_id: dish.id, name: dish.name, price: dish.price });
    renderMenuItemsList();
  }

  function renderMenuItemsList() {
    const wrap = document.getElementById('menuItemsList');
    const items = state.currentGeneratedMenu;
    wrap.innerHTML = items.length
      ? items
          .map(
            (it, idx) => `
        <div class="menu-item-row">
          <div class="tag">${it.category}</div>
          <div>${escapeHtml(it.name)}</div>
          <input type="number" min="0" data-price-idx="${idx}" value="${it.price}" />
          <button type="button" class="btn-danger btn-small" data-remove-idx="${idx}">移除</button>
        </div>`
          )
          .join('')
      : '<p class="hint">尚未選擇菜色，可按下方「自動產生建議菜單」或手動新增。</p>';

    wrap.querySelectorAll('[data-price-idx]').forEach((input) =>
      input.addEventListener('input', () => {
        const idx = Number(input.dataset.priceIdx);
        state.currentGeneratedMenu[idx].price = Number(input.value) || 0;
        renderMenuSummary();
      })
    );
    wrap.querySelectorAll('[data-remove-idx]').forEach((btn) =>
      btn.addEventListener('click', () => {
        state.currentGeneratedMenu.splice(Number(btn.dataset.removeIdx), 1);
        renderMenuItemsList();
      })
    );
    renderMenuSummary();
  }

  function renderMenuSummary() {
    const items = state.currentGeneratedMenu;
    const total = items.reduce((s, it) => s + (Number(it.price) || 0), 0);
    const unitPrice = state.currentOrderUnitPrice;
    const cap = maxItemsForPrice(unitPrice);
    const summary = document.getElementById('menuSummary');
    const over = items.length > cap;
    summary.className = 'menu-summary' + (over ? ' over' : '');
    const tierHint = unitPrice > PRICE_THRESHOLD
      ? `（訂單單價 $${unitPrice} 超過${PRICE_THRESHOLD}元，上限${HIGH_TIER_MAX_ITEMS}樣）`
      : `（訂單單價 $${unitPrice}，${PRICE_THRESHOLD}元以內，上限${LOW_TIER_MAX_ITEMS}樣；超過${PRICE_THRESHOLD}元可達${HIGH_TIER_MAX_ITEMS}樣）`;
    summary.textContent = `共 ${items.length} / ${cap} 樣　菜色總價 $${total} ${tierHint}`;
  }

  async function autoGenerateMenu(orderId) {
    try {
      const plan = await api(`/api/orders/${orderId}/generate-menu`, { method: 'POST' });
      state.currentGeneratedMenu = plan.items.map((it) => ({ ...it }));
      renderMenuItemsList();
      const warnBox = document.getElementById('genWarnings');
      warnBox.innerHTML = plan.warnings.length
        ? plan.warnings.map((w) => `<div class="warn-item">⚠️ ${escapeHtml(w)}</div>`).join('')
        : '<div class="ok-item">✅ 已依訂單條件與本月月菜單產生建議菜單，可再手動調整</div>';
    } catch (err) {
      toast(err.message, true);
    }
  }

  async function saveOrderMenu(orderId, confirm) {
    try {
      const items = state.currentGeneratedMenu.map(({ category, dish_id, price }) => ({ category, dish_id, price }));
      const result = await api(`/api/orders/${orderId}/menu`, {
        method: 'PUT',
        body: JSON.stringify({ items, confirm }),
      });
      toast(confirm ? '菜單已確認' : '草稿已儲存');
      renderOrderDetail({ ...result.order, menuItems: result.menuItems });
      loadOrders();
    } catch (err) {
      toast(err.message, true);
    }
  }

  async function loadIngredientBreakdown(orderId) {
    const data = await api(`/api/orders/${orderId}/ingredients`);
    const section = document.getElementById('ingredientSection');
    const perDishRows = data.perDish
      .map(
        (p) => `
      <tr>
        <td>${p.category}</td>
        <td>${escapeHtml(p.dish_name)}</td>
        <td>${escapeHtml(p.ingredients.map((i) => `${i.name} ${i.qtyTotal}${i.unit}`).join('、')) || '－'}</td>
        <td>$${money(p.price)}</td>
      </tr>`
      )
      .join('');
    const aggRows = data.aggregated
      .map((a) => `<tr><td>${escapeHtml(a.name)}</td><td>${a.qtyTotal}</td><td>${a.unit}</td></tr>`)
      .join('');
    section.innerHTML = `
      <div class="section-title">已確認菜單 － 食材需求（依訂購數量 ${data.order.quantity} 份放大，不含調味料）</div>
      <table class="ingredient-table">
        <thead><tr><th>分類</th><th>菜色</th><th>食材明細</th><th>預算價格</th></tr></thead>
        <tbody>${perDishRows}</tbody>
      </table>
      <div class="section-title">採購彙總（同食材合併加總）</div>
      <table class="ingredient-table">
        <thead><tr><th>食材</th><th>採購量</th><th>單位</th></tr></thead>
        <tbody>${aggRows}</tbody>
      </table>
    `;
  }

  // ================= 月菜單管理（每日行事曆） =================

  const SLOT_CATEGORIES = ['主菜', '副菜', '時蔬'];
  const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']; // 依 Date.getDay()（0=週日）索引，供單日標題等查表用
  const WEEKDAY_HEADER_ORDER = [1, 2, 3, 4, 5, 6, 0]; // 月曆表頭欄位順序：週一起始
  let currentMonthCalendar = null; // 快取目前月份的資料，供點開單日 modal 使用

  function slotLabel(it) {
    if (it.slot_category === '主菜') return it.variant === '不豬' ? '主菜(不豬)' : '主菜(一般)';
    return it.slot_category;
  }

  document.getElementById('btnGenerateMonth').addEventListener('click', generateMonth);
  document.getElementById('btnPrintMonth').addEventListener('click', printMonthlyCalendar);

  function printMonthlyCalendar() {
    if (!currentMonthCalendar || currentMonthCalendar.days.length === 0) {
      toast('本月尚未排菜單，請先自動排本月菜單或手動安排後再列印', true);
      return;
    }
    window.print();
  }

  function weekdayLabel(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return WEEKDAY_LABELS[d.getDay()];
  }

  async function loadMonthlyMenu() {
    const month = document.getElementById('monthlyPicker').value;
    const data = await api('/api/monthly-menu?month=' + month);
    currentMonthCalendar = data;
    renderCalendar(data);
  }

  function renderCalendar(data) {
    const container = document.getElementById('monthlyCalendar');
    const printTitle = document.getElementById('printMonthTitle');
    if (printTitle) printTitle.textContent = `日月自助餐 合菜 ${data.month} 月菜單`;
    if (data.days.length === 0) {
      container.innerHTML = '<p class="hint">本月尚未排菜單，請按上方「自動排本月菜單」一次排出全月每一天的菜單，或於下方逐日手動安排。</p>';
      return;
    }

    const [year, monthNum] = data.month.split('-').map(Number);
    const firstWeekdaySun = new Date(year, monthNum - 1, 1).getDay(); // 0=週日
    const firstWeekday = (firstWeekdaySun + 6) % 7; // 轉成週一起始（週一=0...週日=6）
    const totalDays = new Date(year, monthNum, 0).getDate();
    const dayMap = new Map(data.days.map((d) => [d.date, d]));

    const cells = [];
    for (let i = 0; i < firstWeekday; i++) cells.push('<td class="cal-empty"></td>');
    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${data.month}-${String(day).padStart(2, '0')}`;
      const d = dayMap.get(dateStr);
      const items = d ? d.items : [];
      const dishList = items
        .map((it) => `<li><span class="cal-slot">${slotLabel(it)}</span>${escapeHtml(it.name)}</li>`)
        .join('');
      cells.push(`
        <td class="cal-cell" data-date="${dateStr}">
          <div class="cal-date">${dateStr.slice(5)}</div>
          <ul class="cal-dishes">${dishList || '<li class="hint">尚未排菜</li>'}</ul>
        </td>
      `);
    }
    while (cells.length % 7 !== 0) cells.push('<td class="cal-empty"></td>');

    let rowsHtml = '';
    for (let i = 0; i < cells.length; i += 7) {
      rowsHtml += `<tr>${cells.slice(i, i + 7).join('')}</tr>`;
    }

    container.innerHTML = `
      <table class="calendar-table">
        <thead><tr>${WEEKDAY_HEADER_ORDER.map((i) => `<th>星期${WEEKDAY_LABELS[i]}</th>`).join('')}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `;

    container.querySelectorAll('.cal-cell').forEach((cell) => {
      cell.addEventListener('click', () => openDayMenu(cell.dataset.date));
    });
  }

  async function generateMonth() {
    const month = document.getElementById('monthlyPicker').value;
    if (!confirm(`確定要自動排出 ${month} 整個月每一天的菜單嗎？這會覆蓋這個月目前已排的菜單。`)) return;

    const btn = document.getElementById('btnGenerateMonth');
    const progress = document.getElementById('monthGenProgress');
    const fill = document.getElementById('monthGenProgressFill');
    const text = document.getElementById('monthGenProgressText');

    btn.disabled = true;
    progress.classList.remove('hidden');
    fill.style.width = '4%';
    text.textContent = '正在排本月菜單…0%';

    // 排整月菜單需要伺服器逐日運算＋寫入，非瞬間完成；因為是單一請求無法取得真實進度，
    // 這裡先以逐步趨近的方式模擬進度，實際完成時再補到 100%，讓使用者知道系統仍在處理。
    let pct = 4;
    const timer = setInterval(() => {
      pct += (90 - pct) * 0.12;
      fill.style.width = `${pct.toFixed(0)}%`;
      text.textContent = `正在排本月菜單…${pct.toFixed(0)}%`;
    }, 200);

    try {
      const data = await api('/api/monthly-menu/generate', { method: 'POST', body: JSON.stringify({ month }) });
      clearInterval(timer);
      fill.style.width = '100%';
      text.textContent = '完成！';
      currentMonthCalendar = data;
      renderCalendar(data);
      toast('已自動排出本月每一天的菜單');
    } catch (err) {
      clearInterval(timer);
      toast(err.message, true);
    } finally {
      btn.disabled = false;
      setTimeout(() => {
        progress.classList.add('hidden');
        fill.style.width = '0%';
      }, 600);
    }
  }

  function findDay(date) {
    return currentMonthCalendar && currentMonthCalendar.days.find((d) => d.date === date);
  }

  function openDayMenu(date) {
    renderDayMenuModal(date);
    openModal('dayMenuModal');
  }

  function renderDayMenuModal(date) {
    const day = findDay(date) || { date, items: [], warnings: [] };
    document.getElementById('dayMenuModalTitle').textContent = `${date}（星期${weekdayLabel(date)}）菜單`;
    const body = document.getElementById('dayMenuModalBody');
    body.innerHTML = `
      <div id="dayWarnings"></div>
      <div id="daySlots" class="monthly-slots"></div>
    `;

    const warnBox = document.getElementById('dayWarnings');
    warnBox.innerHTML = day.warnings.length
      ? day.warnings.map((w) => `<div class="${w.level === 'error' ? 'err-item' : 'warn-item'}">⚠️ [原則${w.rule}] ${escapeHtml(w.message)}</div>`).join('')
      : '<div class="ok-item">✅ 當天菜單符合原則2~5檢核</div>';

    const slotsContainer = document.getElementById('daySlots');
    slotsContainer.innerHTML = '';
    for (const slot of SLOT_CATEGORIES) {
      const items = day.items.filter((it) => it.slot_category === slot);
      const card = el(`
        <div class="slot-card">
          <h3>${slot}</h3>
          <div class="slot-list"></div>
          <div class="add-slot-row">
            ${slot === '主菜' ? '<select class="variant-select"><option value="一般">一般</option><option value="不豬">不豬</option></select>' : ''}
            <select class="dish-select"></select>
            <button type="button" class="btn-ghost btn-small add-btn">＋ 加入</button>
          </div>
        </div>
      `);
      const list = card.querySelector('.slot-list');
      if (items.length === 0) {
        list.innerHTML = '<p class="hint">尚未設定</p>';
      } else {
        for (const it of items) {
          const row = el(`
            <div class="slot-item">
              <span>${escapeHtml(it.name)}
                ${it.variant && it.variant !== '一般' ? `<span class="tag variant">${it.variant}</span>` : ''}
                <span class="tag">${it.protein_type}／${it.cooking_method}／${it.color_tag}${it.is_spicy ? '／辣' : ''}</span>
              </span>
              <button type="button" class="btn-danger btn-small" data-remove="${it.id}">移除</button>
            </div>
          `);
          row.querySelector('[data-remove]').addEventListener('click', async () => {
            await api('/api/monthly-menu/' + it.id, { method: 'DELETE' });
            await loadMonthlyMenu();
            renderDayMenuModal(date);
          });
          list.appendChild(row);
        }
      }
      const dishSelect = card.querySelector('.dish-select');
      dishSelect.innerHTML = dishesByCategory(slot)
        .map((d) => `<option value="${d.id}">${escapeHtml(d.name)}（${d.protein_type}/${d.cooking_method}/${d.color_tag}${d.is_spicy ? '/辣' : ''}）</option>`)
        .join('') || '<option disabled>菜色資料庫尚無此分類菜色</option>';

      card.querySelector('.add-btn').addEventListener('click', async () => {
        const dishId = Number(dishSelect.value);
        if (!dishId) { toast('請先在菜色資料庫新增此分類的菜色', true); return; }
        const variantSelect = card.querySelector('.variant-select');
        try {
          await api('/api/monthly-menu', {
            method: 'POST',
            body: JSON.stringify({
              date,
              slot_category: slot,
              variant: variantSelect ? variantSelect.value : '一般',
              dish_id: dishId,
              sort_order: items.length + 1,
            }),
          });
          await loadMonthlyMenu();
          renderDayMenuModal(date);
        } catch (err) {
          toast(err.message, true);
        }
      });
      slotsContainer.appendChild(card);
    }
  }

  // ================= 菜色資料庫 =================

  function populateDishFormSelects() {
    document.getElementById('d_category').innerHTML = state.meta.dishCategories.map((c) => `<option value="${c}">${c}</option>`).join('');
    document.getElementById('d_protein_type').innerHTML = state.meta.proteinTypes.map((c) => `<option value="${c}">${c}</option>`).join('');
    document.getElementById('d_cooking_method').innerHTML = state.meta.cookingMethods.map((c) => `<option value="${c}">${c}</option>`).join('');
    document.getElementById('d_color_tag').innerHTML = state.meta.colorTags.map((c) => `<option value="${c}">${c}</option>`).join('');
  }

  function populateDishFilterCategory() {
    const sel = document.getElementById('dishFilterCategory');
    sel.innerHTML = '<option value="">全部分類</option>' + state.meta.dishCategories.map((c) => `<option value="${c}">${c}</option>`).join('');
  }

  async function loadDishes() {
    await refreshDishCache();
    const cat = document.getElementById('dishFilterCategory').value;
    const rows = cat ? state.dishes.filter((d) => d.category === cat) : state.dishes;
    const tbody = document.getElementById('dishTableBody');
    tbody.innerHTML = rows
      .map(
        (d) => `
      <tr>
        <td>${d.category}</td>
        <td>${escapeHtml(d.name)}</td>
        <td>${d.protein_type}</td>
        <td>${d.cooking_method}</td>
        <td>${d.color_tag}</td>
        <td>${d.is_pork ? '是' : ''}</td>
        <td>${d.is_spicy ? '辣' : ''}</td>
        <td>${d.is_soft ? '軟' : ''}</td>
        <td>$${money(d.price)}</td>
        <td>
          <button class="btn-ghost btn-small" data-edit-dish="${d.id}">編輯</button>
          <button class="btn-danger btn-small" data-del-dish="${d.id}">刪除</button>
        </td>
      </tr>`
      )
      .join('') || '<tr><td colspan="10" style="text-align:center;color:var(--muted)">尚無菜色</td></tr>';

    tbody.querySelectorAll('[data-edit-dish]').forEach((b) =>
      b.addEventListener('click', () => openDishForm(Number(b.dataset.editDish)))
    );
    tbody.querySelectorAll('[data-del-dish]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!confirm('確定要刪除此菜色嗎？（月菜單/訂單中的關聯資料也會受影響）')) return;
        await api('/api/dishes/' + b.dataset.delDish, { method: 'DELETE' });
        toast('菜色已刪除');
        loadDishes();
      })
    );
  }

  function addIngredientRow(ing) {
    const wrap = document.getElementById('d_ingredients');
    const row = el(`
      <div class="ingredient-row">
        <input type="text" placeholder="食材名稱" class="ing-name" value="${ing ? escapeHtml(ing.name) : ''}" />
        <input type="number" min="0" placeholder="用量" class="ing-qty" value="${ing ? ing.qty : ''}" />
        <input type="text" placeholder="單位(g/ml/個)" class="ing-unit" value="${ing ? escapeHtml(ing.unit) : ''}" />
        <button type="button" class="btn-danger btn-small">✕</button>
      </div>
    `);
    row.querySelector('button').addEventListener('click', () => row.remove());
    wrap.appendChild(row);
  }

  async function openDishForm(dishId) {
    document.getElementById('dishForm').reset();
    document.getElementById('d_id').value = dishId || '';
    document.getElementById('dishModalTitle').textContent = dishId ? '編輯菜色' : '新增菜色';
    document.getElementById('d_ingredients').innerHTML = '';
    if (dishId) {
      const dish = await api('/api/dishes/' + dishId);
      document.getElementById('d_name').value = dish.name;
      document.getElementById('d_category').value = dish.category;
      document.getElementById('d_protein_type').value = dish.protein_type;
      document.getElementById('d_cooking_method').value = dish.cooking_method;
      document.getElementById('d_color_tag').value = dish.color_tag;
      document.getElementById('d_price').value = dish.price;
      document.getElementById('d_flavor_style').value = dish.flavor_style || '';
      document.getElementById('d_main_ingredient').value = dish.main_ingredient || '';
      document.getElementById('d_is_pork').checked = !!dish.is_pork;
      document.getElementById('d_is_spicy').checked = !!dish.is_spicy;
      document.getElementById('d_is_soft').checked = !!dish.is_soft;
      document.getElementById('d_notes').value = dish.notes || '';
      (dish.ingredients || []).forEach((ing) => addIngredientRow(ing));
    } else {
      addIngredientRow();
    }
    openModal('dishModal');
  }

  async function submitDishForm(e) {
    e.preventDefault();
    const dishId = document.getElementById('d_id').value;
    const ingredients = Array.from(document.querySelectorAll('#d_ingredients .ingredient-row'))
      .map((row) => ({
        name: row.querySelector('.ing-name').value.trim(),
        qty: Number(row.querySelector('.ing-qty').value),
        unit: row.querySelector('.ing-unit').value.trim(),
      }))
      .filter((i) => i.name && i.unit);

    const body = {
      name: document.getElementById('d_name').value,
      category: document.getElementById('d_category').value,
      protein_type: document.getElementById('d_protein_type').value,
      cooking_method: document.getElementById('d_cooking_method').value,
      color_tag: document.getElementById('d_color_tag').value,
      price: Number(document.getElementById('d_price').value) || 0,
      flavor_style: document.getElementById('d_flavor_style').value.trim(),
      main_ingredient: document.getElementById('d_main_ingredient').value.trim(),
      is_pork: document.getElementById('d_is_pork').checked,
      is_spicy: document.getElementById('d_is_spicy').checked,
      is_soft: document.getElementById('d_is_soft').checked,
      notes: document.getElementById('d_notes').value,
      ingredients,
    };

    try {
      if (dishId) {
        await api('/api/dishes/' + dishId, { method: 'PUT', body: JSON.stringify(body) });
        toast('菜色已更新');
      } else {
        await api('/api/dishes', { method: 'POST', body: JSON.stringify(body) });
        toast('菜色已新增');
      }
      closeModal('dishModal');
      await refreshDishCache();
      loadDishes();
      if (document.getElementById('dailySheetDate').value) loadDailySheet();
    } catch (err) {
      toast(err.message, true);
    }
  }

  // ================= 採購清單 =================

  async function renderPurchase() {
    const date = document.getElementById('purchaseDate').value;
    if (!date) return;
    const data = await api('/api/purchase?date=' + date);
    const result = document.getElementById('purchaseResult');
    if (data.orderCount === 0) {
      result.innerHTML = `<p class="hint">${date} 尚無已確認菜單的訂單</p>`;
      return;
    }
    const orderList = data.orders.map((o) => `[${o.type}]${escapeHtml(o.customer_name)}（${o.quantity}份）`).join('、');
    const rows = data.aggregated.map((a) => `<tr><td>${escapeHtml(a.name)}</td><td>${a.qtyTotal}</td><td>${a.unit}</td></tr>`).join('');
    result.innerHTML = `
      <p class="hint">共 ${data.orderCount} 筆已確認訂單：${orderList}</p>
      <table class="ingredient-table">
        <thead><tr><th>食材</th><th>需採購量</th><th>單位</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  // ================= 便當：工廠訂單 =================

  const BENTO_PRICE_TIERS = {
    '便當': [50, 55, 60, 65, 70, 75, 80],
    '合菜': [68, 70, 75, 80],
  };
  const BENTO_ORDER_FORM_FIELDS = [
    'vendor_name', 'order_month', 'meal_period', 'order_type', 'price_tier', 'quantity', 'opt_no_pork', 'opt_soup', 'notes',
  ];

  function populateBentoPriceTierOptions(selected) {
    const type = document.getElementById('bo_order_type').value;
    const sel = document.getElementById('bo_price_tier');
    const tiers = BENTO_PRICE_TIERS[type] || [];
    sel.innerHTML = tiers.map((t) => `<option value="${t}">${t} 元</option>`).join('');
    if (selected != null && tiers.includes(Number(selected))) sel.value = String(selected);
  }

  function bentoOrderRowHtml(o) {
    const statusLabel2 = { pending: '未確認', confirmed: '已確認' }[o.menu_status] || o.menu_status;
    return `
      <tr>
        <td>${o.order_month}</td>
        <td>${o.meal_period}</td>
        <td>${o.price_tier} 元</td>
        <td>${escapeHtml(o.vendor_name)}</td>
        <td>${o.quantity}</td>
        <td>${o.opt_no_pork ? '不豬' : ''}</td>
        <td>${o.opt_soup ? '1湯' : ''}</td>
        <td>${escapeHtml(o.notes || '')}</td>
        <td><span class="status-badge status-${o.menu_status}">${statusLabel2}</span></td>
        <td>
          <button class="btn-ghost btn-small" data-edit="${o.id}">編輯</button>
          ${o.menu_status !== 'confirmed' ? `<button class="btn-primary btn-small" data-confirm="${o.id}">確認</button>` : ''}
          <button class="btn-danger btn-small" data-del="${o.id}">刪除</button>
        </td>
      </tr>
    `;
  }

  function bindBentoOrderRowActions(tbody) {
    tbody.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => openBentoOrderForm(Number(b.dataset.edit)))
    );
    tbody.querySelectorAll('[data-confirm]').forEach((b) =>
      b.addEventListener('click', async () => {
        await api('/api/bento-orders/' + b.dataset.confirm, { method: 'PUT', body: JSON.stringify({ menu_status: 'confirmed' }) });
        toast('訂單已確認');
        loadBentoOrders();
      })
    );
    tbody.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!confirm('確定要刪除此訂單嗎？')) return;
        await api('/api/bento-orders/' + b.dataset.del, { method: 'DELETE' });
        toast('訂單已刪除');
        loadBentoOrders();
      })
    );
  }

  async function loadBentoOrders() {
    const month = document.getElementById('bentoOrderFilterMonth').value;
    const qs = month ? `?month=${month}` : '';
    const orders = await api('/api/bento-orders' + qs);
    const bentoOrders = orders.filter((o) => o.order_type === '便當');
    const comboOrders = orders.filter((o) => o.order_type === '合菜');

    const bentoTbody = document.getElementById('bentoOrderTableBodyBento');
    bentoTbody.innerHTML = bentoOrders.length
      ? bentoOrders.map(bentoOrderRowHtml).join('')
      : '<tr><td colspan="10" style="text-align:center;color:var(--muted)">尚無便當訂單</td></tr>';
    bindBentoOrderRowActions(bentoTbody);

    const comboTbody = document.getElementById('bentoOrderTableBodyCombo');
    comboTbody.innerHTML = comboOrders.length
      ? comboOrders.map(bentoOrderRowHtml).join('')
      : '<tr><td colspan="10" style="text-align:center;color:var(--muted)">尚無合菜訂單</td></tr>';
    bindBentoOrderRowActions(comboTbody);
  }

  async function openBentoOrderForm(orderId) {
    document.getElementById('bentoOrderForm').reset();
    document.getElementById('bo_id').value = orderId || '';
    document.getElementById('bentoOrderModalTitle').textContent = orderId ? '編輯工廠訂單' : '新增工廠訂單';
    if (orderId) {
      const order = await api('/api/bento-orders/' + orderId);
      for (const f of BENTO_ORDER_FORM_FIELDS) {
        const input = document.getElementById('bo_' + f);
        if (!input) continue;
        if (input.type === 'checkbox') input.checked = !!order[f];
        else if (f !== 'price_tier') input.value = order[f] ?? '';
      }
      populateBentoPriceTierOptions(order.price_tier);
    } else {
      document.getElementById('bo_quantity').value = 1;
      // 新訂單直接沿用目前「依月份篩選」選的月份，沒篩選就用當月
      document.getElementById('bo_order_month').value =
        document.getElementById('bentoOrderFilterMonth').value || new Date().toISOString().slice(0, 7);
      populateBentoPriceTierOptions();
    }
    openModal('bentoOrderModal');
  }

  async function submitBentoOrderForm(e) {
    e.preventDefault();
    const orderId = document.getElementById('bo_id').value;
    const body = {};
    for (const f of BENTO_ORDER_FORM_FIELDS) {
      const input = document.getElementById('bo_' + f);
      if (!input) continue;
      body[f] = input.type === 'checkbox' ? input.checked : input.value;
    }
    try {
      if (orderId) {
        await api('/api/bento-orders/' + orderId, { method: 'PUT', body: JSON.stringify(body) });
        toast('訂單已更新');
      } else {
        await api('/api/bento-orders', { method: 'POST', body: JSON.stringify(body) });
        toast('訂單已新增');
      }
      closeModal('bentoOrderModal');
      loadBentoOrders();
    } catch (err) {
      toast(err.message, true);
    }
  }

  // ================= 便當：便當月菜單（每日行事曆） =================

  let currentBentoMonthCalendar = null;
  const BENTO_SLOT_CATEGORIES = ['主菜', '副菜', '時蔬'];
  const BENTO_SLOT_VARIANTS = {
    '主菜': ['一般', '不豬'],
    '副菜': ['基本', '70加', '80加'],
    '時蔬': ['一般'],
  };

  function bentoSlotLabel(it) {
    if (it.slot_category === '主菜') return it.variant === '不豬' ? '主菜(不豬)' : '主菜(一般)';
    if (it.slot_category === '副菜') return `副菜(${it.variant})`;
    return it.slot_category;
  }

  async function loadBentoMonthlyMenu() {
    const month = document.getElementById('bentoMonthlyPicker').value;
    const data = await api('/api/bento-menu?month=' + month);
    currentBentoMonthCalendar = data;
    renderBentoCalendar(data);
  }

  function renderBentoCalendar(data) {
    const container = document.getElementById('bentoMonthlyCalendar');
    if (data.days.length === 0) {
      container.innerHTML = '<p class="hint">本月尚未排便當菜單，請按上方「自動排本月便當菜單」一次排出全月每一天的菜單，或於下方逐日手動安排。</p>';
      return;
    }

    const [year, monthNum] = data.month.split('-').map(Number);
    const firstWeekdaySun = new Date(year, monthNum - 1, 1).getDay();
    const firstWeekday = (firstWeekdaySun + 6) % 7;
    const totalDays = new Date(year, monthNum, 0).getDate();
    const dayMap = new Map(data.days.map((d) => [d.date, d]));

    const cells = [];
    for (let i = 0; i < firstWeekday; i++) cells.push('<td class="cal-empty"></td>');
    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${data.month}-${String(day).padStart(2, '0')}`;
      const d = dayMap.get(dateStr);
      const items = d ? d.items : [];
      const dishList = items
        .map((it) => `<li><span class="cal-slot">${bentoSlotLabel(it)}</span>${escapeHtml(it.name)}</li>`)
        .join('');
      cells.push(`
        <td class="cal-cell" data-date="${dateStr}">
          <div class="cal-date">${dateStr.slice(5)}</div>
          <ul class="cal-dishes">${dishList || '<li class="hint">尚未排菜</li>'}</ul>
        </td>
      `);
    }
    while (cells.length % 7 !== 0) cells.push('<td class="cal-empty"></td>');

    const weekRows = [];
    for (let i = 0; i < cells.length; i += 7) {
      weekRows.push(`<tr>${cells.slice(i, i + 7).join('')}</tr>`);
    }

    // 便當每天的資訊比合菜多（7項/天 vs 6項/天），整月印在一張會太擠，
    // 所以每 2 週（2 個星期列）拆成一個獨立表格區塊，列印時各自分頁。
    const headerHtml = `<tr>${WEEKDAY_HEADER_ORDER.map((i) => `<th>星期${WEEKDAY_LABELS[i]}</th>`).join('')}</tr>`;
    const chunks = [];
    for (let i = 0; i < weekRows.length; i += 2) chunks.push(weekRows.slice(i, i + 2));

    container.innerHTML = chunks
      .map(
        (chunkRows, idx) => `
      <div class="calendar-page${idx < chunks.length - 1 ? ' calendar-page-break' : ''}">
        <div class="calendar-page-label">日月自助餐 便當 ${data.month} 月菜單（第 ${idx * 2 + 1}-${idx * 2 + 2} 週）</div>
        <table class="calendar-table">
          <thead>${headerHtml}</thead>
          <tbody>${chunkRows.join('')}</tbody>
        </table>
      </div>
    `
      )
      .join('');

    container.querySelectorAll('.cal-cell').forEach((cell) => {
      cell.addEventListener('click', () => openBentoDayMenu(cell.dataset.date));
    });
  }

  async function generateBentoMonth() {
    const month = document.getElementById('bentoMonthlyPicker').value;
    if (!confirm(`確定要自動排出 ${month} 整個月每一天的便當菜單嗎？這會覆蓋這個月目前已排的便當菜單。`)) return;

    const btn = document.getElementById('btnGenerateBentoMonth');
    const progress = document.getElementById('bentoMonthGenProgress');
    const fill = document.getElementById('bentoMonthGenProgressFill');
    const text = document.getElementById('bentoMonthGenProgressText');

    btn.disabled = true;
    progress.classList.remove('hidden');
    fill.style.width = '4%';
    text.textContent = '正在排本月便當菜單…0%';

    let pct = 4;
    const timer = setInterval(() => {
      pct += (90 - pct) * 0.12;
      fill.style.width = `${pct.toFixed(0)}%`;
      text.textContent = `正在排本月便當菜單…${pct.toFixed(0)}%`;
    }, 200);

    try {
      const data = await api('/api/bento-menu/generate', { method: 'POST', body: JSON.stringify({ month }) });
      clearInterval(timer);
      fill.style.width = '100%';
      text.textContent = '完成！';
      currentBentoMonthCalendar = data;
      renderBentoCalendar(data);
      toast('已自動排出本月每一天的便當菜單');
    } catch (err) {
      clearInterval(timer);
      toast(err.message, true);
    } finally {
      btn.disabled = false;
      setTimeout(() => {
        progress.classList.add('hidden');
        fill.style.width = '0%';
      }, 600);
    }
  }

  function printBentoMonthlyCalendar() {
    if (!currentBentoMonthCalendar || currentBentoMonthCalendar.days.length === 0) {
      toast('本月尚未排便當菜單，請先自動排本月便當菜單或手動安排後再列印', true);
      return;
    }
    window.print();
  }

  function findBentoDay(date) {
    return currentBentoMonthCalendar && currentBentoMonthCalendar.days.find((d) => d.date === date);
  }

  function openBentoDayMenu(date) {
    renderBentoDayMenuModal(date);
    openModal('dayMenuModal');
  }

  function renderBentoDayMenuModal(date) {
    const day = findBentoDay(date) || { date, items: [], warnings: [] };
    document.getElementById('dayMenuModalTitle').textContent = `${date}（星期${weekdayLabel(date)}）便當菜單`;
    const body = document.getElementById('dayMenuModalBody');
    body.innerHTML = `
      <div id="dayWarnings"></div>
      <div id="daySlots" class="monthly-slots"></div>
    `;

    const warnBox = document.getElementById('dayWarnings');
    warnBox.innerHTML = day.warnings.length
      ? day.warnings.map((w) => `<div class="${w.level === 'error' ? 'err-item' : 'warn-item'}">⚠️ [原則${w.rule}] ${escapeHtml(w.message)}</div>`).join('')
      : '<div class="ok-item">✅ 當天菜單符合原則2~5檢核</div>';

    const slotsContainer = document.getElementById('daySlots');
    slotsContainer.innerHTML = '';
    for (const slot of BENTO_SLOT_CATEGORIES) {
      const variants = BENTO_SLOT_VARIANTS[slot];
      const items = day.items.filter((it) => it.slot_category === slot);
      const card = el(`
        <div class="slot-card">
          <h3>${slot}</h3>
          <div class="slot-list"></div>
          <div class="add-slot-row">
            ${variants.length > 1 ? `<select class="variant-select">${variants.map((v) => `<option value="${v}">${v}</option>`).join('')}</select>` : ''}
            <select class="dish-select"></select>
            <button type="button" class="btn-ghost btn-small add-btn">＋ 加入</button>
          </div>
        </div>
      `);
      const list = card.querySelector('.slot-list');
      if (items.length === 0) {
        list.innerHTML = '<p class="hint">尚未設定</p>';
      } else {
        for (const it of items) {
          const row = el(`
            <div class="slot-item">
              <span>${escapeHtml(it.name)}
                ${it.variant ? `<span class="tag variant">${it.variant}</span>` : ''}
                <span class="tag">${it.protein_type}／${it.cooking_method}／${it.color_tag}${it.is_spicy ? '／辣' : ''}</span>
              </span>
              <button type="button" class="btn-danger btn-small" data-remove="${it.id}">移除</button>
            </div>
          `);
          row.querySelector('[data-remove]').addEventListener('click', async () => {
            await api('/api/bento-menu/' + it.id, { method: 'DELETE' });
            await loadBentoMonthlyMenu();
            renderBentoDayMenuModal(date);
          });
          list.appendChild(row);
        }
      }
      const dishSelect = card.querySelector('.dish-select');
      dishSelect.innerHTML = dishesByCategory(slot)
        .map((d) => `<option value="${d.id}">${escapeHtml(d.name)}（${d.protein_type}/${d.cooking_method}/${d.color_tag}${d.is_spicy ? '/辣' : ''}）</option>`)
        .join('') || '<option disabled>菜色資料庫尚無此分類菜色</option>';

      card.querySelector('.add-btn').addEventListener('click', async () => {
        const dishId = Number(dishSelect.value);
        if (!dishId) { toast('請先在菜色資料庫新增此分類的菜色', true); return; }
        const variantSelect = card.querySelector('.variant-select');
        try {
          await api('/api/bento-menu', {
            method: 'POST',
            body: JSON.stringify({
              date,
              slot_category: slot,
              variant: variantSelect ? variantSelect.value : variants[0],
              dish_id: dishId,
              sort_order: items.length + 1,
            }),
          });
          await loadBentoMonthlyMenu();
          renderBentoDayMenuModal(date);
        } catch (err) {
          toast(err.message, true);
        }
      });
      slotsContainer.appendChild(card);
    }
  }

  // ================= 共用：當天食材表 =================

  function dailySheetRows(items, labelFn) {
    return items
      .map(
        (it) => `
      <tr class="sheet-row-clickable" data-dish-id="${it.dish_id}">
        <td>${escapeHtml(labelFn(it))}</td>
        <td>${escapeHtml(it.name)}</td>
        <td>${escapeHtml(it.ingredientText || '')}</td>
        <td>${it.mealCount}</td>
        <td>${escapeHtml(it.notes || '')}</td>
      </tr>`
      )
      .join('');
  }

  function renderDailySheet(data) {
    const result = document.getElementById('dailySheetResult');
    const bentoRows = dailySheetRows(data.bento.items, bentoSlotLabel);
    const banquetRows = dailySheetRows(data.banquet.items, slotLabel);

    result.innerHTML = `
      <p class="hint no-print">點選任一列可直接編輯該菜色（含食材），儲存後會同步更新菜色資料庫並重新整理這張表。</p>
      <div class="sheet-section-title">便當菜單（含用料）</div>
      <table class="sheet-table">
        <thead><tr><th>分類</th><th>菜單</th><th>食材明細</th><th>用餐數量</th><th>備註</th></tr></thead>
        <tbody>
          ${bentoRows || '<tr><td colspan="5" class="hint">當天尚未排便當菜單</td></tr>'}
          <tr class="sheet-subtotal"><td colspan="3">所有便當</td><td>${data.bento.total}</td><td></td></tr>
        </tbody>
      </table>

      <div class="sheet-section-title">合菜菜單（門市）</div>
      <table class="sheet-table">
        <thead><tr><th>分類</th><th>菜單</th><th>食材明細</th><th>用餐數量</th><th>備註</th></tr></thead>
        <tbody>
          ${banquetRows || '<tr><td colspan="5" class="hint">當天尚未排合菜月菜單</td></tr>'}
          <tr class="sheet-subtotal"><td colspan="3">所有合菜</td><td>${data.banquet.total}</td><td></td></tr>
        </tbody>
      </table>
    `;

    result.querySelectorAll('.sheet-row-clickable').forEach((row) => {
      row.addEventListener('click', () => openDishForm(Number(row.dataset.dishId)));
    });
  }

  async function loadDailySheet() {
    const date = document.getElementById('dailySheetDate').value;
    if (!date) return;
    const printTitle = document.getElementById('printDailySheetTitle');
    if (printTitle) printTitle.textContent = `日月自助餐 當天食材表 ${date}`;
    const data = await api('/api/daily-sheet?date=' + date);
    renderDailySheet(data);
  }

  function printDailySheet() {
    window.print();
  }

  init();
})();
