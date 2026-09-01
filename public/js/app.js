(() => {
  // 客製化菜單樣數上限：總價200元以內最多6樣；超過200元後上限放寬為12樣（可手動新增）
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

  // ---------------- tabs ----------------

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'orders') loadOrders();
      if (btn.dataset.tab === 'monthly') loadMonthlyMenu();
      if (btn.dataset.tab === 'dishes') loadDishes();
      if (btn.dataset.tab === 'purchase') renderPurchase();
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

      <div class="section-title">客製化菜單（主食／主菜／副菜／配菜／湯品／甜點／飲料：總價200元以內最多6樣，超過200元最多可達12樣）</div>
      <div id="genWarnings"></div>
      <div id="menuItemsList"></div>
      <div class="add-slot-row" style="margin:10px 0">
        <select id="addMenuCategory">${MENU_CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join('')}</select>
        <select id="addMenuDish"></select>
        <button type="button" class="btn-ghost btn-small" id="addMenuItemBtn">＋ 加入</button>
      </div>
      <div class="menu-summary" id="menuSummary"></div>
      <div class="modal-actions" style="justify-content:space-between">
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
    const currentTotal = items.reduce((s, it) => s + (Number(it.price) || 0), 0);
    const newTotal = currentTotal + (Number(dish.price) || 0);
    const cap = maxItemsForPrice(newTotal);
    if (items.length >= cap) {
      const hint = newTotal <= PRICE_THRESHOLD
        ? `總價 ${PRICE_THRESHOLD} 元以內最多 ${LOW_TIER_MAX_ITEMS} 樣，若要選更多樣，總價需超過 ${PRICE_THRESHOLD} 元`
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
    const cap = maxItemsForPrice(total);
    const summary = document.getElementById('menuSummary');
    const over = items.length > cap;
    summary.className = 'menu-summary' + (over ? ' over' : '');
    const tierHint = total > PRICE_THRESHOLD
      ? `（總價超過${PRICE_THRESHOLD}元，上限${HIGH_TIER_MAX_ITEMS}樣）`
      : `（總價${PRICE_THRESHOLD}元以內，上限${LOW_TIER_MAX_ITEMS}樣；超過${PRICE_THRESHOLD}元可達${HIGH_TIER_MAX_ITEMS}樣）`;
    summary.textContent = `共 ${items.length} / ${cap} 樣　總價 $${total} ${tierHint}`;
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
  const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];
  let currentMonthCalendar = null; // 快取目前月份的資料，供點開單日 modal 使用

  document.getElementById('btnGenerateMonth').addEventListener('click', generateMonth);

  function weekdayLabel(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return WEEKDAY_LABELS[d.getDay()];
  }

  async function loadMonthlyMenu() {
    const month = document.getElementById('monthlyPicker').value;
    const data = await api('/api/monthly-menu?month=' + month);
    currentMonthCalendar = data;
    renderMonthRepeatSummary(data.monthSummary);
    renderCalendar(data);
  }

  function renderMonthRepeatSummary(summary) {
    const box = document.getElementById('monthRepeatSummary');
    if (!summary || summary.repeats.length === 0) {
      box.innerHTML = '<div class="ok-item">✅ 本月尚無重複的菜色（同食材+同烹調方式）</div>';
      return;
    }
    box.innerHTML = `
      <div class="month-repeat-summary">
        ⚠️ [原則1] 本月共 ${summary.repeats.length} 種菜色重複出現：
        <ul>
          ${summary.repeats
            .map((r) => `<li>${escapeHtml(r.name)}（${escapeHtml(r.cooking_method)}）× ${r.dates.length}：${r.dates.join('、')}</li>`)
            .join('')}
        </ul>
      </div>
    `;
  }

  function renderCalendar(data) {
    const container = document.getElementById('monthlyCalendar');
    if (data.days.length === 0) {
      container.innerHTML = '<p class="hint">本月尚未排菜單，請按上方「自動排本月菜單」一次排出全月每一天的菜單，或於下方逐日手動安排。</p>';
      return;
    }

    const [year, monthNum] = data.month.split('-').map(Number);
    const firstWeekday = new Date(year, monthNum - 1, 1).getDay(); // 0=週日
    const totalDays = new Date(year, monthNum, 0).getDate();
    const dayMap = new Map(data.days.map((d) => [d.date, d]));

    const cells = [];
    for (let i = 0; i < firstWeekday; i++) cells.push('<td class="cal-empty"></td>');
    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${data.month}-${String(day).padStart(2, '0')}`;
      const d = dayMap.get(dateStr);
      const items = d ? d.items : [];
      const warnings = d ? d.warnings : [];
      const badge =
        items.length === 0
          ? '<span class="day-badge empty">未排菜</span>'
          : warnings.length > 0
          ? `<span class="day-badge warn">${warnings.length}項提醒</span>`
          : '<span class="day-badge ok">符合原則</span>';
      const dishList = items.map((it) => `<li>${escapeHtml(it.name)}</li>`).join('');
      cells.push(`
        <td class="cal-cell" data-date="${dateStr}">
          <div class="cal-date">${day}</div>
          ${badge}
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
        <thead><tr>${WEEKDAY_LABELS.map((w) => `<th>星期${w}</th>`).join('')}</tr></thead>
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
    try {
      const data = await api('/api/monthly-menu/generate', { method: 'POST', body: JSON.stringify({ month }) });
      currentMonthCalendar = data;
      renderMonthRepeatSummary(data.monthSummary);
      renderCalendar(data);
      toast('已自動排出本月每一天的菜單');
    } catch (err) {
      toast(err.message, true);
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
    const orderList = data.orders.map((o) => `${escapeHtml(o.customer_name)}（${o.quantity}份）`).join('、');
    const rows = data.aggregated.map((a) => `<tr><td>${escapeHtml(a.name)}</td><td>${a.qtyTotal}</td><td>${a.unit}</td></tr>`).join('');
    result.innerHTML = `
      <p class="hint">共 ${data.orderCount} 筆已確認訂單：${orderList}</p>
      <table class="ingredient-table">
        <thead><tr><th>食材</th><th>需採購量</th><th>單位</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  init();
})();
