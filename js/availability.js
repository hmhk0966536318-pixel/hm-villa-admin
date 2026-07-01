// 禾渼智慧管理中心｜房況引擎 V1
// 目的：所有頁面都用同一套規則判斷房況，避免重複賣房。

const HEMEI_ROOMS = ["201", "202", "203", "301", "302"];

const HEMEI_MODES = {
  NORMAL: "正常",
  VILLA_ONLY: "僅接包棟",
  CLOSED: "關閉"
};

const HEMEI_ORDER_STATUS_ACTIVE = [
  "已確認",
  "已收訂",
  "已入住"
];

function isActiveOrder(order) {
  return HEMEI_ORDER_STATUS_ACTIVE.includes(order.status || order["狀態"] || "");
}

function getOrderRoomType(order) {
  return order.roomType || order["房型"] || "";
}

function calculateAvailability({ control = {}, orders = [] }) {
  const mode = control.mode || control["模式"] || HEMEI_MODES.NORMAL;
  const type = control.type || control["類型"] || "";
  const note = control.note || control["備註"] || "";
  const activeOrders = orders.filter(isActiveOrder);

  const hasVillaOrder = activeOrders.some(order => getOrderRoomType(order) === "包棟");
  const bookedRooms = HEMEI_ROOMS.filter(room =>
    activeOrders.some(order => getOrderRoomType(order) === room)
  );
  const hasSingleOrder = bookedRooms.length > 0;

  const rooms = {};
  HEMEI_ROOMS.forEach(room => {
    rooms[room] = {
      room,
      sellable: true,
      status: "可售",
      reason: ""
    };
  });

  let villa = {
    sellable: true,
    status: "可售",
    reason: ""
  };

  if (mode === HEMEI_MODES.CLOSED) {
    villa = { sellable: false, status: "關閉", reason: "此日期已關閉" };
    HEMEI_ROOMS.forEach(room => {
      rooms[room] = { room, sellable: false, status: "關閉", reason: "此日期已關閉" };
    });
  } else if (hasVillaOrder) {
    villa = { sellable: false, status: "包棟已訂", reason: "已有包棟訂單" };
    HEMEI_ROOMS.forEach(room => {
      rooms[room] = { room, sellable: false, status: "鎖定", reason: "包棟已訂，單間不可售" };
    });
  } else if (hasSingleOrder) {
    villa = { sellable: false, status: "不可售", reason: `${bookedRooms.join("、")} 已有單間訂單` };

    HEMEI_ROOMS.forEach(room => {
      const isBooked = bookedRooms.includes(room);
      rooms[room] = {
        room,
        sellable: !isBooked && mode !== HEMEI_MODES.VILLA_ONLY,
        status: isBooked ? "已訂" : (mode === HEMEI_MODES.VILLA_ONLY ? "關閉" : "可售"),
        reason: isBooked ? "已有單間訂單" : (mode === HEMEI_MODES.VILLA_ONLY ? "僅接包棟，單間不開放" : "")
      };
    });
  } else if (mode === HEMEI_MODES.VILLA_ONLY) {
    villa = { sellable: true, status: "僅接包棟", reason: "此日期僅接包棟" };
    HEMEI_ROOMS.forEach(room => {
      rooms[room] = { room, sellable: false, status: "關閉", reason: "僅接包棟，單間不開放" };
    });
  }

  return {
    mode,
    type,
    note,
    villa,
    rooms,
    bookedRooms,
    hasVillaOrder,
    hasSingleOrder
  };
}

// 暫時掛到 window，讓一般 HTML 頁面可以直接使用。
window.HEMEI_ROOMS = HEMEI_ROOMS;
window.calculateAvailability = calculateAvailability;
