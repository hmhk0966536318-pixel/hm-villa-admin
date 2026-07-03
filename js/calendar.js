const CALENDAR_API_URL='https://script.google.com/macros/s/AKfycbxnJGz1RIZwYytZjK3fT6LfrD9TBebPufTojHOvFPT6nf1hwgvbvjY8_uR6U67FiTgZ/exec';

let current=new Date();
let controlRows=[];
let roomRows=[];
let orderRows=[];

const ROOM_KEYS=["201","202","203","301","302"];

function pad(n){return String(n).padStart(2,'0')}
function dateKey(y,m,d){return `${y}/${pad(m+1)}/${pad(d)}`}
function normalizeDate(v){
  if(!v)return'';
  const t=String(v).trim().replaceAll('-','/');
  const m=t.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  return m?`${m[1]}/${pad(m[2])}/${pad(m[3])}`:t;
}
function jsonpSheet(sheetName, cbName, done){
  const cb=cbName+'_'+Date.now()+'_'+Math.floor(Math.random()*9999);
  const s=document.createElement('script');
  window[cb]=data=>{
    delete window[cb];
    s.remove();
    done(Array.isArray(data)?data:[]);
  };
  s.onerror=()=>{
    delete window[cb];
    s.remove();
    done([]);
  };
  s.src=`${CALENDAR_API_URL}?sheet=${encodeURIComponent(sheetName)}&callback=${cb}&v=${Date.now()}`;
  document.body.appendChild(s);
}
function loadCalendarData(){
  calendar.innerHTML='<div class="info-card">房況讀取中...</div>';
  jsonpSheet('房況控制','hemeiControlCallback',data=>{
    controlRows=data;
    jsonpSheet('單間空房','hemeiRoomsCallback',rooms=>{
      roomRows=rooms;
      jsonpSheet('訂單表','hemeiOrdersCallback',orders=>{
        orderRows=orders;
        renderCalendar();
      });
    });
  });
}
function getRowByDate(k){return controlRows.find(r=>normalizeDate(r['日期'])===k)||null}
function getRoomRowByDate(k){return roomRows.find(r=>normalizeDate(r['日期'])===k)||null}
function getOrdersByDate(k){
  return orderRows.filter(o=>{
    const status=String(o['狀態']||'');
    if(status.includes('已取消')||status.includes('未付款取消'))return false;
    return normalizeDate(o['入住日期'])===k;
  });
}
function getMode(r){return r?.['模式']||r?.['狀態']||'正常'}
function getType(r){return r?.['類型']||'未設定'}
function getNote(r){return r?.['備註']||'無'}
function roomStatus(k){
  const row=getRoomRowByDate(k);
  const result={};
  ROOM_KEYS.forEach(room=>{
    result[room]=row?(row[room]||'可預訂'):'可預訂';
  });
  return result;
}
function hasAnyRoomBooked(k){
  const rs=roomStatus(k);
  return ROOM_KEYS.some(room=>String(rs[room]||'').includes('已訂'));
}
function allRoomsBooked(k){
  const rs=roomStatus(k);
  return ROOM_KEYS.every(room=>String(rs[room]||'').includes('已訂'));
}
function getModeClass(m,k){
  const t=String(m||'');
  if(t.includes('包棟已訂')||t==='已訂')return'booked';
  if(t.includes('關閉')||t.includes('不可訂'))return'closed';
  if(t.includes('僅接包棟'))return'villa-only';
  if(allRoomsBooked(k))return'booked';
  if(hasAnyRoomBooked(k))return'villa-only';
  return'normal';
}
function getVillaText(m,k){
  const t=String(m||'');
  if(t.includes('包棟已訂')||t==='已訂')return'🔴 已售';
  if(t.includes('關閉')||t.includes('不可訂'))return'⚫ 關閉';
  if(t.includes('僅接包棟'))return'🟡 僅接包棟';
  if(allRoomsBooked(k))return'🔴 單間滿';
  if(hasAnyRoomBooked(k))return'🟡 部分已訂';
  return'🟢 可售';
}
function getVillaDesc(m,k){
  const t=String(m||'');
  if(t.includes('包棟已訂')||t==='已訂')return'此日期包棟已售出，不可再接包棟或單間。';
  if(t.includes('僅接包棟'))return'此日期只接包棟，不開放單間。';
  if(t.includes('關閉')||t.includes('不可訂'))return'此日期目前關閉，不開放預訂。';
  if(allRoomsBooked(k))return'此日期單間已滿，包棟需由小編確認。';
  if(hasAnyRoomBooked(k))return'此日期已有部分單間訂出，請點下方查看剩餘房型。';
  return'目前全部房型可售。';
}
function renderCalendar(){
  const y=current.getFullYear(),m=current.getMonth();
  monthTitle.innerText=`${y}年${m+1}月`;
  calendar.innerHTML='';
  for(let i=0;i<new Date(y,m,1).getDay();i++){
    const e=document.createElement('div');
    e.className='empty';
    calendar.appendChild(e);
  }
  for(let d=1;d<=new Date(y,m+1,0).getDate();d++){
    const k=dateKey(y,m,d);
    const r=getRowByDate(k);
    const mode=getMode(r);
    const cell=document.createElement('button');
    cell.type='button';
    cell.className=`day ${getModeClass(mode,k)}`;
    cell.onclick=()=>openDaySheet(k,r);
    cell.innerHTML=`<div class="num">${d}</div><div class="status">${getVillaText(mode,k)}</div>`;
    calendar.appendChild(cell);
  }
}
function renderRoomStatus(k){
  const rs=roomStatus(k);
  return ROOM_KEYS.map(room=>{
    const s=String(rs[room]||'可預訂');
    const icon=s.includes('已訂')?'🔴':'🟢';
    return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(0,0,0,.06);"><b>${room}</b><span>${icon} ${escapeHtml(s)}</span></div>`;
  }).join('');
}
function renderDayOrders(k){
  const list=getOrdersByDate(k);
  if(!list.length)return'此日目前沒有訂單。';
  return list.map(o=>{
    const room=o['房型']||'未填房型';
    const name=o['姓名']||'未填姓名';
    const phone=o['電話']||'未填電話';
    const status=o['狀態']||'未填狀態';
    const orderId=o['訂單編號']||'';
    return `<div style="padding:10px 0;border-bottom:1px solid rgba(0,0,0,.08);">
      <div><b>${escapeHtml(room)}</b>｜${escapeHtml(status)}</div>
      <div>👤 ${escapeHtml(name)}</div>
      <div>☎️ ${escapeHtml(phone)}</div>
      <div style="font-size:13px;color:#777;">${escapeHtml(orderId)}</div>
    </div>`;
  }).join('');
}
function openDaySheet(k,r){
  const m=getMode(r);
  sheetDate.innerText=k;
  villaStatus.innerText=getVillaText(m,k);
  villaDesc.innerText=getVillaDesc(m,k);
  dateTypeText.innerText=getType(r);
  noteText.innerText=getNote(r);
  roomStatusList.innerHTML=renderRoomStatus(k);
  dayOrderList.innerHTML=renderDayOrders(k);
  sheetOverlay.classList.add('show');
  daySheet.classList.add('show');
}
function closeDaySheet(){sheetOverlay.classList.remove('show');daySheet.classList.remove('show')}
function changeMonth(s){current.setMonth(current.getMonth()+s);renderCalendar()}
function goToday(){current=new Date();renderCalendar()}
function goTomorrow(){const d=new Date();d.setDate(d.getDate()+1);current=d;renderCalendar()}
function goThisSaturday(){const d=new Date(),diff=(6-d.getDay()+7)%7;d.setDate(d.getDate()+diff);current=d;renderCalendar()}
function goNextSaturday(){const d=new Date(),diff=((6-d.getDay()+7)%7)+7;d.setDate(d.getDate()+diff);current=d;renderCalendar()}
function escapeHtml(v){
  return String(v??'')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}
loadCalendarData();
