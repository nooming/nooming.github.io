const routeGrid=document.getElementById('routeGrid');
const spotList=document.getElementById('spotList');
const spotPath=document.getElementById('spotPath');
const feedGrid=document.getElementById('feedGrid');
const feedEmpty=document.getElementById('feedEmpty');
const buddyGrid=document.getElementById('buddyGrid');

function showDemoUnavailable(feature){
  showToast(feature ? `${feature} · 演示版尚未开放` : '演示版尚未开放');
}

function dismissImportGuide(){
  const el=document.getElementById('importGuideBanner');
  if(el) el.hidden=true;
}

function showImportGuideBanner(){
  const el=document.getElementById('importGuideBanner');
  if(el) el.hidden=false;
}

function renderHeroBuddyPreview(){
  const list=document.getElementById('heroBuddyList');
  if(!list || !Array.isArray(buddies) || !buddies.length) return;
  list.innerHTML=buddies.slice(0,2).map(b=>{
    const initial=String(b.user||'?').slice(0,1);
    return `<div class="hero-buddy-item"><span class="hero-buddy-avatar hero-buddy-avatar--demo" data-demo="${safeText(initial)}"></span><div><strong>${safeText(b.city)} · ${safeText(b.title)}</strong><span>${safeText(b.date)} · ${safeText((b.tags||[])[0]||'Walk')} · ${safeText(b.people)}</span></div></div>`;
  }).join('');
}

function renderRoutes(city='全部'){
  const data=city==='全部'?routes:routes.filter(r=>r.city===city);
  routeGrid.innerHTML=data.map((r,i)=>`\
    <article class="route-card" onclick="openRoute(${routes.indexOf(r)})">\
      <div class="route-media">\
        <img src="${r.image}" alt="${r.title}">\
        <span class="route-demo-ribbon">示例</span>\
        <span class="route-badge">${r.city} · ${r.type}</span>\
        <button class="route-save ${isRouteFavorite(r.id)?'liked':''}" aria-label="收藏路线" onclick="event.stopPropagation();toggleRouteFavorite('${r.id}',this)">${isRouteFavorite(r.id)?'♥':'♡'}</button>\
      </div>\
      <div class="route-body">\
        <div class="route-title">${r.title}</div>\
        <div class="route-sub">${r.desc}</div>\
        <div class="route-stats"><span>📏 ${r.distance}</span><span>🕐 ${r.time}</span><span>◌ ${r.level}</span></div>\
        <div class="node-row">${r.stops.slice(0,4).map((s,j)=>`<span class="node">${s}</span>${j<3?'<span class="arrow">→</span>':''}`).join('')}</div>\
        <div class="route-footer">\
          <div class="author"><span class="avatar-initial" aria-hidden="true">${safeText((r.author||'?').slice(0,1))}</span><span>${r.author}</span></div>\
          <div class="rating">♥ 示例</div>\
        </div>\
      </div>\
    </article>`).join('');
}

let currentSpotRouteId = 'taipei-zhongshan-dadaocheng';
let currentSpotItems = routeSpots[currentSpotRouteId].spots;
let footprintView = 'walks';
let expandedWalkId = 'taipei-zhongshan-dadaocheng';
let spotMode = 'archive';
let currentSpotIndex = null;

const FOOTPRINT_STORAGE = {
  walked: 'citywalk_walked_routes_v1',
  favoriteRoutes: 'citywalk_favorite_routes_v1',
  favoriteSpots: 'citywalk_favorite_spots_v1'
};
const FOOTPRINT_STORAGE_LEGACY = {
  walked: 'wanderwalk_walked_routes_v1',
  favoriteRoutes: 'wanderwalk_favorite_routes_v1',
  favoriteSpots: 'wanderwalk_favorite_spots_v1'
};

const POINTS_STORAGE = {
  total: 'citywalk_points_total_v1',
  events: 'citywalk_completion_events_v1'
};
const POINTS_STORAGE_LEGACY = {
  total: 'wanderwalk_points_total_v1',
  events: 'wanderwalk_completion_events_v1'
};
const PLANNED_ROUTES_KEY = 'citywalk_planned_routes_v1';
const SPOT_PLACEHOLDER = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="100"><rect fill="#f4edf6" width="100%" height="100%"/><text x="50%" y="52%" text-anchor="middle" fill="#b08aa8" font-size="14" font-family="sans-serif">打卡</text></svg>');
let plannerLinkedRouteId = null;

function migrateStorageOnce(newKey, legacyKey, fallback) {
  try {
    if (localStorage.getItem(newKey) !== null) return;
    const legacy = localStorage.getItem(legacyKey);
    if (legacy !== null) localStorage.setItem(newKey, legacy);
    else localStorage.setItem(newKey, JSON.stringify(fallback));
  } catch (e) { /* ignore */ }
}
function loadPlannedCatalog() {
  try {
    const raw = localStorage.getItem(PLANNED_ROUTES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) { return {}; }
}
function savePlannedCatalog() {
  try { localStorage.setItem(PLANNED_ROUTES_KEY, JSON.stringify(plannedRouteCatalog)); } catch (e) { /* ignore */ }
}
let plannedRouteCatalog = loadPlannedCatalog();
Object.keys(plannedRouteCatalog).forEach(function (id) {
  const entry = plannedRouteCatalog[id];
  if (entry && entry.routeSpot && !routeSpots[id]) routeSpots[id] = entry.routeSpot;
});
const POINTS_PER_WALK = 50;
const POINT_LEVELS = [
  {min:0,max:99,icon:'🌱',title:'街巷新芽',desc:'刚刚开始探索城市，把每次出发变成新的发现。'},
  {min:100,max:299,icon:'🚶',title:'巷弄漫游者',desc:'你已经养成出门走走的习惯，城市街角开始熟悉起来。'},
  {min:300,max:699,icon:'🧭',title:'城市寻宝家',desc:'越来越会发现隐藏的小店、街巷和不在攻略里的惊喜。'},
  {min:700,max:1499,icon:'📍',title:'路线收藏家',desc:'你走过的路线正慢慢组成一张属于自己的城市地图。'},
  {min:1500,max:Infinity,icon:'✨',title:'城市漫游家',desc:'资深城市漫游者，总能在熟悉的街区发现新的故事。'}
];

const sampleWalkedRoutes = [
  {routeId:'taipei-zhongshan-dadaocheng',date:'2026-09-28',note:'和朋友一起走，最喜欢赤峰街的小店。'},
  {routeId:'shanghai-wukang-anfu',date:'2026-09-12',note:'梧桐树下很适合慢慢拍照。'},
  {routeId:'tokyo-shibuya-nakameguro',date:'2026-08-20',note:'傍晚出发，最后用拉面收尾。'}
];

function loadArray(key, fallback=[]){
  try{
    const raw=localStorage.getItem(key);
    if(raw===null){
      localStorage.setItem(key,JSON.stringify(fallback));
      return fallback.slice();
    }
    const parsed=JSON.parse(raw);
    return Array.isArray(parsed)?parsed: fallback.slice();
  }catch(e){ return fallback.slice(); }
}
function saveArray(key, value){
  try{ localStorage.setItem(key,JSON.stringify(value)); }catch(e){}
}
function loadNumber(key, fallback=0){
  try{
    const value=Number(localStorage.getItem(key));
    return Number.isFinite(value)&&value>=0?Math.floor(value):fallback;
  }catch(e){return fallback;}
}
function saveNumber(key,value){
  try{localStorage.setItem(key,String(Math.max(0,Math.floor(Number(value)||0))));}catch(e){}
}
migrateStorageOnce(FOOTPRINT_STORAGE.walked, FOOTPRINT_STORAGE_LEGACY.walked, sampleWalkedRoutes);
migrateStorageOnce(FOOTPRINT_STORAGE.favoriteRoutes, FOOTPRINT_STORAGE_LEGACY.favoriteRoutes, []);
migrateStorageOnce(FOOTPRINT_STORAGE.favoriteSpots, FOOTPRINT_STORAGE_LEGACY.favoriteSpots, []);
(function migratePointsStorage(){
  try{
    if(localStorage.getItem(POINTS_STORAGE.total)===null){
      const legacy=localStorage.getItem(POINTS_STORAGE_LEGACY.total);
      localStorage.setItem(POINTS_STORAGE.total, legacy!==null?legacy:'0');
    }
    if(localStorage.getItem(POINTS_STORAGE.events)===null){
      const legacy=localStorage.getItem(POINTS_STORAGE_LEGACY.events);
      localStorage.setItem(POINTS_STORAGE.events, legacy!==null?legacy:'[]');
    }
  }catch(e){}
})();

let totalWalkPoints=loadNumber(POINTS_STORAGE.total,0);
let completionEvents=loadArray(POINTS_STORAGE.events,[]);
let walkedRoutes = loadArray(FOOTPRINT_STORAGE.walked,sampleWalkedRoutes);
let favoriteRouteIds = loadArray(FOOTPRINT_STORAGE.favoriteRoutes,[]);
let favoriteSpotKeys = loadArray(FOOTPRINT_STORAGE.favoriteSpots,[]);

function registerPlannedRoute(payload) {
  if (!payload || !Array.isArray(payload.stops) || !payload.stops.length) return null;
  const id = String(payload.id || ('cw-import-' + Date.now().toString(36)));
  const activityMin = Number(payload.durationActivityMin) || 0;
  const distKm = payload.distanceM ? (Number(payload.distanceM) / 1000).toFixed(2) + ' km' : '';
  const timeLabel = activityMin >= 60
    ? (Math.round(activityMin / 6) / 10) + 'h'
    : (activityMin ? activityMin + ' 分钟' : '—');
  const spots = payload.stops.map(function (s, i) {
    return {
      name: String(s.name || ('站点 ' + (i + 1))),
      type: String(s.type || '打卡'),
      meta: String(s.meta || ''),
      image: s.image || SPOT_PLACEHOLDER,
      desc: String(s.desc || s.meta || '来自 Citywalk 规划')
    };
  });
  const routeSpot = {
    title: String(payload.title || payload.city || '我的路线'),
    meta: String(payload.meta || (payload.city + ' · 规划路线')),
    spots: spots
  };
  routeSpots[id] = routeSpot;
  plannedRouteCatalog[id] = {
    id: id,
    eventId: String(payload.eventId || payload.id || id),
    city: String(payload.city || ''),
    title: routeSpot.title,
    desc: '来自 Citywalk 路线规划',
    distance: distKm,
    time: timeLabel,
    level: '规划',
    image: SPOT_PLACEHOLDER,
    routeSpot: routeSpot
  };
  savePlannedCatalog();
  if (!routes.some(function (r) { return r.id === id; })) {
    routes.unshift({
      id: id,
      city: payload.city || '我的城市',
      type: '规划导入',
      title: routeSpot.title,
      desc: '刚刚从 Citywalk 规划页记录到社区。',
      image: SPOT_PLACEHOLDER,
      distance: distKm || '—',
      time: timeLabel,
      level: '规划',
      likes: '—',
      author: '我',
      avatar: '',
      stops: spots.map(function (s) { return s.name; }),
      tips: ['这条路线来自规划页，可在足迹中补充感想。']
    });
  }
  return id;
}

function routeById(routeId) {
  const found = routes.find(function (r) { return r.id === routeId; });
  if (found) return found;
  const planned = plannedRouteCatalog[routeId];
  if (!planned) return null;
  return {
    id: planned.id,
    city: planned.city,
    title: planned.title,
    desc: planned.desc,
    image: planned.image || SPOT_PLACEHOLDER,
    distance: planned.distance || '—',
    time: planned.time || '—',
    level: planned.level || '规划',
    likes: '—',
    author: '我',
    avatar: '',
    stops: (routeSpots[routeId]?.spots || []).map(function (s) { return s.name; }),
    tips: []
  };
}
function spotKey(routeId,index){ return `${routeId}::${index}`; }
function isRouteFavorite(routeId){ return favoriteRouteIds.includes(routeId); }
function isSpotFavorite(routeId,index){ return favoriteSpotKeys.includes(spotKey(routeId,index)); }
function fmtDate(date){
  if(!date) return '日期未记录';
  const parts=String(date).split('-');
  return parts.length===3?`${parts[0]}.${parts[1]}.${parts[2]}`:date;
}
function todayISO(){
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function safeText(value){
  return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function routeForSpotKey(key){
  const parts=String(key).split('::');
  const routeId=parts[0], index=Number(parts[1]);
  const data=routeSpots[routeId];
  if(!data || !data.spots[index]) return null;
  return {routeId,index,route:routeById(routeId),spot:data.spots[index],data};
}

function setFootprintView(view){
  footprintView=view;
  document.querySelectorAll('.footprint-tab').forEach(btn=>btn.classList.toggle('active',btn.dataset.view===view));
  renderFootprints();
}

function renderFootprints(){
  spotMode='archive';
  document.getElementById('footprintArchivePanel').style.display='block';
  document.getElementById('routeSpotPanel').style.display='none';
  document.getElementById('footprintHeading').textContent='我的 Walk 足迹';
  document.getElementById('footprintSubtitle').textContent='记录走过的路线，收藏沿途想再去的点位。所有记录保存在当前浏览器。';
  document.getElementById('footprintTabs').style.display='flex';
  document.getElementById('footprintSummary').style.display='grid';
  document.getElementById('footprintHeadActions').style.display='flex';

  const validWalked=walkedRoutes.filter(item=>routeById(item.routeId));
  const validFavRoutes=favoriteRouteIds.filter(id=>routeById(id));
  const cityCount=new Set(validWalked.map(item=>routeById(item.routeId)?.city).filter(Boolean)).size;
  document.getElementById('footprintSummary').innerHTML=`
    <div class="footprint-stat"><strong>${validWalked.length}</strong><span>条已走过路线</span></div>
    <div class="footprint-stat"><strong>${validFavRoutes.length}</strong><span>条收藏路线</span></div>
    <div class="footprint-stat"><strong>${favoriteSpotKeys.filter(k=>routeForSpotKey(k)).length}</strong><span>个收藏打卡点 · ${cityCount} 座城市已留下足迹</span></div>`;

  const grid=document.getElementById('footprintGrid');
  const empty=document.getElementById('footprintEmpty');
  grid.classList.toggle('walk-records-mode',footprintView==='walks');
  let items=[];
  let html='';

  if(footprintView==='walks'){
    items=validWalked.slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
    if(expandedWalkId && !items.some(item=>item.routeId===expandedWalkId)) expandedWalkId=items[0]?.routeId||null;
    html=items.map(item=>{
      const r=routeById(item.routeId);
      const routeData=routeSpots[item.routeId] || {title:r.title,meta:`${r.city} · ${r.distance} · 约 ${r.time} · ${r.level}`,spots:[]};
      const routeStops=routeData.spots||[];
      const expanded=expandedWalkId===r.id;
      const shortNote=(item.shortNote||item.note||'还没写下这次 Walk 的小感想。').trim();
      const shortNoteEmpty=!(item.shortNote||item.note||'').trim();
      if(!expanded){
        return `<article class="walk-record-card collapsed">
          <div class="walk-record-compact">
            <img class="walk-record-compact-cover" src="${r.image}" alt="${safeText(r.title)}">
            <div class="walk-record-compact-main">
              <div class="walk-record-compact-kicker">✓ 已走过 · ${safeText(r.city)} · ${fmtDate(item.date)}</div>
              <h3>${safeText(routeData.title||r.title)}</h3>
              <div class="walk-record-compact-meta"><span>📏 ${safeText(r.distance)}</span><span>🕐 ${safeText(r.time)}</span><span>📍 ${routeStops.length} 个点位</span></div>
            </div>
            <button class="walk-record-toggle" onclick="toggleWalkRecord('${r.id}')">展开记录 ↓</button>
          </div>
        </article>`;
      }
      return `<article class="walk-record-card expanded">
        <div class="walk-record-compact">
          <img class="walk-record-compact-cover" src="${r.image}" alt="${safeText(r.title)}">
          <div class="walk-record-compact-main">
            <div class="walk-record-compact-kicker">✓ 已走过 · ${safeText(r.city)} · ${fmtDate(item.date)}</div>
            <h3>${safeText(routeData.title||r.title)}</h3>
            <div class="walk-record-compact-meta"><span>📏 ${safeText(r.distance)}</span><span>🕐 ${safeText(r.time)}</span><span>📍 ${routeStops.length} 个点位</span></div>
          </div>
          <div class="walk-short-note ${shortNoteEmpty?'empty':''}"><span class="walk-short-note-label">✎ WALK 便签</span><p>${safeText(shortNote)}</p></div>
          <button class="walk-record-toggle" onclick="toggleWalkRecord('${r.id}')">收起记录 ↑</button>
        </div>
        <div class="walk-record-expanded-content">
          <div class="walk-record-layout">
            <div class="walk-record-board">
              <div class="walk-record-kicker">路线回顾 · ${safeText(r.city)} · ${fmtDate(item.date)}</div>
              <h3>${safeText(routeData.title||r.title)}</h3>
              <p class="walk-record-board-meta">${safeText(routeData.meta||`${r.city} · ${r.distance} · 约 ${r.time} · ${r.level}`)}</p>
              <div class="walk-record-timeline">
                ${routeStops.map((sp,i)=>`<div class="walk-record-step"><i class="walk-record-step-dot"></i><strong>${String(i+1).padStart(2,'0')} · ${safeText(sp.name)}</strong><span>${safeText(sp.type)} · ${safeText(sp.meta)}</span></div>`).join('')}
              </div>
              <div class="walk-record-actions"><button class="walk-record-open" onclick="renderSpots('${r.id}',true)">打开完整点位页 →</button><button class="walk-record-remove" onclick="removeFootprint('${r.id}')">移除足迹</button></div>
            </div>
            <div class="walk-record-spots-panel">
              <div class="walk-record-spots-head"><strong>沿途打卡点</strong><span>${routeStops.length} 个停留点</span></div>
              <div class="walk-record-spots-list">
                ${routeStops.map((sp,i)=>`<div class="walk-record-spot" onclick="openRecordedSpot('${r.id}',${i})">
                  <img src="${sp.image}" alt="${safeText(sp.name)}">
                  <div class="walk-record-spot-copy"><h4>${safeText(sp.name)}</h4><p>${safeText(sp.desc)}</p><small>${safeText(sp.type)} · ${safeText(sp.meta)}</small></div>
                  <button class="spot-save-button ${isSpotFavorite(r.id,i)?'saved':''}" onclick="event.stopPropagation();toggleSpotFavorite('${r.id}',${i})">${isSpotFavorite(r.id,i)?'♥ 已收藏':'♡ 收藏'}</button>
                </div>`).join('')}
              </div>
            </div>
          </div>
          <div class="walk-memory">
            <div class="walk-memory-head"><div><strong>✎ 把这次 Walk 记下来</strong><span>卡片上的便签是短评，这里可以慢慢写完整的回忆。</span></div><div class="walk-memory-private">仅自己可见 · 本地保存</div></div>
            <div class="walk-memory-fields">
              <div class="walk-memory-field short"><label for="walk-short-${r.id}">一句话短评 · 显示在卡片上</label><textarea id="walk-short-${r.id}" maxlength="72" rows="2" placeholder="例如：最喜欢赤峰街转角的那家小店。">${safeText(item.shortNote||shortenNote(item.note||'',72))}</textarea></div>
              <div class="walk-memory-field"><label for="walk-note-${r.id}">长评 / 旅途记录</label><textarea id="walk-note-${r.id}" maxlength="1500" rows="3" placeholder="这次 Walk 最让我记得的是……写下路线之外的故事。">${safeText(item.note||'')}</textarea></div>
            </div>
            <div class="walk-memory-footer"><span class="walk-memory-hint">短评会作为便签显示在收起后的足迹卡片上。</span><button class="walk-memory-save" onclick="saveWalkNote('${r.id}')">保存感想</button></div>
          </div>
        </div>
      </article>`;
    }).join('');
    empty.textContent='还没有记录过的路线。走完一条 CityWalk 后，点「记录一次 Walk」把路线和沿途点位留在这里。';
  }else if(footprintView==='routes'){
    items=validFavRoutes.map(id=>routeById(id)).filter(Boolean);
    html=items.map(r=>`<article class="footprint-card">
      <div class="footprint-cover"><img src="${r.image}" alt="${safeText(r.title)}"><span class="footprint-cover-badge">♡ 已收藏 · ${safeText(r.city)}</span></div>
      <div class="footprint-card-body"><div class="footprint-card-title">${safeText(r.title)}</div><div class="footprint-card-desc">${safeText(r.desc)}</div><div class="footprint-meta"><span>📏 ${r.distance}</span><span>🕐 ${r.time}</span><span>📍 ${routeSpots[r.id]?.spots.length||0} 个点位</span></div><div class="footprint-stops-preview">${(routeSpots[r.id]?.spots||[]).slice(0,3).map(sp=>`<span>${safeText(sp.name)}</span>`).join('')}</div></div>
      <div class="footprint-card-actions"><button class="primary" onclick="renderSpots('${r.id}',true)">查看路线点位 →</button><button class="remove" onclick="toggleRouteFavorite('${r.id}')">取消收藏</button></div>
    </article>`).join('');
    empty.textContent='这里还没有收藏的路线。可以在 CityWalk 路线卡片或路线详情中点击 ♡ 收藏。';
  }else{
    items=favoriteSpotKeys.map(routeForSpotKey).filter(Boolean);
    html=items.map(item=>`<article class="footprint-card">
      <div class="footprint-cover"><img src="${item.spot.image}" alt="${safeText(item.spot.name)}"><span class="footprint-cover-badge">♡ 已收藏 · ${safeText(item.route?.city||'CityWalk')}</span></div>
      <div class="footprint-card-body"><div class="footprint-card-title">${safeText(item.spot.name)}</div><div class="footprint-card-desc">${safeText(item.spot.desc)}</div><div class="footprint-meta"><span>📍 ${safeText(item.spot.type)}</span><span>${safeText(item.route?.city||'CityWalk')}</span></div><div class="footprint-card-note">来自路线：${safeText(item.data.title)}</div></div>
      <div class="footprint-card-actions"><button class="primary" onclick="renderSpots('${item.routeId}',true);setTimeout(()=>showSpot(${item.index}),350)">查看点位详情 →</button><button class="remove" onclick="toggleSpotFavorite('${item.routeId}',${item.index})">取消收藏</button></div>
    </article>`).join('');
    empty.textContent='还没有收藏的打卡点。打开任意路线，点击点位旁的 ♡，喜欢的咖啡店、街角和拍照机位就会保存在这里。';
  }

  grid.innerHTML=html;
  grid.style.display=items.length?'grid':'none';
  empty.style.display=items.length?'none':'block';
}

function renderSpots(routeId=currentSpotRouteId, scroll=false){
  const routeSpotData=routeSpots[routeId];
  if(!routeSpotData){ showFootprintArchive(); return; }
  currentSpotRouteId=routeId;
  currentSpotItems=routeSpotData.spots;
  spotMode='route';
  document.getElementById('footprintArchivePanel').style.display='none';
  document.getElementById('routeSpotPanel').style.display='block';
  document.getElementById('footprintHeading').textContent='路线打卡点';
  document.getElementById('footprintSubtitle').textContent='沿着路线逐站探索，也可以把喜欢的点位收藏进自己的足迹。';
  document.getElementById('footprintTabs').style.display='none';
  document.getElementById('footprintSummary').style.display='none';
  document.getElementById('footprintHeadActions').style.display='none';
  const fromPlanner = plannerLinkedRouteId === routeId;
  document.getElementById('routeLinkBadge').textContent=fromPlanner?'来自 Citywalk 路线规划':'路线点位详情';
  document.getElementById('spotBoardKicker').textContent=`${routeSpotData.meta.split(' · ')[0]} · ${fromPlanner?'规划导入':'路线打卡点'}`;
  document.getElementById('spotRouteTitle').textContent=routeSpotData.title;
  document.getElementById('spotRouteMeta').textContent=routeSpotData.meta;
  spotPath.innerHTML=routeSpotData.spots.map((sp,i)=>`<div class="path-item ${i===0?'current':''}" onclick="showSpot(${i})"><i class="path-dot"></i><strong>${String(i+1).padStart(2,'0')} · ${safeText(sp.name)}</strong><span>${safeText(sp.type)} · ${safeText(sp.meta)}</span></div>`).join('');
  spotList.innerHTML=routeSpotData.spots.map((sp,i)=>`<div class="spot-item" onclick="showSpot(${i})"><img class="spot-thumb" src="${sp.image||SPOT_PLACEHOLDER}" alt=""><div class="spot-item-copy"><h4>${safeText(sp.name)}</h4><p>${safeText(sp.desc)}</p><div class="spot-meta">${safeText(sp.type)} · ${safeText(sp.meta)}</div></div><button class="spot-save-button ${isSpotFavorite(routeId,i)?'saved':''}" onclick="event.stopPropagation();toggleSpotFavorite('${routeId}',${i})">${isSpotFavorite(routeId,i)?'♥ 已收藏':'♡ 收藏'}</button></div>`).join('');
  if(scroll){ requestAnimationFrame(()=>document.getElementById('spots').scrollIntoView({behavior:'smooth',block:'start'})); }
}

function showFootprintArchive(){
  currentSpotIndex=null;
  renderFootprints();
  requestAnimationFrame(()=>document.getElementById('spots').scrollIntoView({behavior:'smooth',block:'start'}));
}

function toggleRouteFavorite(routeId, btn=null){
  const wasRouteView=document.getElementById('routeSpotPanel').style.display==='block';
  const activeRouteId=currentSpotRouteId;
  if(isRouteFavorite(routeId)) favoriteRouteIds=favoriteRouteIds.filter(id=>id!==routeId);
  else favoriteRouteIds=[routeId,...favoriteRouteIds];
  saveArray(FOOTPRINT_STORAGE.favoriteRoutes,favoriteRouteIds);
  if(btn){btn.textContent=isRouteFavorite(routeId)?'♥':'♡';btn.classList.toggle('liked',isRouteFavorite(routeId));}
  if(wasRouteView) renderSpots(activeRouteId,false); else renderFootprints();
  renderRoutes(document.querySelector('.city-tab.active')?.dataset.city||'全部');
  showToast(isRouteFavorite(routeId)?'路线已收藏':'已取消路线收藏');
}

function toggleSpotFavorite(routeId,index){
  const wasRouteView=document.getElementById('routeSpotPanel').style.display==='block';
  const key=spotKey(routeId,index);
  if(favoriteSpotKeys.includes(key)) favoriteSpotKeys=favoriteSpotKeys.filter(k=>k!==key);
  else favoriteSpotKeys=[key,...favoriteSpotKeys];
  saveArray(FOOTPRINT_STORAGE.favoriteSpots,favoriteSpotKeys);
  if(wasRouteView && currentSpotRouteId===routeId) renderSpots(routeId,false);
  else renderFootprints();
  const btn=document.getElementById('spotFavoriteBtn');
  if(btn && currentSpotIndex===index && currentSpotRouteId===routeId){
    btn.textContent=isSpotFavorite(routeId,index)?'♥ 已收藏这个点位':'♡ 收藏这个打卡点';
  }
  showToast(favoriteSpotKeys.includes(key)?'打卡点已收藏到足迹':'已取消点位收藏');
}

function toggleCurrentSpotFavorite(){
  if(currentSpotIndex===null || !currentSpotRouteId) return;
  toggleSpotFavorite(currentSpotRouteId,currentSpotIndex);
}

function markRouteWalked(routeId,date=todayISO(),note=''){
  const existing=walkedRoutes.find(item=>item.routeId===routeId);
  if(existing){
    existing.date=date;
    if(note){
      existing.note=note;
      if(!existing.shortNote) existing.shortNote=shortenNote(note,72);
    }
  }else{
    walkedRoutes=[{routeId,date,note,shortNote:shortenNote(note,72)},...walkedRoutes];
  }
  expandedWalkId=routeId;
  saveArray(FOOTPRINT_STORAGE.walked,walkedRoutes);
  renderFootprints();
  showToast('这条 Walk 已记入足迹');
}

function removeFootprint(routeId){
  walkedRoutes=walkedRoutes.filter(item=>item.routeId!==routeId);
  if(expandedWalkId===routeId) expandedWalkId=walkedRoutes[0]?.routeId||null;
  saveArray(FOOTPRINT_STORAGE.walked,walkedRoutes);
  renderFootprints();
  showToast('已从足迹中移除');
}

function openAddFootprint(){
  const select=document.getElementById('footprintRouteSelect');
  select.innerHTML=routes.map(r=>`<option value="${r.id}">${safeText(r.city)} · ${safeText(r.title)}</option>`).join('');
  select.value=currentSpotRouteId || routes[0].id;
  document.getElementById('footprintDateInput').value=todayISO();
  document.getElementById('footprintNoteInput').value='';
  showModal('footprintModal');
}

function saveFootprintFromForm(){
  const routeId=document.getElementById('footprintRouteSelect').value;
  const date=document.getElementById('footprintDateInput').value || todayISO();
  const note=document.getElementById('footprintNoteInput').value.trim();
  if(!routeById(routeId)) return;
  closeModal('footprintModal');
  const planned=plannedRouteCatalog[routeId];
  if(planned && planned.eventId){
    handleWalkCompletion({
      routeId,
      eventId:planned.eventId,
      completedAt:date+'T12:00:00.000Z',
      note
    });
    return;
  }
  markRouteWalked(routeId,date,note);
}

function showToast(message){
  document.querySelectorAll('.toast').forEach(el=>el.remove());
  const toast=document.createElement('div');
  toast.className='toast';
  toast.textContent=message;
  document.body.appendChild(toast);
  setTimeout(()=>toast.remove(),2200);
}

function getPointsLevel(points=totalWalkPoints){
  let index=0;
  POINT_LEVELS.forEach((level,i)=>{if(points>=level.min) index=i;});
  return {level:POINT_LEVELS[index],index};
}

function renderPointsBoard(){
  const points=totalWalkPoints;
  const current=getPointsLevel(points);
  const next=POINT_LEVELS[current.index+1]||null;
  const totalEl=document.getElementById('walkPointsTotal');
  if(!totalEl) return;
  totalEl.textContent=points.toLocaleString('zh-CN');
  const foldEl=document.getElementById('walkPointsTotalFold');
  if(foldEl) foldEl.textContent=points.toLocaleString('zh-CN');

  const levelButton=document.getElementById('pointsCurrentLevel');
  levelButton.innerHTML=`<span class="points-current-level-text">${current.level.icon} ${current.level.title}</span><span class="points-level-arrow" aria-hidden="true"></span>`;
  levelButton.setAttribute('aria-label',`当前称号：${current.level.title}。点击查看全部等级与积分要求`);
  document.getElementById('pointsPopoverCurrent').textContent=`${current.level.icon} ${current.level.title}`;

  if(next){
    document.getElementById('pointsNextLevel').textContent=`下一等级 · ${next.title}`;
    document.getElementById('pointsProgressLabel').textContent=`还差 ${(next.min-points).toLocaleString('zh-CN')} 分`;
    const currentSpan=points-current.level.min;
    const span=next.min-current.level.min;
    const progressPct=Math.max(0,Math.min(100,currentSpan/span*100));
    document.getElementById('pointsProgressFill').style.width=`${progressPct}%`;
    document.getElementById('pointsProgressTrack')?.setAttribute('aria-valuenow',String(Math.round(progressPct)));
  }else{
    document.getElementById('pointsNextLevel').textContent='已达到最高等级';
    document.getElementById('pointsProgressLabel').textContent='城市漫游家，继续出发';
    document.getElementById('pointsProgressFill').style.width='100%';
    document.getElementById('pointsProgressTrack')?.setAttribute('aria-valuenow','100');
  }

  document.getElementById('pointsLevelLadder').innerHTML=POINT_LEVELS.map((level,i)=>{
    const achieved=points>=level.min;
    const active=i===current.index;
    const range=level.max===Infinity?`${level.min.toLocaleString('zh-CN')} 分及以上`:`${level.min.toLocaleString('zh-CN')}–${level.max.toLocaleString('zh-CN')} 分`;
    const state=active?'当前称号':achieved?'已解锁':`还差 ${(level.min-points).toLocaleString('zh-CN')} 分`;
    return `<div class="points-tier ${active?'current':''} ${achieved?'achieved':''}">
      <span class="points-tier-icon" aria-hidden="true">${level.icon}</span>
      <div class="points-tier-copy"><h4>${level.title}</h4><p>${range}</p></div>
      <span class="points-tier-state">${state}</span>
    </div>`;
  }).join('');
}

function positionPointsPopover(){
  const card=document.getElementById('walkPointsCard');
  const popover=document.getElementById('pointsLevelPopover');
  const button=document.getElementById('pointsCurrentLevel');
  const arrow=button?.querySelector('.points-level-arrow');
  if(!card || !popover || popover.hidden || !button || !arrow) return;

  // Anchor the panel directly under the gradient triangle instead of at the bottom of the whole points card.
  const cardRect=card.getBoundingClientRect();
  const arrowRect=arrow.getBoundingClientRect();
  const viewportGap=12;
  const availableWidth=Math.max(1, window.innerWidth-arrowRect.left-viewportGap);
  const panelWidth=Math.min(410, availableWidth);
  const left=Math.max(0, arrowRect.left-cardRect.left);
  const top=arrowRect.bottom-cardRect.top+5;
  const availableHeight=Math.max(120, window.innerHeight-arrowRect.bottom-viewportGap);

  popover.style.left=`${left}px`;
  popover.style.right='auto';
  popover.style.top=`${top}px`;
  popover.style.width=`${panelWidth}px`;
  popover.style.maxHeight=`${availableHeight}px`;
}

function togglePointsLevels(event){
  if(event) event.stopPropagation();
  const popover=document.getElementById('pointsLevelPopover');
  const button=document.getElementById('pointsCurrentLevel');
  const open=popover.hidden;
  popover.hidden=!open;
  button.setAttribute('aria-expanded',String(open));
  if(open) requestAnimationFrame(positionPointsPopover);
  else {
    popover.style.left='';
    popover.style.right='';
    popover.style.top='';
    popover.style.width='';
    popover.style.maxHeight='';
  }
}

function closePointsLevels(event){
  if(event) event.stopPropagation();
  const popover=document.getElementById('pointsLevelPopover');
  const button=document.getElementById('pointsCurrentLevel');
  popover.hidden=true;
  button.setAttribute('aria-expanded','false');
  popover.style.left='';
  popover.style.right='';
  popover.style.top='';
  popover.style.width='';
  popover.style.maxHeight='';
}

function showWalkRewardModal(routeId,earned,previousPoints,newPoints){
  const route=routeById(routeId);
  const spotMeta = routeSpots[routeId];
  const current=getPointsLevel(newPoints);
  const previous=getPointsLevel(previousPoints);
  const label = route ? `${route.city} · ${route.title}` : (spotMeta ? spotMeta.title : '一段城市漫游，已经成为你的新足迹。');
  document.getElementById('walkRewardRoute').textContent=label;
  document.querySelector('#walkRewardModal .points-reward-number').innerHTML=`+${earned}<span>积分</span>`;
  document.getElementById('walkRewardLevel').textContent=`${current.level.icon} ${current.level.title}`;
  const leveledUp=current.index>previous.index;
  document.getElementById('walkRewardMessage').textContent=leveledUp
    ?`恭喜升级！从「${previous.level.title}」晋升为「${current.level.title}」。积分已计入你的 WanderWalk 记录。`
    :'积分已计入你的 WanderWalk 记录。下次出发，继续解锁新的漫游称号。';
  showModal('walkRewardModal');
}

function normalizePendingPayload(raw){
  if(!raw) return null;
  const stops=(raw.stops||[]).map(function(s,i){
    return {
      name:s.name||('站点 '+(i+1)),
      type:s.poi_type||s.type||'打卡',
      meta:s.meta||(s.stay_min?('约 '+s.stay_min+' 分钟'):''),
      desc:s.desc||''
    };
  });
  const km=raw.distance_km||(raw.distanceM? (Number(raw.distanceM)/1000).toFixed(2):'');
  const act=raw.activity_min||raw.durationActivityMin||0;
  return {
    id:raw.routeId||raw.id,
    city:raw.city||'',
    title:raw.title||'Citywalk 路线',
    meta:raw.meta||((raw.city||'')+(km?(' · '+km+' km'):'')+(act?(' · 约 '+act+' 分钟'):'')),
    distanceM:raw.distance_m||raw.distanceM||0,
    durationActivityMin:act,
    stops:stops,
    savedAt:raw.createdAt||raw.savedAt||new Date().toISOString(),
    eventId:raw.eventId||raw.routeId||raw.id
  };
}

function openAddFootprintPrefilled(routeId){
  openAddFootprint();
  const select=document.getElementById('footprintRouteSelect');
  if(select && routeId) select.value=routeId;
  const note=document.getElementById('footprintNoteInput');
  if(note) note.placeholder='从规划页带来的路线，写下这次 Walk 的备注……';
}

function applyImportedPlannerPayload(payload, options={}){
  if(!payload) return null;
  const routeId = registerPlannedRoute(payload);
  if(!routeId) return null;
  plannerLinkedRouteId = routeId;
  renderRoutes(document.querySelector('.city-tab.active')?.dataset.city||'全部');
  renderSpots(routeId, true);
  setFootprintView('walks');
  if(options.awardPoints === true){
    handleWalkCompletion({ routeId, eventId: payload.eventId || ('import-' + routeId), completedAt: payload.savedAt || new Date().toISOString() });
  } else if(options.openFootprintForm !== false){
    openAddFootprintPrefilled(routeId);
  }
  showImportGuideBanner();
  showToast('已载入规划路线，可在足迹中记录这次 Walk');
  return routeId;
}

function importPlannedRouteFromSession(options={}){
  const consume = window.CitywalkBridge && window.CitywalkBridge.consumePendingRoute;
  const payload = normalizePendingPayload(consume ? consume() : null);
  if(!payload) return null;
  return applyImportedPlannerPayload(payload, options);
}

function handleWalkCompletion(payload={}){
  if(payload.route && typeof payload.route === 'object'){
    const rid = registerPlannedRoute(payload.route);
    if(rid) payload = Object.assign({}, payload, { routeId: rid });
  }
  const routeId=String(payload.routeId||payload.route||'').trim();
  if(!routeById(routeId)){
    if(payload.skipUnknownCheck) return {ok:false,reason:'unknown-route'};
    showToast('收到路线完成通知，但没有识别到对应路线');
    return {ok:false,reason:'unknown-route'};
  }
  const completedAtRaw=String(payload.completedAt||payload.date||new Date().toISOString());
  const completedDate=completedAtRaw.slice(0,10) || todayISO();
  // eventId 必须由规划站为每次完成生成唯一值；旧版无 eventId 链接按路线+日期降级去重。
  const eventId=String(payload.eventId||`fallback-${routeId}-${completedDate}`).trim();
  const alreadyCompleted=completionEvents.some(e=>(typeof e==='string'?e:e?.eventId)===eventId);
  if(alreadyCompleted){
    renderPointsBoard();
    showToast('这次 Walk 已经领取过积分啦');
    return {ok:true,duplicate:true,points:totalWalkPoints};
  }
  const wasRoutePanelVisible=document.getElementById('routeSpotPanel')?.style.display==='block';
  const previousPoints=totalWalkPoints;
  const earned=POINTS_PER_WALK;
  totalWalkPoints+=earned;
  saveNumber(POINTS_STORAGE.total,totalWalkPoints);
  completionEvents=[...completionEvents,{eventId,routeId,completedAt:completedDate,points:earned}];
  // 防止本地事件记录无限增长，只保留最近 500 条已处理事件。
  if(completionEvents.length>500) completionEvents=completionEvents.slice(-500);
  saveArray(POINTS_STORAGE.events,completionEvents);
  markRouteWalked(routeId,completedDate,String(payload.note||''));
  // 若用户从规划站深链进入了某条路线的点位页，记足迹后恢复该页，再显示奖励弹窗。
  if(wasRoutePanelVisible) renderSpots(routeId,false);
  renderPointsBoard();
  showWalkRewardModal(routeId,earned,previousPoints,totalWalkPoints);
  return {ok:true,duplicate:false,points:totalWalkPoints,earned};
}

// 供外部路线规划站通过 window.opener.postMessage 发送完成事件。
// 上线时应将 message 来源限制为实际规划站域名，并在服务端校验完成事件。
window.addEventListener('message',event=>{
  const data=event.data;
  if(!data) return;
  if(data.type==='CITYWALK_ROUTE_COMPLETE'){
    const raw = data.payload || data.route;
    const normalized = normalizePendingPayload(raw);
    if(normalized){
      applyImportedPlannerPayload(normalized, { awardPoints: false, openFootprintForm: true });
      return;
    }
    handleWalkCompletion({ route: raw, eventId: raw && (raw.eventId || raw.id), completedAt: raw && (raw.createdAt || raw.savedAt) });
    return;
  }
  if(data.type==='WANDERWALK_CITYWALK_COMPLETED') handleWalkCompletion(data);
});

// 若外部规划站与本页同一浏览器上下文可调用此公开桥接函数。
window.WanderWalkRewards={
  completeWalk:(routeId,eventId,completedAt=new Date().toISOString())=>handleWalkCompletion({routeId,eventId,completedAt}),
  importRoute:(routePayload)=>registerPlannedRoute(routePayload)
};
window.CitywalkCommunity = {
  importPlannedRouteFromSession,
  registerPlannedRoute
};

function renderFeed(type='全部',keyword=''){
  const key=keyword.trim().toLowerCase();
  const data=posts.filter(p=>{
    const hitType=type==='全部'||p.type===type;
    const blob=[p.title,p.desc,p.city,p.type,...p.tags].join(' ').toLowerCase();
    return hitType&&(!key||blob.includes(key));
  });
  feedGrid.innerHTML=data.map((p)=>`<article class="post" onclick="showPost(${posts.indexOf(p)})">\
    <span class="post-type-badge">${safeText(p.type||'动态')}</span>\
    <span class="post-demo-ribbon">示例</span>\
    <img class="post-cover" src="${p.image}" alt="${p.title}">\
    <div class="post-body"><div class="post-title">${p.title}</div><div class="post-desc">${p.desc}</div><div class="tags">${p.tags.map(t=>`<span class="tag">${t}</span>`).join('')}</div></div>\
    <div class="post-footer"><div class="post-user"><span class="avatar-initial" aria-hidden="true">${safeText((p.author||'?').slice(0,1))}</span><span>${p.author}</span></div><div class="post-actions"><span class="clickable" onclick="event.stopPropagation();toggleLike(this)">♡ 示例 ${p.likes}</span><span class="clickable" onclick="event.stopPropagation();toggleSaveText(this)">♧ 收藏</span></div></div>\
  </article>`).join('');
  feedEmpty.style.display=data.length?'none':'block';
}

function renderBuddies(filter='全部'){
  const data=filter==='全部'?buddies:buddies.filter(b=>b.filter===filter||b.tags.includes(filter));
  buddyGrid.innerHTML=data.map((b,i)=>`<article class="buddy-card">\
    <span class="status">● 正在招募</span>\
    <div class="buddy-user"><span class="avatar-initial" aria-hidden="true">${safeText((b.user||'?').slice(0,1))}</span><div><strong>${b.user}</strong><span>${b.city} · CityWalk</span></div></div>\
    <div class="buddy-title">${b.title}</div><div class="buddy-desc">${b.desc}</div>\
    <div class="buddy-info"><div class="info-box"><span>出发时间</span><strong>${b.date}</strong></div><div class="info-box"><span>人数</span><strong>${b.people}</strong></div></div>\
    <div class="buddy-tags">${b.tags.map(t=>`<span class="buddy-tag">#${t}</span>`).join('')}</div>\
    <button class="join" onclick="openJoin(${buddies.indexOf(b)})">＋ 加入这次 Walk</button>\
  </article>`).join('');
}

let currentRouteId = null;

function openRoute(index){
  const r=routes[index];
  currentRouteId=r.id;
  currentSpotIndex=null;
  document.getElementById('spotFavoriteBtn').style.display='none';
  document.getElementById('spotJumpBtn').style.display='';
  document.getElementById('routeFavoriteModalBtn').style.display='';
  document.getElementById('routeFavoriteModalBtn').textContent=isRouteFavorite(r.id)?'♥ 已收藏路线':'♡ 收藏这条路线';
  document.getElementById('modalCover').src=r.image;
  document.getElementById('modalKicker').textContent=`${r.city} · ${r.type} · ${r.author}`;
  document.getElementById('modalTitle').textContent=r.title;
  document.getElementById('modalLead').textContent=r.desc;
  document.getElementById('modalStats').innerHTML=[`📏 ${r.distance}`,`🕐 ${r.time}`,`◌ ${r.level}`,`♥ ${r.likes}`].map(x=>`<span class="modal-stat">${x}</span>`).join('');
  document.getElementById('modalStops').innerHTML=r.stops.map(s=>`<li>${s}</li>`).join('');
  document.getElementById('modalTips').innerHTML=r.tips.map(s=>`<li>${s}</li>`).join('');
  document.getElementById('spotJumpBtn').textContent=`📍 查看「${routeSpots[r.id]?.title || r.city+'路线'}」的打卡点`;
  showModal('routeModal');
}

function openRouteSpots(){
  if(!currentRouteId) return;
  closeModal('routeModal');
  renderSpots(currentRouteId,true);
}

function openRecordedSpot(routeId,index){
  const data=routeSpots[routeId];
  if(!data || !data.spots[index]) return;
  currentSpotRouteId=routeId;
  currentSpotItems=data.spots;
  spotMode='route';
  showSpot(index);
}

function shortenNote(value,max=72){
  const text=String(value||'').trim();
  return text.length>max?text.slice(0,max-1)+'…':text;
}

function toggleWalkRecord(routeId){
  expandedWalkId=expandedWalkId===routeId?null:routeId;
  renderFootprints();
}

function saveWalkNote(routeId){
  const shortField=document.getElementById(`walk-short-${routeId}`);
  const longField=document.getElementById(`walk-note-${routeId}`);
  const record=walkedRoutes.find(item=>item.routeId===routeId);
  if(!record) return;
  if(shortField) record.shortNote=shortField.value.trim().slice(0,72);
  if(longField) record.note=longField.value.trim().slice(0,1500);
  saveArray(FOOTPRINT_STORAGE.walked,walkedRoutes);
  expandedWalkId=routeId;
  renderFootprints();
  showToast((record.shortNote||record.note)?'这条 Walk 的感想已保存':'已清空这条 Walk 的感想');
}

function showSpot(index){
  const s=currentSpotItems[index];
  if(!s) return;
  currentSpotIndex=index;
  document.getElementById('spotFavoriteBtn').style.display='';
  document.getElementById('spotFavoriteBtn').textContent=isSpotFavorite(currentSpotRouteId,index)?'♥ 已收藏这个点位':'♡ 收藏这个打卡点';
  document.getElementById('spotJumpBtn').style.display='';
  document.getElementById('routeFavoriteModalBtn').style.display='';
  document.getElementById('routeFavoriteModalBtn').textContent=isRouteFavorite(currentSpotRouteId)?'♥ 已收藏路线':'♡ 收藏这条路线';
  document.getElementById('modalCover').src=s.image;
  document.getElementById('modalKicker').textContent=`${routeSpots[currentSpotRouteId]?.meta.split(' · ')[0] || 'CityWalk'} · ${s.type} · 沿途打卡点`;
  document.getElementById('modalTitle').textContent=s.name;
  document.getElementById('modalLead').textContent=s.desc;
  document.getElementById('modalStats').innerHTML=[`📍 ${s.type}`,`🕐 ${s.meta}`,`✦ 适合 CityWalk`].map(x=>`<span class="modal-stat">${x}</span>`).join('');
  document.getElementById('modalStops').innerHTML=[s.meta,s.desc,`来自「${routeSpots[currentSpotRouteId]?.title || '当前路线'}」`].map(x=>`<li>${x}</li>`).join('');
  document.getElementById('modalTips').innerHTML=['把停留时间算进整条路线，不要只计算步行时间。','周末热门点位可能需要排队或预约，请以现场规则为准。','CityWalk 是弹性行走，不必严格按固定节奏完成。'].map(x=>`<li>${x}</li>`).join('');
  currentRouteId=currentSpotRouteId;
  document.getElementById('spotJumpBtn').textContent=`📍 查看「${routeSpots[currentSpotRouteId]?.title || '当前路线'}」的完整打卡点`;
  showModal('routeModal');
}

function showPost(index){
  const p=posts[index];
  currentSpotIndex=null;
  document.getElementById('spotFavoriteBtn').style.display='none';
  document.getElementById('spotJumpBtn').style.display='none';
  document.getElementById('routeFavoriteModalBtn').style.display='none';
  document.getElementById('modalCover').src=p.image;
  document.getElementById('modalKicker').textContent=`${p.city} · 社区 ${p.type} · ${p.author}`;
  document.getElementById('modalTitle').textContent=p.title;
  document.getElementById('modalLead').textContent=p.desc;
  document.getElementById('modalStats').innerHTML=[`♥ ${p.likes}`,`📍 ${p.city}`,...p.tags].map(x=>`<span class="modal-stat">${x}</span>`).join('');
  document.getElementById('modalStops').innerHTML=['先看完整路线，再决定停留点','优先收藏真正适合自己节奏的路线','可以在找搭子区发布同行请求'].map(x=>`<li>${x}</li>`).join('');
  document.getElementById('modalTips').innerHTML=['社区分享仅作路线灵感，具体营业时间、交通安排请以现场与官方信息为准。','请尊重店铺、居民区与公共空间的拍摄和通行规则。'].map(x=>`<li>${x}</li>`).join('');
  showModal('routeModal');
}

function openJoin(index){
  const b=buddies[index];
  document.getElementById('buddyModalTitle').textContent='加入这次 Walk';
  document.getElementById('buddyModalDesc').textContent=`你正在申请加入 ${b.user} 发起的同行计划。`;
  document.getElementById('buddyPreview').innerHTML=`<strong>${b.title}</strong><div style="font-size:12px;color:#666;line-height:1.8">📍 ${b.city}<br>🕐 ${b.date}<br>👥 ${b.people}<br>🏷️ ${b.tags.map(x=>'#'+x).join(' ')}</div>`;
  document.getElementById('buddyConfirm').onclick=()=>{alert('已记录你的加入意向（演示交互）。');closeModal('buddyModal')};
  showModal('buddyModal');
}

function openCreateBuddy(){
  document.getElementById('buddyModalTitle').textContent='发起一次 Walk';
  document.getElementById('buddyModalDesc').textContent='在真实产品中，这里可以创建出发时间、路线、人数上限和兴趣标签。';
  document.getElementById('buddyPreview').innerHTML='<strong>发起模板</strong><div style="font-size:12px;color:#666;line-height:1.9">路线：选择一条已有 CityWalk 或创建自定义路线<br>时间：今天 / 周末 / 自定义时间<br>人数：1–8 人<br>标签：摄影 / 美食 / 咖啡 / 夜游 / 轻徒步</div>';
  document.getElementById('buddyConfirm').onclick=()=>{alert('已打开“发起 Walk”示例流程。');closeModal('buddyModal')};
  showModal('buddyModal');
}

function openPublish(){showModal('publishModal')}
function showModal(id){document.getElementById(id).classList.add('show');document.body.style.overflow='hidden'}
function closeModal(id){document.getElementById(id).classList.remove('show');document.body.style.overflow=''}

function openBuddiesPage(event){
  if(event){event.preventDefault();}
  const section=document.getElementById('buddies');
  const isOpen=section.classList.contains('buddy-section-visible');
  if(isOpen){
    closeBuddiesPage();
    return;
  }
  section.classList.remove('buddy-section-hidden');
  section.classList.add('buddy-section-visible');
  renderBuddies(document.querySelector('.buddy-filter.active')?.dataset.filter || '全部');
  updateBuddyToggle(true);
  requestAnimationFrame(()=>{
    section.scrollIntoView({behavior:'smooth',block:'start'});
  });
}

function toggleBuddiesPage(event){
  if(event){event.preventDefault();event.stopPropagation();}
  const section=document.getElementById('buddies');
  const isOpen=section.classList.contains('buddy-section-visible');
  if(isOpen){closeBuddiesPage();}
  else{openBuddiesPage();}
}

function closeBuddiesPage(){
  const section=document.getElementById('buddies');
  section.classList.remove('buddy-section-visible');
  section.classList.add('buddy-section-hidden');
  updateBuddyToggle(false);
  requestAnimationFrame(()=>{
    document.getElementById('routes').scrollIntoView({behavior:'smooth',block:'start'});
  });
}

function setHeroPrimaryBuddyLabel(isOpen){
  const heroBtn=document.querySelector('.hero-btn.primary');
  if(!heroBtn) return;
  const label=heroBtn.querySelector('.hero-btn-label');
  const icon=heroBtn.querySelector('.hero-btn-icon');
  if(label) label.textContent=isOpen?'收起找搭子':'先找搭子';
  if(icon) icon.textContent=isOpen?'↕':'👥';
}

function updateBuddyToggle(isOpen){
  const btn=document.getElementById('buddyCollapseBtn');
  if(btn) btn.textContent=isOpen?'收起搭子区 ↑':'展开搭子区 ↓';
  document.querySelectorAll('.buddy-nav').forEach(a=>{
    a.classList.toggle('buddy-nav-open',isOpen);
    const label=a.dataset.defaultLabel || '👥 找搭子';
    a.textContent=isOpen?'👥 收起搭子':label;
    a.dataset.defaultLabel=label;
  });
  setHeroPrimaryBuddyLabel(isOpen);
}

function scrollToId(id){document.getElementById(id).scrollIntoView({behavior:'smooth'})}
function saveRoute(btn){btn.textContent=btn.textContent==='♡'?'♥':'♡';btn.style.color=btn.textContent==='♥'?'#ff385c':''}
function toggleLike(el){el.classList.toggle('liked');el.textContent=el.classList.contains('liked')?el.textContent.replace('♡','♥'):el.textContent.replace('♥','♡')}
function toggleSaveText(el){el.classList.toggle('liked');el.textContent=el.classList.contains('liked')?'♣ 已收藏':'♧ 收藏'}
function favoriteRoute(){if(!currentRouteId)return;toggleRouteFavorite(currentRouteId);document.getElementById('routeFavoriteModalBtn').textContent=isRouteFavorite(currentRouteId)?'♥ 已收藏路线':'♡ 收藏这条路线';}

// city tabs
Array.from(document.querySelectorAll('.city-tab')).forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('.city-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderRoutes(btn.dataset.city);
}));

// feed tabs
Array.from(document.querySelectorAll('.feed-tab')).forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('.feed-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderFeed(btn.dataset.type,document.getElementById('searchInput').value);
}));

// buddy filters
Array.from(document.querySelectorAll('.buddy-filter')).forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('.buddy-filter').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderBuddies(btn.dataset.filter);
}));

// global search
let searchTimer;
document.getElementById('searchInput').addEventListener('input',()=>{
  clearTimeout(searchTimer);
  searchTimer=setTimeout(()=>{
    const activeFeed=document.querySelector('.feed-tab.active')?.dataset.type||'全部';
    renderFeed(activeFeed,document.getElementById('searchInput').value);
    scrollToId('feed');
  },120);
});

// close modals by backdrop + ESC
Array.from(document.querySelectorAll('.modal')).forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeModal(m.id)}));
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.modal.show').forEach(m=>closeModal(m.id))});

// nav active state（顶栏：规划 / 社区 / 找搭子）
const sections=['home','buddies','routes','feed','spots'];
const navLinks=Array.from(document.querySelectorAll('.nav-links a'));
const navLinkBySection={};
navLinks.forEach(a=>{
  const href=a.getAttribute('href')||'';
  if(href.startsWith('#')&&href.length>1) navLinkBySection[href.slice(1)]=a;
});
const io=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){
  navLinks.forEach(a=>a.classList.remove('active'));
  const link=navLinkBySection[entry.target.id];
  if(link) link.classList.add('active');
}})},{threshold:.2,rootMargin:'-20% 0px -60% 0px'});
sections.forEach(id=>{const el=document.getElementById(id);if(el)io.observe(el)});
if(navLinkBySection.home) navLinkBySection.home.classList.add('active');

renderRoutes();
renderFootprints();
renderFeed();
renderBuddies();
renderPointsBoard();
renderHeroBuddyPreview();
updateBuddyToggle(true);

document.addEventListener('click',event=>{
  const popover=document.getElementById('pointsLevelPopover');
  const trigger=document.getElementById('pointsCurrentLevel');
  if(popover && !popover.hidden && !popover.contains(event.target) && !trigger.contains(event.target)) closePointsLevels();
});
document.addEventListener('keydown',event=>{ if(event.key==='Escape') closePointsLevels(); });
window.addEventListener('resize',()=>{
  const popover=document.getElementById('pointsLevelPopover');
  if(popover && !popover.hidden) positionPointsPopover();
});

// 外接规划站可用 ?route=路线ID 直达该路线点位页；完成后附加 walkComplete=1 与唯一 eventId，自动记入积分并弹出奖励。
const integrationParams = new URLSearchParams(window.location.search);
const incomingRouteId = integrationParams.get('route');
if(incomingRouteId && routeSpots[incomingRouteId]){
  currentRouteId=incomingRouteId;
  renderSpots(incomingRouteId,false);
  requestAnimationFrame(()=>{
    document.getElementById('spots').scrollIntoView({behavior:'smooth',block:'start'});
  });
}
if(integrationParams.get('walkComplete')==='1'){
  const completedRouteId=integrationParams.get('route')||integrationParams.get('routeId');
  const completionEventId=integrationParams.get('eventId')||'';
  const completedAt=integrationParams.get('completedAt')||new Date().toISOString();
  setTimeout(()=>{
    handleWalkCompletion({routeId:completedRouteId,eventId:completionEventId,completedAt});
    // 清理一次性完成参数，避免刷新页面重复处理；保留 route 以便仍可回看该路线点位。
    const cleanUrl=new URL(window.location.href);
    cleanUrl.searchParams.delete('walkComplete');
    cleanUrl.searchParams.delete('eventId');
    cleanUrl.searchParams.delete('completedAt');
    try{window.history.replaceState({},'',cleanUrl.toString());}catch(e){/* file:// 本地预览可能不允许改写地址；eventId 仍会避免重复积分。 */}
  },220);
}

if(integrationParams.get('import')==='1'){
  setTimeout(function(){
    importPlannedRouteFromSession({ awardPoints: false, openFootprintForm: true });
    try{
      const cleanUrl=new URL(window.location.href);
      cleanUrl.searchParams.delete('import');
      window.history.replaceState({},'',cleanUrl.toString());
    }catch(e){}
  },180);
}
