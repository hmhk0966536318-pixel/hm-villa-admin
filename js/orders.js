const ORDERS_API_URL = "https://script.google.com/macros/s/AKfycbxnJGz1RIZwYytZjK3fT6LfrD9TBebPufTojHOvFPT6nf1hwgvbvjY8_uR6U67FiTgZ/exec";
let orders = [];
let currentFilter = "全部";
let editingOrderId = "";

function jsonp(url, prefix, onSuccess, onError, timeoutMs = 8000) {
  const cb = prefix + "_" + Date.now();
  const s = document.createElement("script");
  let done = false;

  window[cb] = function (data) {
    done = true;
    onSuccess(data);
    cleanup();
  };

  s.onerror = function () {
    if (done) return;
    done = true;
    if (onError) onError(s.src);
    cleanup();
  };

  function cleanup() {
    delete window[cb];
    s.remove();
  }

  setTimeout(function () {
    if (done) return;
    done = true;
    if (onError) onError(s.src);
    cleanup();
  }, timeoutMs);

  s.src = url + `&callback=${cb}&v=${Date.now()}`;
  document.body.appendChild(s);
}

function loadOrders() {
  jsonp(
    `${ORDERS_API_URL}?sheet=%E8%A8%82%E5%96%AE%E8%A1%A8`,
    "hemeiOrdersCallback",
    function (data) {
      orders = Array.isArray(data) ? data : [];
      renderOrders();
    },
    function (src) {
      orderList.innerHTML = `<div class="info-card error">訂單讀取失敗或逾時<br>${src}</div>`;
    }
  );
}

function filterOrders(status) {
  currentFilter = status;
  document.querySelectorAll(".quick-bar button").forEach(function (btn) {
    btn.classList.remove("active");
    if (btn.innerText === status) btn.classList.add("active");
  });
  renderOrders();
}

function renderOrders() {
  orderList.innerHTML = "";
  let list = orders;

  if (currentFilter !== "全部") {
    list = orders.filter(function (o) {
      return String(o["狀態"] || "").includes(currentFilter);
    });
  }

  if (!list.length) {
    orderList.innerHTML = '<div class="info-card">目前沒有符合的訂單。</div>';
    return;
  }

  list.forEach(function (o) {
    const i = orders.indexOf(o);
    const room = o["房型"] || "未填房型";
    const name = o["姓名"] || "未填姓名";
    const adult = o["大人"] || o["人數"] || "";
    const child = o["小孩"] || "";
    const status = o["狀態"] || "未填";
    const isVilla = String(room).includes("包棟");

    const card = document.createElement("article");
    card.className = "order-card";
    card.innerHTML = `
      <div class="order-top">
        <span class="order-badge ${isVilla ? "villa" : "room"}">
          ${isVilla ? "🏡" : "🛏"} ${escapeHtml(room)}
        </span>
        <span class="status-pill ${getStatusClass(status)}">${escapeHtml(status)}</span>
      </div>
      <h2>${escapeHtml(name)}</h2>
      <p>📅 ${escapeHtml(o["入住日期"] || "未填")} ～ ${escapeHtml(o["退房日期"] || "未填")}</p>
      <p>👨 大人 ${escapeHtml(adult || "0")}／小孩 ${escapeHtml(child || "0")}</p>
      <div class="order-actions-row">
        <button class="primary-btn" onclick="openOrderSheet(${i})">查看</button>
        <button class="secondary-btn" onclick="copyOrder(${i})">📋 複製</button>
      </div>
    `;
    orderList.appendChild(card);
  });
}

function getStatusClass(s) {
  const t = String(s || "");
  if (t.includes("已取消")) return "cancelled";
  if (t.includes("已入住")) return "live";
  if (t.includes("已退房") || t.includes("已收訂") || t.includes("已確認")) return "paid";
  if (t.includes("待") || t.includes("未")) return "pending";
  return "pending";
}

function openOrderSheet(i) {
  const o = orders[i];
  if (!o) return;

  const room = o["房型"] || "未填房型";
  const name = o["姓名"] || "未填姓名";
  const orderId = o["訂單編號"] || "";
  const status = o["狀態"] || "";
  const isVilla = String(room).includes("包棟");

  orderTitle.innerText = `${isVilla ? "🏡" : "🛏"} ${name}`;
  orderSub.innerText = room;

  const cancelButton = status.includes("已取消")
    ? '<button class="secondary-btn full-btn" disabled>此訂單已取消</button>'
    : `<button class="danger-btn full-btn" onclick="cancelOrder('${escapeAttr(orderId)}')">❌ 取消訂單</button>`;

  orderContent.innerHTML = `
    ${infoRow("訂單編號", o["訂單編號"])}
    ${infoRow("建立日期", o["建立日期"])}
    ${infoRow("入住日期", o["入住日期"])}
    ${infoRow("退房日期", o["退房日期"])}
    ${infoRow("姓名", o["姓名"])}
    ${infoRow("電話", o["電話"])}
    ${infoRow("大人", o["大人"] || o["人數"])}
    ${infoRow("小孩", o["小孩"])}
    ${infoRow("房型", o["房型"])}
    ${infoRow("總金額", money(o["總金額"]))}
    ${infoRow("應收訂金", money(o["應收訂金"]))}
    ${infoRow("已收訂金", money(o["已收訂金"]))}
    ${infoRow("後五碼", o["後五碼"])}
    ${infoRow("狀態", o["狀態"])}
    ${infoRow("備註", o["備註"])}
    ${infoRow("來源", o["來源"])}
    <button class="primary-btn full-btn">🏡 辦理入住</button>
    <button class="secondary-btn full-btn" onclick="openEditOrderSheet('${escapeAttr(orderId)}')">✏ 修改訂單</button>
    <button class="secondary-btn full-btn">🧾 發送旅客登記</button>
    ${cancelButton}
  `;
  showOverlayAndSheet("orderSheet");
}

function openEditOrderSheet(orderId) {
  const o = orders.find(function (item) {
    return String(item["訂單編號"] || "") === String(orderId);
  });

  if (!o) {
    showToast("找不到訂單資料");
    return;
  }

  editingOrderId = orderId;

  editOrderForm.name.value = o["姓名"] || "";
  editOrderForm.phone.value = o["電話"] || "";
  editOrderForm.checkIn.value = toDateInput(o["入住日期"]);
  editOrderForm.checkOut.value = toDateInput(o["退房日期"]);
  editOrderForm.roomType.value = o["房型"] || "包棟";
  editOrderForm.adult.value = o["大人"] || o["人數"] || "";
  editOrderForm.child.value = o["小孩"] || "";
  editOrderForm.total.value = cleanNumber(o["總金額"]);
  editOrderForm.depositDue.value = cleanNumber(o["應收訂金"]);
  editOrderForm.depositPaid.value = cleanNumber(o["已收訂金"]);
  editOrderForm.last5.value = o["後五碼"] || "";
  editOrderForm.status.value = o["狀態"] || "待收訂";
  editOrderForm.source.value = o["來源"] || "LINE";
  editOrderForm.note.value = o["備註"] || "";

  closeAllSheets();
  showOverlayAndSheet("editOrderSheet");
}

function submitEditOrder(e) {
  e.preventDefault();

  if (!editingOrderId) {
    showToast("找不到訂單編號");
    return;
  }

  editOrderBtn.disabled = true;
  editOrderBtn.innerText = "儲存中...";

  const fd = new FormData(e.target);
  const params = new URLSearchParams();
  params.set("action", "updateOrder");
  params.set("orderId", editingOrderId);

  for (const pair of fd.entries()) {
    params.set(pair[0], pair[1]);
  }

  jsonp(
    `${ORDERS_API_URL}?${params.toString()}`,
    "hemeiUpdateOrderCallback",
    function (data) {
      editOrderBtn.disabled = false;
      editOrderBtn.innerText = "💾 儲存修改";

      if (!data || data.success !== true) {
        showToast(data && data.message ? data.message : "修改失敗");
        return;
      }

      showToast("✅ 修改成功");
      closeAllSheets();
      loadOrders();
    },
    function () {
      editOrderBtn.disabled = false;
      editOrderBtn.innerText = "💾 儲存修改";
      showToast("修改訂單失敗");
    }
  );
}

function cancelOrder(orderId) {
  if (!orderId) {
    showToast("找不到訂單編號，無法取消");
    return;
  }

  if (!confirm("確定要取消這筆訂單嗎？")) return;

  const params = new URLSearchParams();
  params.set("action", "cancelOrder");
  params.set("orderId", orderId);

  jsonp(
    `${ORDERS_API_URL}?${params.toString()}`,
    "hemeiCancelOrderCallback",
    function (data) {
      if (!data || data.success !== true) {
        showToast(data && data.message ? data.message : "取消失敗");
        return;
      }
      showToast("✅ 已取消訂單");
      closeAllSheets();
      loadOrders();
    },
    function () {
      showToast("取消訂單失敗，請稍後再試");
    }
  );
}

function openAddOrderSheet() {
  addOrderForm.reset();
  updateSmartInfo();
  showOverlayAndSheet("addOrderSheet");
}

function submitAddOrder(e) {
  e.preventDefault();
  saveOrderBtn.disabled = true;
  saveOrderBtn.innerText = "儲存中...";

  const fd = new FormData(e.target);
  const params = new URLSearchParams();
  params.set("action", "addOrder");

  for (const pair of fd.entries()) {
    params.set(pair[0], pair[1]);
  }

  const room = params.get("roomType");
  const checkIn = params.get("checkIn");
  const dup = orders.some(function (o) {
    return !String(o["狀態"] || "").includes("已取消") &&
      normalizeDate(o["入住日期"]) === normalizeDate(checkIn) &&
      (String(o["房型"] || "").includes("包棟") || room === "包棟" || String(o["房型"] || "") === room);
  });

  if (dup && !confirm("⚠️ 此日期可能已有訂單，仍要新增嗎？")) {
    saveOrderBtn.disabled = false;
    saveOrderBtn.innerText = "💾 儲存訂單";
    return;
  }

  jsonp(
    `${ORDERS_API_URL}?${params.toString()}`,
    "hemeiAddOrderCallback",
    function (data) {
      saveOrderBtn.disabled = false;
      saveOrderBtn.innerText = "💾 儲存訂單";

      if (!data || data.success !== true) {
        showToast(data && data.message ? data.message : "新增失敗");
        return;
      }

      showToast("✅ 新增成功：" + data.orderId);
      closeAllSheets();
      loadOrders();
    },
    function () {
      saveOrderBtn.disabled = false;
      saveOrderBtn.innerText = "💾 儲存訂單";
      showToast("新增訂單失敗");
    }
  );
}

function autoDeposit() {
  const total = Number(addOrderForm.total.value || 0);
  if (total && !addOrderForm.depositDue.value) addOrderForm.depositDue.value = Math.round(total * 0.3);
}

function updateSmartInfo() {
  if (!window.addOrderForm) return;

  const room = addOrderForm.roomType.value;
  const adult = Number(addOrderForm.adult.value || 0);
  const child = Number(addOrderForm.child.value || 0);
  const h = {
    "包棟": "🏡 包棟｜適合團體聚會",
    "201": "🛏 201 四人房",
    "202": "🛏 202 二大一小",
    "203": "🛏 203 二大二小",
    "301": "🛏 301 四人房",
    "302": "🛏 302 二大二小"
  };

  roomHint.innerText = h[room] || room;
  peopleHint.innerText = `入住 ${adult + child} 人`;
}

function copyOrder(i) {
  const o = orders[i];
  if (!o) return;

  openAddOrderSheet();
  addOrderForm.name.value = o["姓名"] || "";
  addOrderForm.phone.value = o["電話"] || "";
  addOrderForm.roomType.value = o["房型"] || "包棟";
  addOrderForm.adult.value = o["大人"] || o["人數"] || "";
  addOrderForm.child.value = o["小孩"] || "";
  addOrderForm.total.value = cleanNumber(o["總金額"]);
  addOrderForm.depositDue.value = cleanNumber(o["應收訂金"]);
  addOrderForm.depositPaid.value = cleanNumber(o["已收訂金"]);
  addOrderForm.last5.value = o["後五碼"] || "";
  addOrderForm.source.value = o["來源"] || "LINE";
  addOrderForm.note.value = o["備註"] || "";
  updateSmartInfo();
  showToast("已複製訂單，請改入住日期");
}

function showOverlayAndSheet(id) {
  sheetOverlay.classList.add("show");
  document.getElementById(id).classList.add("show");
}

function closeAllSheets() {
  sheetOverlay.classList.remove("show");
  document.querySelectorAll(".day-sheet").forEach(function (s) {
    s.classList.remove("show");
  });
}

function showToast(m) {
  toast.innerText = m;
  toast.classList.add("show");
  setTimeout(function () {
    toast.classList.remove("show");
  }, 2200);
}

function infoRow(l, v) {
  return `<div class="info-card"><div class="label">${escapeHtml(l)}</div><div>${escapeHtml(v || "未填")}</div></div>`;
}

function money(v) {
  if (!v) return "";
  const n = Number(String(v).replaceAll(",", ""));
  return Number.isNaN(n) ? v : "NT$ " + n.toLocaleString("zh-TW");
}

function cleanNumber(v) {
  return String(v || "").replaceAll(",", "").replace("NT$ ", "").trim();
}

function toDateInput(v) {
  if (!v) return "";
  const text = String(v).replaceAll("/", "-").trim();
  const m = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return "";
  return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
}

function escapeHtml(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(v) {
  return String(v ?? "").replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}

function normalizeDate(v) {
  return v ? String(v).replaceAll("-", "/").trim() : "";
}

loadOrders();
