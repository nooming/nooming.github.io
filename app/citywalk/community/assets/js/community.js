const routeGrid=document.getElementById('routeGrid');
const spotList=document.getElementById('spotList');
const spotPath=document.getElementById('spotPath');
const feedGrid=document.getElementById('feedGrid');
const feedEmpty=document.getElementById('feedEmpty');
const FEED_SAVED_STORAGE_KEY='wanderwalk_feed_saved_v1';
const BUDDY_SAVED_STORAGE_KEY='wanderwalk_buddy_saved_v1';
let feedVisibleCount=8;
let feedViewSavedOnly=false;
let feedSavedIds=loadFeedSavedIds();
let buddySavedIds=loadBuddySavedIds();
let mePrimaryTab='saved';
let meSavedTab='notes';
let publishSelectedTags=[];
let activeDetailPostId = null;
const FEED_TAG_SUGGESTIONS=[
  {name:'Citywalk',keys:['citywalk','walk','散步','漫游']},
  {name:'咖啡',keys:['咖啡','café','手冲']},
  {name:'胡同',keys:['胡同','老街','巷弄']},
  {name:'摄影',keys:['摄影','拍照','机位','夜景']},
  {name:'周末半日',keys:['周末','半日','半天']},
  {name:'独自出发',keys:['一个人','独自','独处']},
  {name:'美食',keys:['美食','小吃','探店']},
  {name:'建筑',keys:['建筑','立面','历史']},
  {name:'规划导入',keys:['规划','导入','路线']},
  {name:'苏州河',keys:['苏州河','滨江','河']},
  {name:'西湖',keys:['西湖','湖西','杭州']},
  {name:'沙面',keys:['沙面','广州','岭南']}
];
const buddyGrid=document.getElementById('buddyGrid');

/** 社区用户可见文案（术语与语气统一，见 citywalk-后续.md · 文案规范） */
const WW_COPY = {
  planner: '步行路线规划',
  activity: 'Citywalk',
  sampleRouteNote: '示例路线，仅供参考。自建路线请前往规划页，完成后可「记录到社区」。',
  samplePostNote: '示例笔记。登录后点「＋ 发布」即可分享你的 Walk。',
  sampleBuddyNote: '示例招募。登录后点「＋ 发起 Walk」可发布真实招募。',
  modalTipsRoute: [
    '停留时间应计入整段 Walk，而不只算步行段。',
    '热门点位可能需要排队或预约，请以现场为准。',
    'Citywalk 宜慢走，不必卡死每个时间点。'
  ],
  modalTipsPost: [
    '内容仅供参考，出行前请确认营业时间与当地规则。',
    '想找人同行可在「找搭子」发起招募，或使用路线规划生成线路。'
  ]
};

function showDemoUnavailable(feature){
  showToast(feature ? `${feature} · 演示版尚未开放` : '演示版尚未开放');
}

const IMPORT_GUIDE_DISMISS_KEY = 'ww_import_guide_dismissed';

function dismissImportGuide(){
  const el=document.getElementById('importGuideBanner');
  if(!el) return;
  el.hidden=true;
  try{ sessionStorage.setItem(IMPORT_GUIDE_DISMISS_KEY,'1'); }catch(e){/* private mode */}
}

function showImportGuideBanner(){
  const el=document.getElementById('importGuideBanner');
  if(!el) return;
  try{
    if(sessionStorage.getItem(IMPORT_GUIDE_DISMISS_KEY)==='1') return;
  }catch(e){/* ignore */}
  el.hidden=false;
}

function resetImportGuideDismiss(){
  try{ sessionStorage.removeItem(IMPORT_GUIDE_DISMISS_KEY); }catch(e){/* ignore */}
}

function buddiesSource() {
  if (ugcBuddies.length) return ugcBuddies;
  return typeof demoBuddies !== 'undefined' && Array.isArray(demoBuddies) ? demoBuddies : [];
}

function findBuddy(buddyId) {
  const hit = ugcBuddies.find(function (x) { return x.id === buddyId; });
  if (hit) return hit;
  if (typeof demoBuddies !== 'undefined' && Array.isArray(demoBuddies)) {
    return demoBuddies.find(function (x) { return x.id === buddyId; }) || null;
  }
  return null;
}

function updateHeroBuddyCount() {
  const countEl = document.querySelector('.hero-buddy-count');
  if (!countEl) return;
  const n = buddiesSource().length;
  countEl.textContent = n
    ? (n + ' 组正在招募' + (ugcBuddies.length ? '' : ' · 示例'))
    : '暂无招募，欢迎发起第一场 Walk';
}

function renderHeroBuddyPreview(){
  const list=document.getElementById('heroBuddyList');
  if(!list) return;
  const source=buddiesSource();
  if(!source.length){
    list.innerHTML='<div class="hero-buddy-item"><span>暂无招募，</span><strong>前往找搭子发起「＋ 发起 Walk」</strong></div>';
    return;
  }
  list.innerHTML=source.slice(0,2).map(b=>{
    const initial=String(b.user||'?').slice(0,1);
    const isUgc=!b.is_demo;
    return `<div class="hero-buddy-item"><span class="hero-buddy-avatar${isUgc?'':' hero-buddy-avatar--demo'}" data-demo="${safeText(initial)}"></span><div><strong>${safeText(b.city)} · ${safeText(b.title)}</strong><span>${safeText(b.date)} · ${safeText((b.tags||[])[0]||'Walk')} · ${safeText(b.people)}</span></div></div>`;
  }).join('');
}

function requireLoginForPost(){
  if(typeof CitywalkAuth!=='undefined'&&CitywalkAuth.isLoggedIn()) return true;
  showToast('请先登录（点击右上角「我」）');
  if(typeof CitywalkAuth!=='undefined') CitywalkAuth.openAuthModal('login');
  return false;
}

async function loadCommunityUgc(){
  if(!window.CitywalkCommunityApi) return;
  try{
    const data=await CitywalkCommunityApi.refreshAll();
    ugcPosts=data.posts||[];
    ugcBuddies=data.buddies||[];
  }catch(e){
    console.warn('loadCommunityUgc',e);
    showToast('内容加载失败，请稍后刷新页面');
  }
  renderHeroBuddyPreview();
  updateHeroBuddyCount();
  renderFeedHotTags();
  applyCommunitySearch({ scroll: false });
  renderMePage();
}

function isSampleRoute(r) {
  if (!r) return false;
  if (r._source === 'sample') return true;
  if (r._source === 'ugc' || r._source === 'mine' || r.type === '规划导入') return false;
  return !plannedRouteCatalog[r.id];
}

function getSampleDiscoverRoutes() {
  return routes.filter(function (r) { return r.type !== '规划导入'; }).map(function (r) {
    return Object.assign({}, r, { _source: 'sample' });
  });
}

function ugcPostToDiscoverCard(p) {
  const tags = Array.isArray(p.tags) ? p.tags : [];
  return {
    id: 'ugc-' + p.id,
    city: p.city || '—',
    type: p.type || '社区分享',
    title: p.title || '无标题',
    desc: p.desc || '',
    image: postCoverUrl(p),
    distance: p.share_route_id ? '含分享链' : (p.route_id ? '已关联路线' : '—'),
    time: '—',
    level: '真实分享',
    likes: String(Number(p.like_count) || 0),
    author: p.author || '用户',
    avatar: '',
    stops: tags.slice(0, 4).map(function (t) { return String(t).replace(/^#/, ''); }),
    tips: p.share_route_id
      ? ['帖子已绑定规划分享链，可在详情中打开步行路线。']
      : ['来自灵感社区；自建路线请前往 Citywalk 规划页。'],
    _source: 'ugc',
    _ugcPostId: p.id,
    share_route_id: p.share_route_id || '',
  };
}

function getDiscoverRoutes() {
  const ugc = ugcPosts
    .filter(function (p) {
      return p.type === '路线' || p.share_route_id || p.route_id;
    })
    .map(ugcPostToDiscoverCard);
  return ugc.concat(getSampleDiscoverRoutes());
}

function getImportedRoutes(){
  const seen = {};
  const list = routes.filter(function (r) {
    return r.type === '规划导入' || !!plannedRouteCatalog[r.id];
  }).map(function (r) {
    seen[r.id] = true;
    return Object.assign({}, r, { _source: 'mine' });
  });
  Object.keys(plannedRouteCatalog).forEach(function (id) {
    if (seen[id]) return;
    const planned = routeById(id);
    if (!planned) return;
    list.push(Object.assign({}, planned, { type: '规划导入', _source: 'mine' }));
  });
  return list;
}

function routeDiscoverBlob(r) {
  const stops = (r.stops || []).join(' ');
  return [r.title, r.desc, r.city, r.type, stops].join(' ').toLowerCase();
}

function routesForDiscover(city, keyword) {
  const key = String(keyword || '').trim().toLowerCase();
  let pool = getDiscoverRoutes();
  if (city && city !== '全部') pool = pool.filter(function (r) { return r.city === city; });
  if (key) pool = pool.filter(function (r) { return routeDiscoverBlob(r).includes(key); });
  return pool;
}

function discoverUgcPostIds() {
  const ids = new Set();
  ugcPosts.forEach(function (p) {
    if (p.type === '路线' || p.share_route_id || p.route_id) ids.add(p.id);
  });
  return ids;
}

function isUgcRouteDiscoverPost(p) {
  if (!p) return false;
  return p.type === '路线' || !!p.share_route_id || !!p.route_id;
}

function shouldShowInspireRoutes(type) {
  return type === '路线';
}

function useInspireMixedFeed(type) {
  return type === '全部' && !feedViewSavedOnly;
}

function buildInspireMixedHtmlList(keyword) {
  const routes = routesForDiscover('全部', keyword);
  let posts = filterFeedPosts('全部', keyword);
  const sortEl = document.getElementById('feedSort');
  const sortMode = sortEl ? sortEl.value : 'default';
  if (sortMode === 'newest') posts = [...posts].reverse();
  return routes.map(renderRouteCardHtml).concat(posts.map(postCardHtml));
}

/** 顶栏搜索范围：all | buddies | inspire */
let communitySearchScope = 'all';

function communitySearchKeyword() {
  return document.getElementById('searchInput')?.value || '';
}

function keywordForInspire() {
  if (communitySearchScope === 'buddies') return '';
  return communitySearchKeyword();
}

function keywordForBuddies() {
  if (communitySearchScope === 'inspire') return '';
  return communitySearchKeyword();
}

function buddyMatchesKeyword(b, key) {
  if (!key) return true;
  const tags = (b.tags || []).join(' ');
  const blob = [b.city, b.title, b.desc, b.date, b.filter, b.user, tags].join(' ').toLowerCase();
  return blob.includes(key);
}

function activeBuddyFilter() {
  return document.querySelector('.buddy-filter.active')?.dataset.filter || '全部';
}

function buddiesFiltered(filter, keyword) {
  const source = buddiesSource();
  let data;
  if (filter === '收藏') {
    data = source.filter(function (b) { return b.id && isBuddySaved(b.id); });
  } else if (filter === '全部') {
    data = source;
  } else {
    data = source.filter(function (b) {
      return b.filter === filter || (b.tags || []).includes(filter);
    });
  }
  const key = String(keyword !== undefined ? keyword : keywordForBuddies()).trim().toLowerCase();
  if (key) data = data.filter(function (b) { return buddyMatchesKeyword(b, key); });
  return data;
}

function filterFeedPosts(type, keyword) {
  const key = String(keyword !== undefined ? keyword : keywordForInspire()).trim().toLowerCase();
  const source = feedPostsSource();
  const ugcRouteIds = discoverUgcPostIds();
  return source.filter(function (p) {
    if (feedViewSavedOnly && !isPostSaved(p.id)) return false;
    if (type === '路线' && !feedViewSavedOnly) return false;
    if (type === '全部' && !feedViewSavedOnly && ugcRouteIds.has(p.id) && isUgcRouteDiscoverPost(p)) return false;
    const hitType = type === '全部' || p.type === type;
    const tags = Array.isArray(p.tags) ? p.tags : [];
    const blob = [p.title, p.desc, p.city, p.type, ...tags].join(' ').toLowerCase();
    return hitType && (!key || blob.includes(key));
  });
}

function syncSearchScopeUi() {
  document.querySelectorAll('[data-search-scope]').forEach(function (btn) {
    const on = (btn.dataset.searchScope || 'all') === communitySearchScope;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
  });
}

function setCommunitySearchScope(scope) {
  communitySearchScope = scope || 'all';
  syncSearchScopeUi();
}

function bindSearchResultsBarActions() {
  const actions = document.getElementById('searchResultsActions');
  if (!actions) return;
  actions.querySelectorAll('[data-scroll]').forEach(function (btn) {
    btn.onclick = function () {
      const target = btn.dataset.scroll || 'inspire';
      if (target === 'buddies') ensureBuddiesPageOpen({ scroll: false });
      scrollToId(target);
    };
  });
}

function searchResultCounts() {
  const filter = activeBuddyFilter();
  const inspireKey = keywordForInspire();
  const city = document.querySelector('#cityTabs .city-tab.active')?.dataset.city || '全部';
  const feedType = document.querySelector('.feed-tab.active')?.dataset.type || '全部';
  return {
    buddyN: buddiesFiltered(filter).length,
    routeN: routesForDiscover(city, inspireKey).length,
    noteN: filterFeedPosts(feedType, inspireKey).length
  };
}

function formatSearchResultsSummary(key, counts) {
  const q = '「' + key + '」';
  if (communitySearchScope === 'buddies') {
    return q + ' · 招募 ' + counts.buddyN;
  }
  if (communitySearchScope === 'inspire') {
    return q + ' · 路线 ' + counts.routeN + ' · 笔记 ' + counts.noteN;
  }
  return q + ' · 招募 ' + counts.buddyN + ' · 路线 ' + counts.routeN + ' · 笔记 ' + counts.noteN;
}

function renderSearchResultsBar() {
  const bar = document.getElementById('searchResultsBar');
  const summary = document.getElementById('searchResultsSummary');
  const actions = document.getElementById('searchResultsActions');
  const clearBtn = document.getElementById('searchResultsClear');
  if (!bar || !summary || !actions) return;

  const key = communitySearchKeyword().trim();
  if (!key) {
    bar.hidden = true;
    if (clearBtn) clearBtn.hidden = true;
    actions.innerHTML = '';
    return;
  }

  const counts = searchResultCounts();
  const inspireTotal = counts.routeN + counts.noteN;

  bar.hidden = false;
  if (clearBtn) clearBtn.hidden = false;
  syncSearchScopeUi();
  summary.textContent = formatSearchResultsSummary(key, counts);

  if (communitySearchScope === 'buddies' || communitySearchScope === 'inspire') {
    actions.innerHTML = '';
    actions.hidden = true;
  } else {
    actions.innerHTML = '<button type="button" class="search-results-jump" data-scroll="buddies">找搭子 <em>' + counts.buddyN + '</em></button>'
      + '<button type="button" class="search-results-jump" data-scroll="inspire">灵感 <em>' + inspireTotal + '</em></button>';
    actions.hidden = false;
    bindSearchResultsBarActions();
  }
}

function syncSearchViewForActiveSearch(key, scroll) {
  if (!key) return;
  if (document.body.classList.contains('community-view-me')) {
    closeMePage('#home');
  }
  const instant = !scroll;
  if (communitySearchScope === 'buddies') {
    switchCommunityView('buddies', { skipHash: false, instant: instant });
    return;
  }
  if (communitySearchScope === 'inspire') {
    switchCommunityView('inspire', { skipHash: false, instant: instant });
    return;
  }
  if (communityViewId === 'home') {
    const city = document.querySelector('#cityTabs .city-tab.active')?.dataset.city || '全部';
    const feedType = document.querySelector('.feed-tab.active')?.dataset.type || '全部';
    const inspireKey = keywordForInspire();
    const buddyN = buddiesFiltered(activeBuddyFilter()).length;
    const routeN = routesForDiscover(city, inspireKey).length;
    const noteN = filterFeedPosts(feedType, inspireKey).length;
    const inspireTotal = routeN + noteN;
    if (buddyN > 0 && buddyN >= inspireTotal) {
      switchCommunityView('buddies', { skipHash: false, instant: instant });
    } else {
      switchCommunityView('inspire', { skipHash: false, instant: instant });
    }
  }
}

function clearCommunitySearch() {
  const input = document.getElementById('searchInput');
  if (input) input.value = '';
  applyCommunitySearch({ scroll: false });
  closeMobileSearchNav();
}

function applyCommunitySearch(opts) {
  const scroll = !!(opts && opts.scroll);
  syncSearchScopeUi();
  renderBuddies(activeBuddyFilter());
  renderInspire();

  const key = communitySearchKeyword().trim();
  syncSearchViewForActiveSearch(key, scroll);

  renderSearchResultsBar();

  if (!scroll || !key) return;

  if (communitySearchScope === 'buddies' || communitySearchScope === 'inspire') {
    return;
  }

  const buddyN = buddiesFiltered(activeBuddyFilter()).length;
  const bar = document.getElementById('searchResultsBar');
  if (bar && !bar.hidden) {
    bar.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if (buddyN) {
    ensureBuddiesPageOpen({ scroll: true });
  } else {
    scrollToId('inspire');
  }
}

function getInspireFilterState() {
  return {
    type: document.querySelector('.feed-tab.active')?.dataset.type || '全部',
    keyword: keywordForInspire(),
    city: document.querySelector('#cityTabs .city-tab.active')?.dataset.city || '全部'
  };
}

const INSPIRE_TYPE_META = {
  '全部': '路线与笔记混排展示；同一条社区路线不会重复出现。',
  '路线': '仅展示路线卡片，可按城市筛选。',
  '打卡': '仅展示打卡类笔记。',
  '攻略': '仅展示攻略类笔记。',
  '夜游': '仅展示夜游类笔记。',
  '拍照': '仅展示拍照类笔记。'
};

function syncInspireToolbarMeta(type) {
  const meta = document.getElementById('inspireToolbarMeta');
  if (!meta) return;
  let text = INSPIRE_TYPE_META[type] || INSPIRE_TYPE_META['全部'];
  if (feedViewSavedOnly) text = '当前仅显示本机收藏的笔记。';
  meta.textContent = text;
  meta.hidden = !feedViewSavedOnly && (!type || type === '全部');
}

function syncInspireSectionHead() {
  const head = document.getElementById('inspireSectionHead');
  if (!head) return;
  head.classList.toggle('inspire-section-head--compact', !!communitySearchKeyword().trim());
}

function renderInspire() {
  const state = getInspireFilterState();
  const routesBlock = document.getElementById('inspireRoutesBlock');
  const feedBlock = document.getElementById('inspireFeedBlock');
  const showRoutes = shouldShowInspireRoutes(state.type) && !feedViewSavedOnly;
  const hideFeed = state.type === '路线' && !feedViewSavedOnly;
  if (routesBlock) routesBlock.hidden = !showRoutes;
  if (feedBlock) feedBlock.hidden = hideFeed;
  if (showRoutes) renderRoutes(state.city, state.keyword);
  renderFeed(state.type, state.keyword);
  syncInspireToolbarMeta(state.type);
  syncInspireSectionHead();
  renderSearchResultsBar();
  syncMobileFilterTriggers();
}

function routeCardRibbon(r) {
  if (r._source === 'sample') {
    return '<span class="route-demo-ribbon">示例参考</span>';
  }
  if (r._source === 'ugc') {
    return '<span class="route-demo-ribbon route-ugc-ribbon">社区分享</span>';
  }
  return '';
}

function routeCardOpenHandler(r) {
  if (r._ugcPostId) {
    return `showPostById('${safeText(r._ugcPostId)}')`;
  }
  return `openRouteById('${safeText(r.id)}')`;
}

function renderRouteCardHtml(r) {
  const stops = (r.stops || []).slice(0, 4);
  const mediaInner = `<img src="${r.image || SPOT_PLACEHOLDER}" alt="${safeText(r.title)}" loading="lazy" onerror="wwOnImgError(this)">`;
  return `\
    <article class="route-card" onclick="${routeCardOpenHandler(r)}">\
      <div class="route-media">\
        ${mediaInner}\
        ${routeCardRibbon(r)}\
        <span class="route-badge">${safeText(r.city)} · ${safeText(r.type)}</span>\
        <button class="route-save ${isRouteFavorite(r.id) ? 'liked' : ''}" aria-label="收藏路线" onclick="event.stopPropagation();toggleRouteFavorite('${safeText(r.id)}',this)">${isRouteFavorite(r.id) ? '♥' : '♡'}</button>\
      </div>\
      <div class="route-body">\
        <div class="route-title">${safeText(r.title)}</div>\
        <div class="route-sub">${safeText(r.desc)}</div>\
        <div class="route-stats"><span>📏 ${safeText(r.distance)}</span><span>🕐 ${safeText(r.time)}</span><span>◌ ${safeText(r.level)}</span></div>\
        <div class="node-row">${stops.map(function (s, j) {
    return `<span class="node">${safeText(s)}</span>${j < stops.length - 1 ? '<span class="arrow">→</span>' : ''}`;
  }).join('')}</div>\
        <div class="route-footer">\
          <div class="author"><span class="avatar-initial" aria-hidden="true">${safeText((r.author || '我').slice(0, 1))}</span><span>${safeText(r.author || '我')}</span></div>\
        </div>\
      </div>\
    </article>`;
}

function renderRoutes(city, keyword) {
  if (!routeGrid) return;
  if (typeof city === 'undefined' || city === null) {
    city = document.querySelector('#cityTabs .city-tab.active')?.dataset.city || '全部';
  }
  if (typeof keyword === 'undefined') {
    keyword = document.getElementById('searchInput')?.value || '';
  }
  rebuildRouteCityTabs();
  const data = routesForDiscover(city, keyword);
  if (!data.length) {
    const key = String(keyword || '').trim();
    const msg = key
      ? '没有匹配的路线，试试其他关键词或切换到「全部」。'
      : '暂无路线内容。发布「路线」类笔记后会出现在这里；若示例未加载，请刷新页面。';
    routeGrid.innerHTML = '<div class="empty" style="display:block;grid-column:1/-1">' + msg + '</div>';
    return;
  }
  routeGrid.innerHTML = data.map(renderRouteCardHtml).join('');
  document.querySelectorAll('#cityTabs .city-tab').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.city === city);
  });
}

let currentSpotRouteId = routes[0] ? routes[0].id : '';
let currentSpotItems = (currentSpotRouteId && routeSpots[currentSpotRouteId]) ? routeSpots[currentSpotRouteId].spots : [];
let footprintView = 'walks';
let expandedWalkId = null;
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
function wwOnFeedImgError(el) {
  if (!el || el.dataset.wwImgFallback === '1') return;
  el.dataset.wwImgFallback = '1';
  const wrap = el.closest('.post-media');
  if (wrap) wrap.classList.add('image-fallback');
  const ph = (typeof SAMPLE_IMG !== 'undefined' && SAMPLE_IMG.placeholder) || '';
  if (ph) el.src = ph;
  else wwOnImgError(el);
}

function wwOnImgError(el) {
  if (!el || el.dataset.wwImgFallback === '1') return;
  el.dataset.wwImgFallback = '1';
  el.src = SPOT_PLACEHOLDER;
}
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
  if(typeof CitywalkFootprintSync!=='undefined'&&CitywalkFootprintSync.schedulePush) CitywalkFootprintSync.schedulePush();
}
let plannedRouteCatalog = loadPlannedCatalog();
const POINTS_PER_WALK = 50;
const POINT_LEVELS = [
  {min:0,max:99,icon:'🌱',title:'街巷新芽',desc:'刚刚开始探索城市，把每次出发变成新的发现。'},
  {min:100,max:299,icon:'🚶',title:'巷弄漫游者',desc:'你已经养成出门走走的习惯，城市街角开始熟悉起来。'},
  {min:300,max:699,icon:'🧭',title:'城市寻宝家',desc:'越来越会发现隐藏的小店、街巷和不在攻略里的惊喜。'},
  {min:700,max:1499,icon:'📍',title:'路线收藏家',desc:'你走过的路线正慢慢组成一张属于自己的城市地图。'},
  {min:1500,max:Infinity,icon:'✨',title:'城市漫游家',desc:'资深城市漫游者，总能在熟悉的街区发现新的故事。'}
];

const sampleWalkedRoutes = [];

let ugcPosts = [];
let ugcBuddies = [];
let currentUgcPostId = null;

function rebuildRouteCityTabs() {
  const tabs = document.getElementById('cityTabs');
  if (!tabs) return;
  const pool = getDiscoverRoutes();
  const cities = Array.from(new Set(pool.map(function (r) { return r.city; }).filter(Boolean)));
  const active = tabs.querySelector('.city-tab.active');
  const prevCity = active ? active.dataset.city : '全部';
  const nextCity = prevCity === '全部' || cities.includes(prevCity) ? prevCity : '全部';
  tabs.innerHTML = '<button type="button" class="city-tab' + (nextCity === '全部' ? ' active' : '') + '" data-city="全部">全部城市</button>'
    + cities.map(function (c) {
      return `<button type="button" class="city-tab${nextCity === c ? ' active' : ''}" data-city="${safeText(c)}">${safeText(c)}</button>`;
    }).join('');
}

function openRouteById(routeId) {
  if (String(routeId).indexOf('ugc-') === 0) {
    showPostById(String(routeId).slice(4));
    return;
  }
  const idx = routes.findIndex(function (r) { return r.id === routeId; });
  const r = idx >= 0 ? routes[idx] : routeById(routeId);
  if (r) openRouteDetails(r);
}

function fillPublishRouteSelect(){
  const sel=document.getElementById('publishRouteId');
  if(!sel) return;
  const opts=getImportedRoutes().map(r=>`<option value="${safeText(r.id)}">${safeText(r.title||r.id)}</option>`).join('');
  sel.innerHTML='<option value="">不关联</option>'+opts;
}

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
  if(typeof CitywalkFootprintSync!=='undefined'&&CitywalkFootprintSync.schedulePush){
    if(key===FOOTPRINT_STORAGE.walked||key===FOOTPRINT_STORAGE.favoriteRoutes||key===FOOTPRINT_STORAGE.favoriteSpots||key===POINTS_STORAGE.events){
      CitywalkFootprintSync.schedulePush();
    }
  }
}
function loadNumber(key, fallback=0){
  try{
    const value=Number(localStorage.getItem(key));
    return Number.isFinite(value)&&value>=0?Math.floor(value):fallback;
  }catch(e){return fallback;}
}
function saveNumber(key,value){
  try{localStorage.setItem(key,String(Math.max(0,Math.floor(Number(value)||0))));}catch(e){}
  if(typeof CitywalkFootprintSync!=='undefined'&&CitywalkFootprintSync.schedulePush&&key===POINTS_STORAGE.total){
    CitywalkFootprintSync.schedulePush();
  }
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

function plannedRouteFingerprint(payload) {
  const names = (payload.stops || []).map(function (s) {
    return String((s && s.name) || '').trim();
  }).filter(Boolean).join('|');
  return [String(payload.city || '').trim(), String(payload.title || '').trim(), names].join('::');
}

function fingerprintFromCatalogEntry(entry) {
  if (!entry) return '';
  if (entry.fingerprint) return entry.fingerprint;
  const spots = (entry.routeSpot && entry.routeSpot.spots) || [];
  return plannedRouteFingerprint({ city: entry.city, title: entry.title, stops: spots });
}

function findPlannedIdByFingerprint(fingerprint) {
  if (!fingerprint) return '';
  const ids = Object.keys(plannedRouteCatalog);
  for (let i = 0; i < ids.length; i++) {
    if (fingerprintFromCatalogEntry(plannedRouteCatalog[ids[i]]) === fingerprint) return ids[i];
  }
  return '';
}

function upsertImportedRouteCard(id, fields) {
  const card = {
    id: id,
    city: fields.city || '我的城市',
    type: '规划导入',
    title: fields.title,
    desc: fields.desc || '来自 Citywalk 路线规划',
    image: fields.image || SPOT_PLACEHOLDER,
    distance: fields.distance || '—',
    time: fields.time || '—',
    level: fields.level || '规划',
    likes: '—',
    author: '我',
    avatar: '',
    stops: fields.stops || [],
    tips: ['这条路线来自规划页。走过之后点「记录 Walk」，才会进入走过的路线。']
  };
  const idx = routes.findIndex(function (r) { return r.id === id; });
  if (idx >= 0) routes[idx] = Object.assign({}, routes[idx], card);
  else routes.unshift(card);
}

function hydratePlannedRoutesFromCatalog() {
  const ids = new Set(Object.keys(plannedRouteCatalog));
  for (let i = routes.length - 1; i >= 0; i--) {
    if (routes[i] && routes[i].type === '规划导入' && !ids.has(routes[i].id)) routes.splice(i, 1);
  }
  ids.forEach(function (id) {
    const entry = plannedRouteCatalog[id];
    if (!entry) return;
    if (entry.routeSpot) routeSpots[id] = entry.routeSpot;
    const spots = (entry.routeSpot && entry.routeSpot.spots) || [];
    upsertImportedRouteCard(id, {
      city: entry.city,
      title: entry.title,
      desc: entry.desc,
      image: entry.image,
      distance: entry.distance,
      time: entry.time,
      level: entry.level,
      stops: spots.map(function (s) { return s.name; })
    });
  });
}

function registerPlannedRoute(payload) {
  if (!payload || !Array.isArray(payload.stops) || !payload.stops.length) return null;
  const fingerprint = plannedRouteFingerprint(payload);
  let id = String(payload.id || '');
  if (!plannedRouteCatalog[id]) {
    const matched = findPlannedIdByFingerprint(fingerprint);
    if (matched) id = matched;
    else if (!id) id = 'cw-import-' + Date.now().toString(36);
  }
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
  const prev = plannedRouteCatalog[id];
  routeSpots[id] = routeSpot;
  plannedRouteCatalog[id] = {
    id: id,
    eventId: (prev && prev.eventId) ? prev.eventId : String(payload.eventId || payload.id || id),
    fingerprint: fingerprint,
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
  upsertImportedRouteCard(id, {
    city: payload.city || '我的城市',
    title: routeSpot.title,
    desc: '来自 Citywalk 路线规划',
    distance: distKm || '—',
    time: timeLabel,
    stops: spots.map(function (s) { return s.name; })
  });
  if (footprintView === 'planned' && typeof renderFootprints === 'function') renderFootprints();
  return id;
}

function removePlannedRoute(routeId) {
  const id = String(routeId || '');
  if (!id || !plannedRouteCatalog[id]) return;
  if (!confirm('从「规划导入」移除这条路线？规划页分享链接仍可再次导入。')) return;
  delete plannedRouteCatalog[id];
  savePlannedCatalog();
  delete routeSpots[id];
  if (plannerLinkedRouteId === id) plannerLinkedRouteId = null;
  hydratePlannedRoutesFromCatalog();
  fillPublishRouteSelect();
  if (typeof renderInspire === 'function') renderInspire();
  renderFootprints();
  showToast('已从规划导入移除');
}

hydratePlannedRoutesFromCatalog();

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

function setMePrimaryTab(tab, rerender) {
  mePrimaryTab = tab || 'saved';
  document.querySelectorAll('.me-primary-tab').forEach(function (btn) {
    const on = (btn.dataset.meTab || '') === mePrimaryTab;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  const saved = document.getElementById('mePanelSaved');
  const pub = document.getElementById('mePanelPublished');
  const settings = document.getElementById('mePanelSettings');
  if (saved) saved.hidden = mePrimaryTab !== 'saved';
  if (pub) pub.hidden = mePrimaryTab !== 'published';
  if (settings) settings.hidden = mePrimaryTab !== 'settings';
  if (rerender !== false) renderMePage();
}

function setMeSavedTab(tab, rerender) {
  meSavedTab = tab || 'notes';
  document.querySelectorAll('.me-saved-tab').forEach(function (btn) {
    const on = (btn.dataset.meSaved || '') === meSavedTab;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  if (rerender !== false) renderMeSavedPanel();
}

const COMMUNITY_VIEW_IDS = ['home', 'buddies', 'inspire', 'spots'];
let communityViewId = 'home';

function syncCommunityNavActive(view) {
  document.querySelectorAll('[data-community-nav]').forEach(function (a) {
    const id = a.getAttribute('data-community-nav') || '';
    const on = id === view;
    if (a.classList.contains('buddy-nav')) {
      a.classList.toggle('buddy-nav-open', on);
      a.classList.toggle('active', on);
      if (!a.dataset.defaultLabel) a.dataset.defaultLabel = a.textContent.trim() || '👥 找搭子';
      a.textContent = on ? '👥 找搭子' : a.dataset.defaultLabel;
    } else {
      a.classList.toggle('active', on);
    }
  });
}

function syncCommunityTabbarActive(view) {
  document.querySelectorAll('.community-tabbar-btn[data-community-view]').forEach(function (btn) {
    const on = (btn.dataset.communityView || '') === view;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-current', on ? 'page' : 'false');
  });
}

function closeMeView() {
  document.body.classList.remove('community-view-me');
  const meEl = document.getElementById('me');
  if (meEl) {
    meEl.hidden = true;
    meEl.setAttribute('aria-hidden', 'true');
  }
}

function syncSearchNavToggleUi() {
  const btn = document.getElementById('searchNavToggle');
  if (!btn) return;
  const open = document.body.classList.contains('search-nav-open');
  btn.textContent = open ? '×' : '⌕';
  btn.setAttribute('aria-label', open ? '关闭搜索' : '打开搜索');
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function closeMobileSearchNav() {
  if (!document.body.classList.contains('search-nav-open')) return;
  document.body.classList.remove('search-nav-open');
  syncSearchNavToggleUi();
}

function syncCommunityComposeUi(view) {
  const navBtn = document.getElementById('navComposeBtn');
  const fab = document.getElementById('communityFab');
  const onMe = document.body.classList.contains('community-view-me');
  const v = view || communityViewId || 'home';
  if (onMe || v === 'home' || v === 'spots') {
    if (navBtn) navBtn.hidden = true;
    if (fab) {
      fab.hidden = true;
      fab.classList.remove('community-fab--extended');
    }
    return;
  }
  if (v === 'buddies') {
    if (navBtn) {
      navBtn.hidden = false;
      navBtn.textContent = '＋ 发起 Walk';
    }
    if (fab) {
      fab.hidden = false;
      fab.textContent = '＋ 发起 Walk';
      fab.setAttribute('aria-label', '发起 Walk');
      fab.classList.add('community-fab--extended');
    }
    return;
  }
  if (v === 'inspire') {
    if (navBtn) {
      navBtn.hidden = false;
      navBtn.textContent = '＋ 发布';
    }
    if (fab) {
      fab.hidden = false;
      fab.textContent = '＋ 发布';
      fab.setAttribute('aria-label', '发布笔记');
      fab.classList.add('community-fab--extended');
    }
  }
}

function triggerCommunityComposeAction() {
  const v = communityViewId || 'home';
  if (v === 'buddies') openCreateBuddy();
  else if (v === 'inspire') openPublish();
}

function switchCommunityView(view, opts) {
  opts = opts || {};
  if (view === 'me') {
    openMePage(opts);
    return;
  }
  if (!(opts && opts.keepSearchOpen)) closeMobileSearchNav();
  if (!COMMUNITY_VIEW_IDS.includes(view)) view = 'home';
  communityViewId = view;
  closeMeView();
  document.body.setAttribute('data-community-view', view);

  const buddies = document.getElementById('buddies');
  if (buddies && view === 'buddies') {
    buddies.classList.remove('buddy-section-hidden');
    buddies.classList.add('buddy-section-visible');
    renderBuddies(activeBuddyFilter());
  }
  if (view === 'inspire') renderInspire();
  if (view === 'spots') renderFootprints();

  syncCommunityNavActive(view);
  syncCommunityTabbarActive(view);
  setHeroPrimaryBuddyLabel(view === 'buddies');
  syncCommunityComposeUi(view);

  window.scrollTo({ top: 0, behavior: opts.instant ? 'auto' : 'smooth' });
  if (!opts.skipHash && typeof history !== 'undefined' && history.replaceState) {
    try { history.replaceState(null, '', '#' + view); } catch (e) { /* file:// */ }
  }
}

function openMePage(opts) {
  opts = opts || {};
  closeMobileSearchNav();
  if (opts.tab) setMePrimaryTab(opts.tab, false);
  if (opts.saved) setMeSavedTab(opts.saved, false);
  closeMeView();
  document.body.removeAttribute('data-community-view');
  document.body.classList.add('community-view-me');
  const meEl = document.getElementById('me');
  if (meEl) {
    meEl.hidden = false;
    meEl.setAttribute('aria-hidden', 'false');
  }
  renderMePage();
  syncCommunityNavActive('');
  syncCommunityTabbarActive('');
  syncCommunityComposeUi('');
  window.scrollTo({ top: 0, behavior: opts.instant ? 'auto' : 'smooth' });
  if (!opts.skipHash && typeof history !== 'undefined' && history.replaceState) {
    try { history.replaceState(null, '', '#me'); } catch (e) { /* file:// etc. */ }
  }
}

function closeMePage(targetHash) {
  const raw = targetHash || '#home';
  const view = raw.replace(/^#/, '') || 'home';
  switchCommunityView(COMMUNITY_VIEW_IDS.includes(view) ? view : 'home');
}

function syncCommunityViewFromHash() {
  const hash = (typeof location !== 'undefined' && location.hash) || '';
  const id = hash.replace(/^#/, '') || 'home';
  if (id === 'me') {
    openMePage({ skipHash: true, instant: true });
    return;
  }
  switchCommunityView(COMMUNITY_VIEW_IDS.includes(id) ? id : 'home', { skipHash: true, instant: true });
}

function bindCommunityRouter() {
  document.querySelectorAll('[data-community-nav]').forEach(function (a) {
    a.addEventListener('click', function (ev) {
      const view = a.getAttribute('data-community-nav');
      if (!view || !COMMUNITY_VIEW_IDS.includes(view)) return;
      ev.preventDefault();
      switchCommunityView(view);
    });
  });
  document.querySelectorAll('.community-tabbar-btn[data-community-view]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      switchCommunityView(btn.dataset.communityView || 'home');
    });
  });
  const navComposeBtn = document.getElementById('navComposeBtn');
  const communityFab = document.getElementById('communityFab');
  if (navComposeBtn) navComposeBtn.addEventListener('click', triggerCommunityComposeAction);
  if (communityFab) communityFab.addEventListener('click', triggerCommunityComposeAction);
}

function updateUserAvatarPopover() {
  const pop = document.getElementById('userAvatarPopover');
  const btn = document.getElementById('cwAuthAvatarBtn');
  if (!pop || !btn) return;
  const loggedIn = typeof CitywalkAuth !== 'undefined' && CitywalkAuth.isLoggedIn();
  const email = loggedIn && CitywalkAuth.loadCachedUser
    ? (CitywalkAuth.loadCachedUser().email || '')
    : '';
  const level = getPointsLevel(typeof totalWalkPoints !== 'undefined' ? totalWalkPoints : 0);
  const savedBrief = feedSavedIds.size + ' 笔记 · ' + buddySavedIds.size + ' 招募 · ' + favoriteRouteIds.length + ' 路线';
  if (loggedIn) {
    pop.innerHTML = '<strong>' + safeText(email || '已登录') + '</strong>'
      + '<span>' + safeText(level.level.icon + ' ' + level.level.title) + '</span>'
      + '<span>收藏 ' + safeText(savedBrief) + '</span>'
      + '<span class="user-avatar-popover-cta">点击进入个人中心</span>';
    btn.setAttribute('aria-label', '个人中心：' + (email || '已登录'));
  } else {
    pop.innerHTML = '<strong>未登录</strong>'
      + '<span>收藏与发布暂存本浏览器</span>'
      + '<span class="user-avatar-popover-cta">点击查看账号与收藏</span>';
    btn.setAttribute('aria-label', '个人中心（未登录）');
  }
  btn.title = '';
}

if (typeof window !== 'undefined') {
  window.openMePage = openMePage;
  window.closeMePage = closeMePage;
  window.switchCommunityView = switchCommunityView;
}

function postsAuthoredByMe() {
  return feedPostsSource().filter(function (p) {
    return p.is_mine && !p.is_demo;
  });
}

function buddiesAuthoredByMe() {
  return ugcBuddies.filter(function (b) {
    return b.is_mine && !b.is_demo;
  });
}

function renderMeOverview() {
  const el = document.getElementById('meOverview');
  if (!el) return;
  const level = getPointsLevel(typeof totalWalkPoints !== 'undefined' ? totalWalkPoints : 0);
  const loggedIn = typeof CitywalkAuth !== 'undefined' && CitywalkAuth.isLoggedIn();
  const email = loggedIn && CitywalkAuth.loadCachedUser ? (CitywalkAuth.loadCachedUser().email || '') : '';
  el.innerHTML = '<div class="me-overview-card">'
    + '<div><span class="me-overview-label">漫游称号</span><strong>' + safeText(level.level.icon + ' ' + level.level.title) + '</strong></div>'
    + '<div><span class="me-overview-label">收藏</span><strong>' + feedSavedIds.size + ' 笔记 · ' + buddySavedIds.size + ' 招募 · ' + favoriteRouteIds.length + ' 路线</strong></div>'
    + '<div><span class="me-overview-label">账号</span><strong>' + safeText(loggedIn ? (email || '已登录') : '未登录') + '</strong></div>'
    + '</div>';
}

function renderMeSavedPanel() {
  const grid = document.getElementById('meSavedGrid');
  const empty = document.getElementById('meSavedEmpty');
  const hint = document.getElementById('meSavedHint');
  if (!grid) return;
  let html = '';
  let emptyMsg = '';
  if (hint) {
    hint.textContent = (meSavedTab === 'notes' || meSavedTab === 'buddies')
      ? '以下收藏保存在本浏览器；登录后足迹中的路线/点位收藏可云同步。'
      : '与「足迹 · 收藏」相同数据，在此统一查看。';
  }
  if (meSavedTab === 'notes') {
    const posts = [...feedSavedIds].map(findCommunityPost).filter(Boolean);
    html = posts.length ? posts.map(postCardHtml).join('') : '';
    emptyMsg = posts.length ? '' : '还没有收藏的笔记。在灵感区卡片上点 ☆ 即可收藏。';
    grid.className = 'me-saved-grid feed-grid';
  } else if (meSavedTab === 'buddies') {
    const list = [...buddySavedIds].map(function (id) { return findBuddy(id); }).filter(Boolean);
    html = list.length ? list.map(function (b) {
      const saved = isBuddySaved(b.id);
      return '<article class="me-buddy-row"><div><strong>' + safeText(b.city) + ' · ' + safeText(b.title) + '</strong><span>' + safeText(b.date) + '</span></div>'
        + '<div class="me-row-actions"><button type="button" class="me-row-btn" onclick="openJoin(\'' + safeText(b.id) + '\')">查看</button>'
        + '<button type="button" class="me-row-btn" onclick="toggleBuddySaved(\'' + safeText(b.id) + '\',null)">取消收藏</button></div></article>';
    }).join('') : '';
    emptyMsg = list.length ? '' : '还没有收藏的招募。在找搭子卡片上点 ☆ 即可收藏。';
    grid.className = 'me-saved-grid me-list-grid';
  } else if (meSavedTab === 'routes') {
    const list = favoriteRouteIds.map(routeById).filter(Boolean);
    html = list.map(function (r) {
      return '<article class="me-row-card"><img src="' + safeText(r.image || SPOT_PLACEHOLDER) + '" alt=""><div><strong>' + safeText(r.title) + '</strong><span>' + safeText(r.city) + '</span></div>'
        + '<div class="me-row-actions"><button type="button" class="me-row-btn" onclick="openRouteById(\'' + safeText(r.id) + '\')">详情</button>'
        + '<button type="button" class="me-row-btn" onclick="setFootprintView(\'routes\');scrollToId(\'spots\')">在足迹中</button></div></article>';
    }).join('');
    emptyMsg = list.length ? '' : '还没有收藏路线。在灵感区路线卡上点 ♡ 收藏。';
    grid.className = 'me-saved-grid me-list-grid';
  } else {
    const list = favoriteSpotKeys.map(routeForSpotKey).filter(Boolean);
    html = list.map(function (item) {
      return '<article class="me-row-card"><img src="' + safeText(item.spot.image || SPOT_PLACEHOLDER) + '" alt=""><div><strong>' + safeText(item.spot.name) + '</strong><span>' + safeText(item.route?.city || '') + '</span></div>'
        + '<div class="me-row-actions"><button type="button" class="me-row-btn" onclick="renderSpots(\'' + safeText(item.routeId) + '\',true);setTimeout(function(){showSpot(' + item.index + ');},350)">查看</button>'
        + '<button type="button" class="me-row-btn" onclick="toggleSpotFavorite(\'' + safeText(item.routeId) + '\',' + item.index + ')">取消收藏</button></div></article>';
    }).join('');
    emptyMsg = list.length ? '' : '还没有收藏打卡点。在路线点位页点 ♡ 收藏。';
    grid.className = 'me-saved-grid me-list-grid';
  }
  grid.innerHTML = html;
  if (meSavedTab === 'notes') bindFeedCardEvents();
  if (empty) {
    empty.hidden = !!html;
    empty.textContent = emptyMsg;
  }
}

function renderMePublishedPanel() {
  const postsEl = document.getElementById('mePublishedPosts');
  const postsEmpty = document.getElementById('mePublishedPostsEmpty');
  const budEl = document.getElementById('mePublishedBuddies');
  const budEmpty = document.getElementById('mePublishedBuddiesEmpty');
  const loggedIn = typeof CitywalkAuth !== 'undefined' && CitywalkAuth.isLoggedIn();
  if (!loggedIn) {
    if (postsEl) postsEl.innerHTML = '';
    if (budEl) budEl.innerHTML = '';
    const msg = '登录后可查看与管理你发布的帖子与招募。';
    if (postsEmpty) { postsEmpty.hidden = false; postsEmpty.textContent = msg; }
    if (budEmpty) { budEmpty.hidden = false; budEmpty.textContent = msg; }
    return;
  }
  const myPosts = postsAuthoredByMe();
  const myBuds = buddiesAuthoredByMe();
  if (postsEl) {
    postsEl.innerHTML = myPosts.length ? myPosts.map(function (p) {
      return '<article class="me-publish-row"><div><strong>' + safeText(p.title) + '</strong><span>' + safeText(p.type) + ' · ' + safeText(p.city) + '</span></div>'
        + '<div class="me-row-actions"><button type="button" class="me-row-btn" onclick="showPostById(\'' + safeText(p.id) + '\')">打开</button>'
        + '<button type="button" class="me-row-btn danger" onclick="deletePostById(\'' + safeText(p.id) + '\')">删除</button></div></article>';
    }).join('') : '';
    postsEl.className = 'me-saved-grid me-list-grid';
  }
  if (postsEmpty) {
    postsEmpty.hidden = !!myPosts.length;
    postsEmpty.textContent = myPosts.length ? '' : '你还没有发布笔记。在灵感区点「＋ 发布」。';
  }
  if (budEl) {
    budEl.innerHTML = myBuds.length ? myBuds.map(function (b) {
      return '<article class="me-buddy-row"><div><strong>' + safeText(b.title) + '</strong><span>' + safeText(b.city) + ' · ' + safeText(b.date) + '</span></div>'
        + '<button type="button" class="me-row-btn" onclick="openJoin(\'' + safeText(b.id) + '\')">查看招募</button></article>';
    }).join('') : '';
  }
  if (budEmpty) {
    budEmpty.hidden = !!myBuds.length;
    budEmpty.textContent = myBuds.length ? '' : '你还没有发起招募。在找搭子区点「＋ 发起 Walk」。';
  }
}

function renderMeSettingsPanel() {
  const status = document.getElementById('meAuthStatus');
  const openAuth = document.getElementById('meOpenAuthBtn');
  const openAcct = document.getElementById('meOpenAccountBtn');
  const loggedIn = typeof CitywalkAuth !== 'undefined' && CitywalkAuth.isLoggedIn();
  const email = loggedIn && typeof CitywalkAuth.loadCachedUser === 'function' ? (CitywalkAuth.loadCachedUser().email || '') : '';
  if (status) {
    status.textContent = loggedIn
      ? '当前账号：' + (email || '已登录') + '。足迹与路线/点位收藏会同步到云端。'
      : '未登录。可先在本浏览器收藏笔记与招募；登录后足迹与部分收藏可云同步。';
  }
  if (openAuth) openAuth.hidden = !!loggedIn;
  if (openAcct) openAcct.hidden = !loggedIn;
}

function renderMePage() {
  renderMeOverview();
  if (mePrimaryTab === 'saved') renderMeSavedPanel();
  else if (mePrimaryTab === 'published') renderMePublishedPanel();
  else renderMeSettingsPanel();
  updateUserAvatarPopover();
}

async function deletePostById(postId) {
  if (!postId || !requireLoginForPost()) return;
  if (!confirm('确定删除这条笔记？')) return;
  try {
    await CitywalkCommunityApi.deletePost(postId);
    showToast('已删除');
    feedSavedIds.delete(String(postId));
    persistFeedSavedIds();
    syncFeedSavedCounts();
    await loadCommunityUgc();
  } catch (e) {
    showToast(e.message || '删除失败');
  }
}

function syncPlannedImportBar(){
  const bar=document.getElementById('plannedImportBar');
  if(!bar) return;
  bar.hidden=footprintView!=='planned';
}

function setFootprintView(view){
  footprintView=view;
  document.querySelectorAll('.footprint-tab').forEach(btn=>btn.classList.toggle('active',btn.dataset.view===view));
  syncPlannedImportBar();
  renderFootprints();
}

function renderFootprints(){
  syncPlannedImportBar();
  spotMode='archive';
  document.getElementById('footprintArchivePanel').style.display='block';
  document.getElementById('routeSpotPanel').style.display='none';
  document.getElementById('footprintHeading').textContent='我的 Walk 足迹';
  const syncHint=document.getElementById('footprintSyncHint');
  if(syncHint&&!syncHint.textContent) syncHint.textContent='登录后足迹与收藏会保存到账号；未登录时仍只在本浏览器。';
  document.getElementById('footprintTabs').style.display='flex';
  document.getElementById('footprintSummary').style.display='grid';
  document.getElementById('footprintHeadActions').style.display='flex';

  const validWalked=walkedRoutes.filter(item=>routeById(item.routeId));
  const validFavRoutes=favoriteRouteIds.filter(id=>routeById(id));
  const plannedRoutes=getImportedRoutes();
  const spotFavCount=favoriteSpotKeys.filter(k=>routeForSpotKey(k)).length;
  const cityCount=new Set(validWalked.map(item=>routeById(item.routeId)?.city).filter(Boolean)).size;
  const summaryStats=[
    {view:'walks',count:validWalked.length,label:'已走过'},
    {view:'planned',count:plannedRoutes.length,label:'规划导入'},
    {view:'routes',count:validFavRoutes.length,label:'收藏路线'},
    {view:'spots',count:spotFavCount,label:'收藏点位',sub:cityCount+' 城'}
  ];
  document.getElementById('footprintSummary').innerHTML=summaryStats.map(function (s) {
    return '<button type="button" class="footprint-stat'+(footprintView===s.view?' is-active':'')+'" data-footprint-stat="'+s.view+'" onclick="setFootprintView(\''+s.view+'\')">'
      +'<strong>'+s.count+'</strong><span>'+safeText(s.label)+'</span>'
      +(s.sub?'<span class="footprint-stat-sub">'+safeText(s.sub)+'</span>':'')
      +'</button>';
  }).join('');

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
    empty.textContent='还没有记录过的路线。完成一次 Citywalk 后，点「记录一次 Walk」，把路线与沿途点位留在这里。';
  }else if(footprintView==='planned'){
    items=plannedRoutes;
    html=items.map(function (r) {
      const spotCount = (routeSpots[r.id]?.spots || []).length;
      return `<article class="footprint-card">
      <div class="footprint-cover"><img src="${r.image || SPOT_PLACEHOLDER}" alt="${safeText(r.title)}"><span class="footprint-cover-badge">📋 规划导入 · ${safeText(r.city)}</span></div>
      <div class="footprint-card-body"><div class="footprint-card-title">${safeText(r.title)}</div><div class="footprint-card-desc">${safeText(r.desc)}</div><div class="footprint-meta"><span>📏 ${safeText(r.distance)}</span><span>🕐 ${safeText(r.time)}</span><span>📍 ${spotCount} 个点位</span></div></div>
      <div class="footprint-card-actions footprint-card-actions--planned"><button class="primary" onclick="renderSpots('${safeText(r.id)}',true)">查看点位</button><button class="primary" onclick="openRouteById('${safeText(r.id)}')">路线详情</button><button class="primary" onclick="openAddFootprintPrefilled('${safeText(r.id)}')">记录 Walk</button><button class="remove" type="button" onclick="removePlannedRoute('${safeText(r.id)}')">删除</button></div>
    </article>`;
    }).join('');
    empty.innerHTML='还没有规划导入的路线。在 <a href="../">Citywalk 路线规划</a> 完成后点「记录到社区」，或在上方粘贴分享链接（地址里带 <code>?r=</code>）。走过之后再点「记录 Walk」。';
  }else if(footprintView==='routes'){
    items=validFavRoutes.map(id=>routeById(id)).filter(Boolean);
    html=items.map(r=>`<article class="footprint-card">
      <div class="footprint-cover"><img src="${r.image}" alt="${safeText(r.title)}"><span class="footprint-cover-badge">♡ 已收藏 · ${safeText(r.city)}</span></div>
      <div class="footprint-card-body"><div class="footprint-card-title">${safeText(r.title)}</div><div class="footprint-card-desc">${safeText(r.desc)}</div><div class="footprint-meta"><span>📏 ${r.distance}</span><span>🕐 ${r.time}</span><span>📍 ${routeSpots[r.id]?.spots.length||0} 个点位</span></div><div class="footprint-stops-preview">${(routeSpots[r.id]?.spots||[]).slice(0,3).map(sp=>`<span>${safeText(sp.name)}</span>`).join('')}</div></div>
      <div class="footprint-card-actions"><button class="primary" onclick="renderSpots('${r.id}',true)">查看路线点位 →</button><button class="remove" onclick="toggleRouteFavorite('${r.id}')">取消收藏</button></div>
    </article>`).join('');
    empty.textContent='这里还没有收藏的路线。在发现区或路线详情中点击 ♡ 即可收藏。';
  }else{
    items=favoriteSpotKeys.map(routeForSpotKey).filter(Boolean);
    html=items.map(item=>`<article class="footprint-card">
      <div class="footprint-cover"><img src="${item.spot.image}" alt="${safeText(item.spot.name)}"><span class="footprint-cover-badge">♡ 已收藏 · ${safeText(item.route?.city||'Citywalk')}</span></div>
      <div class="footprint-card-body"><div class="footprint-card-title">${safeText(item.spot.name)}</div><div class="footprint-card-desc">${safeText(item.spot.desc)}</div><div class="footprint-meta"><span>📍 ${safeText(item.spot.type)}</span><span>${safeText(item.route?.city||'Citywalk')}</span></div><div class="footprint-card-note">来自路线：${safeText(item.data.title)}</div></div>
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
  spotList.innerHTML=routeSpotData.spots.map((sp,i)=>`<div class="spot-item" onclick="showSpot(${i})"><img class="spot-thumb" src="${sp.image||SPOT_PLACEHOLDER}" alt="" onerror="wwOnImgError(this)"><div class="spot-item-copy"><h4>${safeText(sp.name)}</h4><p>${safeText(sp.desc)}</p><div class="spot-meta">${safeText(sp.type)} · ${safeText(sp.meta)}</div></div><button class="spot-save-button ${isSpotFavorite(routeId,i)?'saved':''}" onclick="event.stopPropagation();toggleSpotFavorite('${routeId}',${i})">${isSpotFavorite(routeId,i)?'♥ 已收藏':'♡ 收藏'}</button></div>`).join('');
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
  renderInspire();
  renderMePage();
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
  renderMePage();
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

if (typeof window !== 'undefined') {
  window.removePlannedRoute = removePlannedRoute;
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
  const wrap=document.getElementById('footprintPointsWrap');
  const hasActivity=points>0||(Array.isArray(completionEvents)&&completionEvents.length>0);
  if(wrap) wrap.hidden=!hasActivity;
  const fold=document.getElementById('footprintPointsFold');
  if(fold) fold.hidden=!hasActivity;
  const foldSummary=document.getElementById('pointsFoldSummary');
  if(foldSummary) foldSummary.textContent=points.toLocaleString('zh-CN')+' 分 · '+current.level.title;

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
  const fingerprint = plannedRouteFingerprint(payload);
  const existed = !!(payload.id && plannedRouteCatalog[payload.id]) || !!findPlannedIdByFingerprint(fingerprint);
  const routeId = registerPlannedRoute(payload);
  if(!routeId) return null;
  plannerLinkedRouteId = routeId;
  setFootprintView('planned');
  const spots=document.getElementById('spots');
  if(spots && typeof spots.scrollIntoView==='function'){
    spots.scrollIntoView({behavior:'smooth',block:'start'});
  }
  if(options.awardPoints === true){
    handleWalkCompletion({ routeId, eventId: payload.eventId || ('import-' + routeId), completedAt: payload.savedAt || new Date().toISOString() });
  } else if(options.openFootprintForm === true){
    openAddFootprintPrefilled(routeId);
  }
  resetImportGuideDismiss();
  showImportGuideBanner();
  showToast(existed ? '这条路线已在规划导入中，已更新' : '已放入规划导入。走过之后再点「记录 Walk」');
  return routeId;
}

function importPlannedRouteFromSession(options={}){
  const consume = window.CitywalkBridge && window.CitywalkBridge.consumePendingRoute;
  const payload = normalizePendingPayload(consume ? consume() : null);
  if(!payload) return null;
  return applyImportedPlannerPayload(payload, options);
}

function payloadFromSharedRouteSnapshot(snapshot, shareId){
  if(!snapshot || !snapshot.result || !snapshot.result.success) return null;
  const result=snapshot.result;
  const pois=Array.isArray(result.pois)?result.pois:[];
  const act=Number(result.activity_total_min)||Number(result.duration)||0;
  const distM=Number(result.distance)||0;
  const routeId='cw-share-'+String(shareId||Date.now().toString(36));
  const title=(snapshot.plan_params && snapshot.start && snapshot.end)
    ? ((snapshot.start.address||'起点')+' → '+(snapshot.end.address||'终点'))
    : (snapshot.city ? (snapshot.city+' · 分享路线') : '分享路线');
  return {
    id:routeId,
    city:snapshot.city||'',
    title:title.slice(0,48),
    meta:(snapshot.city||'')+(distM?(' · '+(distM/1000).toFixed(2)+' km'):'')+(act?(' · 约 '+act+' 分钟'):''),
    distanceM:distM,
    durationActivityMin:act,
    stops:pois.map(function(p,i){
      return {
        name:p.name||('站点 '+(i+1)),
        type:p.poi_type||p.type||'打卡',
        meta:p.stay_time?('约 '+p.stay_time+' 分钟'):'',
        desc:p.recommendation_reason||'来自分享链接'
      };
    }),
    savedAt:new Date().toISOString(),
    eventId:'share-'+routeId
  };
}

const SHARE_ROUTE_ID_RE = /^[A-Za-z0-9_-]{6,24}$/;

function parseShareImportInput(raw){
  const text = String(raw || '').trim();
  if (!text) return { error: 'empty' };
  const hasLong = /(?:^|[?&#])cw=1(?:&|$)|#cwshare=/.test(text);
  let id = '';
  if (/^https?:\/\//i.test(text) || text.indexOf('?') >= 0 || text.indexOf('#') >= 0) {
    try {
      const url = new URL(text, window.location.origin);
      id = url.searchParams.get('r') || '';
      if (!id && /cwshare=/.test(url.hash || '')) return { error: 'long' };
    } catch (e) {
      id = '';
    }
  }
  if (!id && SHARE_ROUTE_ID_RE.test(text)) id = text;
  if (!id && /^r=/i.test(text)) {
    const bare = text.slice(2);
    if (SHARE_ROUTE_ID_RE.test(bare)) id = bare;
  }
  if (id && SHARE_ROUTE_ID_RE.test(id)) return { id: id };
  if (hasLong) return { error: 'long' };
  return { error: 'bad' };
}

function submitPlannedLinkImport(event){
  if (event && event.preventDefault) event.preventDefault();
  const input = document.getElementById('plannedImportInput');
  const parsed = parseShareImportInput(input ? input.value : '');
  if (parsed.error === 'empty') {
    showToast('请粘贴分享链接或 id');
    return false;
  }
  if (parsed.error === 'long') {
    showToast('请使用规划页「复制链接」得到的短链（地址里带 ?r=）');
    return false;
  }
  if (!parsed.id) {
    showToast('无法识别分享 id');
    return false;
  }
  importSharedRouteById(parsed.id, { openFootprintForm: false, awardPoints: false }).then(function (routeId) {
    if (routeId && input) input.value = '';
  });
  return false;
}

async function importSharedRouteById(shareId, options={}){
  if(!shareId) return null;
  const apiBase=(window.CitywalkAuth&&CitywalkAuth.CW_API)
    ||((location.hostname==='localhost'||location.hostname==='127.0.0.1')
      ?'http://localhost:5000/api/citywalk'
      :'https://noomings-backend.zeabur.app/api/citywalk');
  try{
    showToast('正在载入分享的路线…');
    const res=await fetch(apiBase+'/routes/share/'+encodeURIComponent(shareId));
    const body=await res.json().catch(()=>({}));
    if(!res.ok||!body.success||!body.snapshot){
      showToast(body.message||'分享链接无效或已过期');
      return null;
    }
    const payload=payloadFromSharedRouteSnapshot(body.snapshot, shareId);
    if(!payload||!payload.stops.length){
      showToast('分享路线没有可展示的站点');
      return null;
    }
    return applyImportedPlannerPayload(payload, Object.assign({ awardPoints:false, openFootprintForm:false }, options));
  }catch(e){
    console.warn('importSharedRouteById',e);
    showToast('无法加载分享路线');
    return null;
  }
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
      applyImportedPlannerPayload(normalized, { awardPoints: false, openFootprintForm: false });
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
  importSharedRouteById,
  registerPlannedRoute,
  parseShareImportInput,
  submitPlannedLinkImport
};

function postCoverUrl(p){
  if(!p) return (typeof SAMPLE_IMG !== 'undefined' && SAMPLE_IMG.placeholder) || '';
  const img=p.image||'';
  if(img) return img;
  if(typeof FEED_TYPE_IMG !== 'undefined' && p.type && FEED_TYPE_IMG[p.type]) return FEED_TYPE_IMG[p.type];
  return (typeof SAMPLE_IMG !== 'undefined' && SAMPLE_IMG.placeholder)
    || (window.CitywalkCommunityApi && CitywalkCommunityApi.PLACEHOLDER_POST_IMAGE)
    || '';
}

function renderPostCoverHtml(p){
  const src=postCoverUrl(p);
  if(!src){
    return `<div class="post-cover post-cover-demo" data-type="${safeText(p.type||'笔记')}" role="img"><span class="post-cover-demo-kicker">WanderWalk</span><span class="post-cover-demo-type">${safeText(p.type||'笔记')}</span></div>`;
  }
  return `<img class="post-cover" src="${src}" alt="${safeText(p.title)}" loading="lazy" onerror="wwOnFeedImgError(this)">`;
}

function setModalCoverVisual(opts){
  const img=document.getElementById('modalCover');
  const demo=document.getElementById('modalCoverDemo');
  if(!img) return;
  if(demo) demo.hidden=true;
  img.hidden=false;
  img.src=(opts && opts.src) || SPOT_PLACEHOLDER;
}

function findCommunityPost(id) {
  const hit = ugcPosts.find(function (x) { return x.id === id; });
  if (hit) return hit;
  if (typeof demoPosts !== 'undefined' && Array.isArray(demoPosts)) {
    return demoPosts.find(function (x) { return x.id === id; }) || null;
  }
  return null;
}

function feedPostsSource() {
  if (ugcPosts.length) return ugcPosts;
  return typeof demoPosts !== 'undefined' ? demoPosts : [];
}

function loadFeedSavedIds() {
  try {
    const raw = JSON.parse(localStorage.getItem(FEED_SAVED_STORAGE_KEY) || '[]');
    return new Set(Array.isArray(raw) ? raw.map(String) : []);
  } catch (e) {
    return new Set();
  }
}

function persistFeedSavedIds() {
  try {
    localStorage.setItem(FEED_SAVED_STORAGE_KEY, JSON.stringify([...feedSavedIds]));
  } catch (e) { /* private mode */ }
}

function isPostSaved(postId) {
  return feedSavedIds.has(String(postId));
}

function syncFeedSavedCounts() {
  const n = feedSavedIds.size;
  const countEl = document.getElementById('feedSavedCount');
  if (countEl) countEl.textContent = String(n);
  const toggle = document.getElementById('feedSavedToggle');
  if (toggle) toggle.setAttribute('aria-pressed', feedViewSavedOnly ? 'true' : 'false');
}

function togglePostSaved(postId) {
  const id = String(postId);
  if (feedSavedIds.has(id)) feedSavedIds.delete(id);
  else feedSavedIds.add(id);
  persistFeedSavedIds();
  syncFeedSavedCounts();
  renderMePage();
  return feedSavedIds.has(id);
}

function loadBuddySavedIds() {
  try {
    const raw = JSON.parse(localStorage.getItem(BUDDY_SAVED_STORAGE_KEY) || '[]');
    return new Set(Array.isArray(raw) ? raw.map(String) : []);
  } catch (e) {
    return new Set();
  }
}

function persistBuddySavedIds() {
  try {
    localStorage.setItem(BUDDY_SAVED_STORAGE_KEY, JSON.stringify([...buddySavedIds]));
  } catch (e) { /* ignore */ }
}

function isBuddySaved(buddyId) {
  return buddyId && buddySavedIds.has(String(buddyId));
}

function toggleBuddySaved(buddyId, btn) {
  if (!buddyId) return false;
  const id = String(buddyId);
  if (buddySavedIds.has(id)) buddySavedIds.delete(id);
  else buddySavedIds.add(id);
  persistBuddySavedIds();
  if (btn) {
    const on = buddySavedIds.has(id);
    btn.classList.toggle('saved', on);
    btn.textContent = on ? '★' : '☆';
    btn.setAttribute('aria-label', on ? '取消收藏招募' : '收藏招募');
  }
  showToast(buddySavedIds.has(id) ? '已收藏这条招募（本浏览器）' : '已取消收藏');
  if (activeBuddyFilter() === '收藏') renderBuddies('收藏');
  renderMePage();
  return buddySavedIds.has(id);
}

function postFeedMetaItems(p) {
  const items = [];
  if (p.city) items.push('📍 ' + p.city);
  if (p.type === '路线') items.push('⌁ 路线分享');
  if (p.type === '打卡') items.push('☕ 打卡');
  if (p.type === '攻略') items.push('▧ 攻略');
  if (p.route_id) items.push('关联路线');
  if (p.share_route_id) items.push('分享链');
  return items.slice(0, 3);
}

function renderPostMediaBlock(p) {
  const src = postCoverUrl(p);
  const demo = p.is_demo ? '<span class="post-cover-demo-badge">示例笔记</span>' : '';
  const coverInner = src
    ? `<img class="post-cover" src="${safeText(src)}" alt="${safeText(p.title)}" loading="lazy" onerror="wwOnFeedImgError(this)">`
    : `<div class="post-cover post-cover-demo" data-type="${safeText(p.type || '笔记')}" role="img"><span class="post-cover-demo-kicker">WanderWalk</span><span class="post-cover-demo-type">${safeText(p.type || '笔记')}</span></div>`;
  return `<div class="post-media">${coverInner}${demo}<span class="post-cover-label">${safeText(p.type || '笔记')}</span><span class="post-cover-city">${safeText(p.city || 'Citywalk')}</span></div>`;
}

function postCardHtml(p) {
  const tags = Array.isArray(p.tags) ? p.tags : [];
  const meta = postFeedMetaItems(p);
  const saved = isPostSaved(p.id);
  const pid = safeText(String(p.id));
  return `<article class="post" data-post-id="${pid}" tabindex="0" role="button" aria-label="打开笔记：${safeText(p.title)}">\
    ${renderPostMediaBlock(p)}\
    <div class="post-body">\
      <div class="post-author-row"><span class="avatar-initial" aria-hidden="true">${safeText((p.author || '?').slice(0, 1))}</span><span>${safeText(p.author)}</span><span class="post-time">${p.is_demo ? '示例' : 'Walk 分享'}</span></div>\
      <h3 class="post-title">${safeText(p.title)}</h3>\
      <p class="post-desc">${safeText(p.desc || '')}</p>\
      ${meta.length ? `<div class="post-meta">${meta.map(x => `<span class="post-meta-item">${safeText(x)}</span>`).join('')}</div>` : ''}\
      <div class="tags">${tags.map(t => `<span class="tag">#${safeText(String(t).replace(/^#/, ''))}</span>`).join('')}</div>\
    </div>\
    <div class="post-footer">\
      <div class="post-actions">\
        <button type="button" class="clickable post-like-btn${p.liked_by_me ? ' liked' : ''}" data-like-id="${pid}">${p.liked_by_me ? '♥' : '♡'} ${Number(p.like_count) || 0}</button>\
      </div>\
      <button type="button" class="post-save-btn${saved ? ' saved' : ''}" data-save-id="${pid}" aria-label="${saved ? '取消收藏' : '收藏'}">${saved ? '★' : '☆'}</button>\
    </div>\
  </article>`;
}

function bindFeedCardEvents() {
  if (!feedGrid) return;
  feedGrid.querySelectorAll('.post[data-post-id]').forEach(function (card) {
    const id = card.dataset.postId;
    card.onclick = function (e) {
      if (e.target.closest('[data-like-id],[data-save-id]')) return;
      showPostById(id);
    };
    card.onkeydown = function (e) {
      if ((e.key === 'Enter' || e.key === ' ') && e.target === card) {
        e.preventDefault();
        showPostById(id);
      }
    };
  });
  feedGrid.querySelectorAll('[data-like-id]').forEach(function (btn) {
    btn.onclick = function (e) {
      e.stopPropagation();
      toggleLikePost(btn.dataset.likeId, btn);
    };
  });
  feedGrid.querySelectorAll('[data-save-id]').forEach(function (btn) {
    btn.onclick = function (e) {
      e.stopPropagation();
      const nowSaved = togglePostSaved(btn.dataset.saveId);
      btn.classList.toggle('saved', nowSaved);
      btn.textContent = nowSaved ? '★' : '☆';
      btn.setAttribute('aria-label', nowSaved ? '取消收藏' : '收藏');
      showToast(nowSaved ? '已收藏这条笔记（本浏览器）' : '已取消收藏');
      if (feedViewSavedOnly) renderInspire();
    };
  });
}

function syncFeedTabs(type) {
  document.querySelectorAll('.feed-tab').forEach(function (b) {
    const on = (b.dataset.type || '') === type;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
}

function setFeedTypeFilter(type) {
  syncFeedTabs(type);
  feedVisibleCount = 8;
  renderInspire();
}

function collectFeedTagCounts() {
  const counts = new Map();
  feedPostsSource().forEach(function (p) {
    (Array.isArray(p.tags) ? p.tags : []).forEach(function (t) {
      const key = String(t).replace(/^#/, '').trim();
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
  });
  return [...counts.entries()].sort(function (a, b) { return b[1] - a[1]; }).slice(0, 8);
}

function renderFeedHotTags() {
  const holder = document.getElementById('feedHotTagsList');
  if (!holder) return;
  const top = collectFeedTagCounts();
  if (!top.length) {
    holder.innerHTML = '<span class="feed-side-note">发布带标签的笔记后，这里会显示常见话题。</span>';
    return;
  }
  holder.innerHTML = top.map(function (pair) {
    return `<button type="button" class="feed-hot-tag" data-feed-tag="${safeText(pair[0])}"># ${safeText(pair[0])} <small>(${pair[1]})</small></button>`;
  }).join('');
  holder.querySelectorAll('[data-feed-tag]').forEach(function (btn) {
    btn.onclick = function () {
      const input = document.getElementById('searchInput');
      if (input) input.value = btn.dataset.feedTag || '';
      renderInspire();
      scrollToId('inspire');
    };
  });
}

function renderFeedMixed(keyword) {
  const key = String(keyword).trim().toLowerCase();
  const source = feedPostsSource();
  const items = buildInspireMixedHtmlList(keyword);
  const total = items.length;
  const slice = items.slice(0, feedVisibleCount);
  feedGrid.classList.add('feed-grid--mixed');
  feedGrid.innerHTML = slice.length ? slice.join('') : '';
  bindFeedCardEvents();
  syncFeedSavedCounts();
  if (feedEmpty) {
    if (!total) {
      feedEmpty.hidden = false;
      if (source.length || getDiscoverRoutes().length) {
        feedEmpty.innerHTML = '<strong>没有匹配的内容</strong><p style="margin-top:8px;font-size:12px;color:#888">试试其他关键词，或切换到「路线」按城市浏览。</p>';
      } else {
        feedEmpty.innerHTML = '<strong>还没有灵感内容</strong><p style="margin-top:8px;font-size:12px;color:#888">登录后点「＋ 发布」，做第一个分享吧。</p>';
      }
    } else {
      feedEmpty.hidden = true;
    }
  }
  const loadBtn = document.getElementById('feedLoadMore');
  if (loadBtn) {
    loadBtn.hidden = total <= feedVisibleCount;
    loadBtn.textContent = total > feedVisibleCount ? '再加载一些 ↓' : '已浏览全部';
  }
  if (!feedViewSavedOnly) syncFeedTabs('全部');
}

function renderFeed(type='全部',keyword=''){
  if (!feedGrid) return;
  if (useInspireMixedFeed(type)) {
    renderFeedMixed(keyword);
    return;
  }
  feedGrid.classList.remove('feed-grid--mixed');
  const key=String(keyword).trim().toLowerCase();
  const source = feedPostsSource();
  let data=filterFeedPosts(type, keyword);
  const sortEl=document.getElementById('feedSort');
  const sortMode=sortEl?sortEl.value:'default';
  if(sortMode==='newest'){
    data=[...data].reverse();
  }
  const total=data.length;
  const slice=data.slice(0,feedVisibleCount);
  feedGrid.innerHTML=slice.length?slice.map(postCardHtml).join(''):'';
  bindFeedCardEvents();
  syncFeedSavedCounts();
  if(feedEmpty){
    if(!total){
      feedEmpty.hidden=false;
      if(feedViewSavedOnly){
        feedEmpty.innerHTML='<strong>还没有收藏笔记</strong><p style="margin-top:8px;font-size:12px;color:#888">在卡片上点 ☆，把喜欢的分享收进清单。</p><button type="button" class="feed-load-more" style="margin-top:14px" id="feedExitSaved">返回全部笔记</button>';
        const exit=document.getElementById('feedExitSaved');
        if(exit) exit.onclick=function(){feedViewSavedOnly=false;syncFeedSavedCounts();renderInspire();};
      }else if(type==='路线'&&!feedViewSavedOnly){
        feedEmpty.innerHTML='<strong>路线请在上方卡片区浏览</strong><p style="margin-top:8px;font-size:12px;color:#888">笔记流不重复展示路线；切回「全部」可看打卡与攻略。</p>';
      }else if(source.length){
        feedEmpty.innerHTML='<strong>没有找到相关内容</strong><p style="margin-top:8px;font-size:12px;color:#888">换个关键词或类型试试。</p>';
      }else{
        feedEmpty.innerHTML='<strong>还没有笔记</strong><p style="margin-top:8px;font-size:12px;color:#888">登录后点「＋ 发布」，做第一个分享吧。</p>';
      }
    }else{
      feedEmpty.hidden=true;
    }
  }
  const loadBtn=document.getElementById('feedLoadMore');
  if(loadBtn){
    loadBtn.hidden=total<=feedVisibleCount;
    loadBtn.textContent=total>feedVisibleCount?'再加载一些 ↓':'已浏览全部';
  }
  if(!feedViewSavedOnly) syncFeedTabs(type);
}

function buddyCoverUrl(b) {
  if (!b) return '';
  if (b.image) return b.image;
  if (typeof CITY_COVER !== 'undefined' && b.city && CITY_COVER[b.city]) return CITY_COVER[b.city];
  return (typeof COVER_IMG !== 'undefined' && COVER_IMG.placeholder) || '';
}

function parseBuddyPeople(people) {
  const m = String(people || '').match(/(\d+)\s*\/\s*(\d+)/);
  if (!m) return null;
  const current = parseInt(m[1], 10);
  const max = parseInt(m[2], 10);
  if (!max || max < 1) return null;
  return { current: Math.min(current, max), max: max };
}

function renderBuddies(filter='全部'){
  const data=buddiesFiltered(filter);
  const key=keywordForBuddies().trim().toLowerCase();
  if(!buddyGrid) return;
  buddyGrid.innerHTML=data.length?data.map((b)=>{
    const cover=buddyCoverUrl(b);
    const demoRibbon=b.is_demo?'<span class="buddy-demo-ribbon">示例招募</span>':'';
    const seats=parseBuddyPeople(b.people);
    const seatBar=seats
      ? `<div class="buddy-seats" aria-label="已报名 ${seats.current} 人，共 ${seats.max} 人"><div class="buddy-seats-bar"><span style="width:${Math.round((seats.current/seats.max)*100)}%"></span></div><span class="buddy-seats-label">${safeText(b.people)}</span></div>`
      : '';
    const mood=b.filter && b.filter!=='全部'?`<span class="buddy-mood">${safeText(b.filter)}</span>`:'';
    return `<article class="buddy-card${b.is_demo?' buddy-card--demo':''}">\
    <div class="buddy-media">\
      <img src="${safeText(cover)}" alt="" loading="lazy" onerror="wwOnImgError(this)">\
      ${demoRibbon}\
      <span class="buddy-status"><span class="buddy-status-dot" aria-hidden="true"></span>正在招募</span>\
      <span class="buddy-city-pill">${safeText(b.city)}</span>\
      <button type="button" class="buddy-save-btn${isBuddySaved(b.id)?' saved':''}" aria-label="${isBuddySaved(b.id)?'取消收藏招募':'收藏招募'}" onclick="event.stopPropagation();toggleBuddySaved('${safeText(b.id||'')}',this)">${isBuddySaved(b.id)?'★':'☆'}</button>\
    </div>\
    <div class="buddy-body">\
      <div class="buddy-head">\
        <span class="avatar-initial buddy-avatar" aria-hidden="true">${safeText((b.user||'?').slice(0,1))}</span>\
        <div class="buddy-head-text"><strong class="buddy-user-name">${safeText(b.user)}</strong>${mood}</div>\
      </div>\
      <h4 class="buddy-title">${safeText(b.title)}</h4>\
      <p class="buddy-desc">${safeText(b.desc)}</p>\
      <div class="buddy-meta">\
        <span class="buddy-meta-item"><span class="buddy-meta-icon" aria-hidden="true">🕐</span>${safeText(b.date)}</span>\
        ${seats?'':`<span class="buddy-meta-item"><span class="buddy-meta-icon" aria-hidden="true">👥</span>${safeText(b.people)}</span>`}\
      </div>\
      ${seatBar}\
      <div class="buddy-tags">${(b.tags||[]).map(t=>`<span class="buddy-tag">#${safeText(t)}</span>`).join('')}</div>\
      <button class="buddy-join" type="button" onclick="openJoin('${safeText(b.id||'')}')">加入这次 Walk</button>\
    </div>\
  </article>`;
  }).join(''):filter==='收藏'
    ?'<p class="empty" style="display:block;grid-column:1/-1"><strong>还没有收藏的招募</strong><br><span style="font-size:12px;color:#888">在卡片右上角点 ☆，或在「我的 · 收藏」查看。</span></p>'
    :key
    ?'<p class="empty" style="display:block;grid-column:1/-1"><strong>没有匹配的招募</strong><br><span style="font-size:12px;color:#888">换关键词，或把范围切到「全部 / 灵感」。</span></p>'
    :'<p class="empty" style="display:block;grid-column:1/-1">暂无招募，登录后发起一次 Walk 吧。</p>';
  syncMobileFilterTriggers();
}

let currentRouteId = null;

function openRoute(index) {
  openRouteDetails(routes[index]);
}

function openRouteDetails(r) {
  if (!r) return;
  currentUgcPostId = null;
  setPostModalMode(false);
  currentRouteId = r.id;
  currentSpotIndex = null;
  const sample = isSampleRoute(r);
  document.getElementById('spotFavoriteBtn').style.display = 'none';
  const hasSpots = !!(routeSpots[r.id] && routeSpots[r.id].spots && routeSpots[r.id].spots.length);
  document.getElementById('spotJumpBtn').style.display = hasSpots ? '' : 'none';
  document.getElementById('routeFavoriteModalBtn').style.display = '';
  document.getElementById('routeFavoriteModalBtn').textContent = isRouteFavorite(r.id) ? '♥ 已收藏路线' : '♡ 收藏这条路线';
  setModalCoverVisual({ src: r.image || SPOT_PLACEHOLDER });
  const kickerExtra = sample ? ' · 示例参考' : (r._source === 'ugc' ? ' · 社区分享' : '');
  document.getElementById('modalKicker').textContent = `${r.city} · ${r.type} · ${r.author}${kickerExtra}`;
  document.getElementById('modalTitle').textContent = r.title;
  let lead = r.desc || '';
  if (sample) {
    lead = lead + (lead ? ' ' : '') + WW_COPY.sampleRouteNote;
  }
  document.getElementById('modalLead').textContent = lead;
  const statParts = [`📏 ${r.distance}`, `🕐 ${r.time}`, `◌ ${r.level}`];
  if (!sample && r.likes && r.likes !== '—') statParts.push(`♥ ${r.likes}`);
  document.getElementById('modalStats').innerHTML = statParts.map(function (x) {
    return `<span class="modal-stat">${x}</span>`;
  }).join('');
  document.getElementById('modalStops').innerHTML = (r.stops || []).map(function (s) {
    return `<li>${safeText(s)}</li>`;
  }).join('');
  document.getElementById('modalTips').innerHTML = (r.tips || []).map(function (s) {
    return `<li>${safeText(s)}</li>`;
  }).join('');
  if (hasSpots) {
    document.getElementById('spotJumpBtn').textContent = `📍 查看「${routeSpots[r.id].title || r.city + '路线'}」的打卡点`;
  }
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
  setModalCoverVisual({ src: s.image || SPOT_PLACEHOLDER });
  document.getElementById('modalKicker').textContent=`${routeSpots[currentSpotRouteId]?.meta.split(' · ')[0] || WW_COPY.activity} · ${s.type} · 沿途打卡点`;
  document.getElementById('modalTitle').textContent=s.name;
  document.getElementById('modalLead').textContent=s.desc;
  document.getElementById('modalStats').innerHTML=[`📍 ${s.type}`,`🕐 ${s.meta}`,`✦ 适合 ${WW_COPY.activity}`].map(x=>`<span class="modal-stat">${x}</span>`).join('');
  document.getElementById('modalStops').innerHTML=[s.meta,s.desc,`来自「${routeSpots[currentSpotRouteId]?.title || '当前路线'}」`].map(x=>`<li>${x}</li>`).join('');
  document.getElementById('modalTips').innerHTML=WW_COPY.modalTipsRoute.map(x=>`<li>${x}</li>`).join('');
  currentRouteId=currentSpotRouteId;
  document.getElementById('spotJumpBtn').textContent=`📍 查看「${routeSpots[currentSpotRouteId]?.title || '当前路线'}」的完整打卡点`;
  showModal('routeModal');
}

function setPostModalMode(on){
  const postBar=document.getElementById('postUgcActions');
  const routeBar=document.getElementById('routeModalActions');
  if(postBar) postBar.hidden=!on;
  if(routeBar) routeBar.hidden=!!on;
  const saveBtn=document.getElementById('postSaveBtn');
  if(saveBtn) saveBtn.hidden=!on;
}

function showPostById(id){
  const p=findCommunityPost(id);
  if(!p) return;
  activeDetailPostId=id;
  currentUgcPostId=p.is_demo?null:id;
  currentSpotIndex=null;
  setPostModalMode(true);
  document.getElementById('spotFavoriteBtn').style.display='none';
  document.getElementById('spotJumpBtn').style.display='none';
  document.getElementById('routeFavoriteModalBtn').style.display='none';
  setModalCoverVisual({ src: postCoverUrl(p) });
  const kickerDemo=p.is_demo?' · 示例笔记':'';
  document.getElementById('modalKicker').textContent=`${p.city} · ${p.type} · ${p.author}${kickerDemo}`;
  document.getElementById('modalTitle').textContent=p.title;
  document.getElementById('modalLead').textContent=p.is_demo
    ?(p.desc+(p.desc?' ':'')+WW_COPY.samplePostNote)
    :p.desc;
  const tags=Array.isArray(p.tags)?p.tags:[];
  const linkBits=[];
  if(p.route_id) linkBits.push('关联路线');
  if(p.share_route_id) linkBits.push('分享链');
  document.getElementById('modalStats').innerHTML=[`${p.liked_by_me?'♥':'♡'} ${Number(p.like_count)||0}`,`📍 ${p.city}`,...linkBits,...tags.map(t=>'#'+t)].map(x=>`<span class="modal-stat">${safeText(x)}</span>`).join('');
  document.getElementById('modalStops').innerHTML=[p.desc].map(x=>`<li>${safeText(x)}</li>`).join('');
  document.getElementById('modalTips').innerHTML=WW_COPY.modalTipsPost.map(x=>`<li>${x}</li>`).join('');
  const likeBtn=document.getElementById('postLikeBtn');
  if(likeBtn){
    likeBtn.textContent=(p.liked_by_me?'♥ ':'♡ ')+'点赞 · '+(Number(p.like_count)||0);
    likeBtn.classList.toggle('liked',!!p.liked_by_me);
  }
  const delBtn=document.getElementById('postDeleteBtn');
  if(delBtn) delBtn.hidden=!p.is_mine;
  const shareA=document.getElementById('postOpenShareLink');
  if(shareA){
    if(p.share_route_id){
      shareA.hidden=false;
      shareA.href='../?r='+encodeURIComponent(p.share_route_id);
    }else{
      shareA.hidden=true;
    }
  }
  const saveBtn=document.getElementById('postSaveBtn');
  if(saveBtn){
    const saved=isPostSaved(p.id);
    saveBtn.hidden=false;
    saveBtn.classList.toggle('active',saved);
    saveBtn.textContent=(saved?'★ ':'☆ ')+'收藏';
  }
  if(p.is_demo){
    if(likeBtn) likeBtn.hidden=true;
    if(delBtn) delBtn.hidden=true;
    const reportBtn=document.getElementById('postReportBtn');
    if(reportBtn) reportBtn.hidden=true;
    if(shareA) shareA.hidden=true;
    const routeBar=document.getElementById('routeModalActions');
    if(routeBar) routeBar.hidden=true;
  }else{
    if(likeBtn) likeBtn.hidden=false;
    const reportBtn=document.getElementById('postReportBtn');
    if(reportBtn) reportBtn.hidden=false;
    const routeBar=document.getElementById('routeModalActions');
    if(routeBar) routeBar.hidden=true;
  }
  showModal('routeModal');
}

function toggleSaveCurrentPost(){
  const id=activeDetailPostId||currentUgcPostId;
  const p=id?findCommunityPost(id):null;
  if(!p) return;
  const nowSaved=togglePostSaved(p.id);
  const saveBtn=document.getElementById('postSaveBtn');
  if(saveBtn){
    saveBtn.classList.toggle('active',nowSaved);
    saveBtn.textContent=(nowSaved?'★ ':'☆ ')+'收藏';
  }
  showToast(nowSaved?'已收藏这条笔记（本浏览器）':'已取消收藏');
  renderInspire();
}

async function toggleLikePost(postId,btn){
  const demo=findCommunityPost(postId);
  if(demo&&demo.is_demo){
    showToast('示例笔记仅供浏览');
    return;
  }
  if(!requireLoginForPost()) return;
  try{
    const updated=await CitywalkCommunityApi.likePost(postId);
    const idx=ugcPosts.findIndex(x=>x.id===postId);
    if(idx>=0) ugcPosts[idx]=updated;
    if(btn){
      btn.classList.toggle('liked',!!updated.liked_by_me);
      btn.textContent=(updated.liked_by_me?'♥':'♡')+' '+(Number(updated.like_count)||0);
    }
    if(currentUgcPostId===postId){
      const likeBtn=document.getElementById('postLikeBtn');
      if(likeBtn){
        likeBtn.textContent=(updated.liked_by_me?'♥ ':'♡ ')+'点赞 · '+(Number(updated.like_count)||0);
        likeBtn.classList.toggle('liked',!!updated.liked_by_me);
      }
    }
  }catch(e){
    showToast(e.message||'点赞失败');
  }
}

function toggleLikeCurrentPost(){
  if(currentUgcPostId) toggleLikePost(currentUgcPostId,document.getElementById('postLikeBtn'));
}

async function deleteCurrentPost(){
  if(!currentUgcPostId||!requireLoginForPost()) return;
  if(!confirm('确定删除这条笔记？')) return;
  try{
    await CitywalkCommunityApi.deletePost(currentUgcPostId);
    closeModal('routeModal');
    showToast('已删除');
    currentUgcPostId=null;
    await loadCommunityUgc();
  }catch(e){
    showToast(e.message||'删除失败');
  }
}

async function reportCurrentPost(){
  if(!currentUgcPostId||!requireLoginForPost()) return;
  const reason=prompt('请简要说明举报原因（可选）')||'';
  try{
    const res=await CitywalkCommunityApi.reportPost(currentUgcPostId,reason);
    showToast(res.message||'已收到举报');
  }catch(e){
    showToast(e.message||'举报失败');
  }
}

function setBuddyModalMode(mode){
  const joinPane=document.getElementById('buddyJoinPane');
  const createPane=document.getElementById('buddyCreatePane');
  if(joinPane) joinPane.hidden=mode!=='join';
  if(createPane) createPane.hidden=mode!=='create';
}

function openJoin(buddyId){
  if(!buddyId){ showToast('该招募无法加入'); return; }
  const b=findBuddy(buddyId);
  if(!b){ showToast('招募不存在或已下线'); return; }
  setBuddyModalMode('join');
  document.getElementById('buddyModalTitle').textContent=b.is_demo?'示例招募':'加入这次 Walk';
  document.getElementById('buddyModalDesc').textContent=b.is_demo
    ? WW_COPY.sampleBuddyNote
    : ('加入 ' + b.user + ' 发起的同行计划。');
  document.getElementById('buddyPreview').innerHTML=`<strong>${safeText(b.title)}</strong><div style="font-size:12px;color:#666;line-height:1.8">📍 ${safeText(b.city)}<br>🕐 ${safeText(b.date)}<br>👥 ${safeText(b.people)}<br>🏷️ ${(b.tags||[]).map(x=>'#'+safeText(x)).join(' ')}<br><br>${safeText(b.desc)}</div>`;
  const confirmBtn=document.getElementById('buddyConfirm');
  if(b.is_demo){
    confirmBtn.textContent='知道了';
    confirmBtn.onclick=function(){ closeModal('buddyModal'); };
    showModal('buddyModal');
    return;
  }
  if(!requireLoginForPost()) return;
  confirmBtn.textContent='确认加入';
  confirmBtn.onclick=async()=>{
    try{
      await CitywalkCommunityApi.joinBuddy(buddyId);
      closeModal('buddyModal');
      showToast('已加入，祝你们 Walk 愉快');
      await loadCommunityUgc();
    }catch(e){
      showToast(e.message||'加入失败');
    }
  };
  showModal('buddyModal');
}

function openCreateBuddy(){
  if(!requireLoginForPost()) return;
  setBuddyModalMode('create');
  showModal('buddyModal');
}

function syncPublishTagsHiddenField(){
  const hidden=document.getElementById('publishTags');
  if(hidden) hidden.value=publishSelectedTags.join(',');
}

function renderPublishSelectedTags(){
  const holder=document.getElementById('publishSelectedTags');
  if(!holder) return;
  holder.innerHTML=publishSelectedTags.map(function(t,i){
    return `<span class="selected-tag"># ${safeText(t)} <button type="button" data-remove-publish-tag="${i}" aria-label="删除标签">×</button></span>`;
  }).join('');
  holder.querySelectorAll('[data-remove-publish-tag]').forEach(function(btn){
    btn.onclick=function(){
      publishSelectedTags.splice(+btn.dataset.removePublishTag,1);
      renderPublishSelectedTags();
      syncPublishTagsHiddenField();
      refreshPublishTagSuggestions();
    };
  });
  syncPublishTagsHiddenField();
}

function addPublishTag(raw){
  const t=String(raw||'').trim().replace(/^#+/,'').replace(/[,，\s]+$/,'').slice(0,24);
  if(!t) return false;
  if(publishSelectedTags.some(function(x){return x.toLowerCase()===t.toLowerCase();})){
    showToast('该标签已添加');
    return false;
  }
  if(publishSelectedTags.length>=10){
    showToast('最多 10 个标签');
    return false;
  }
  publishSelectedTags.push(t);
  renderPublishSelectedTags();
  refreshPublishTagSuggestions();
  return true;
}

function refreshPublishTagSuggestions(){
  const box=document.getElementById('publishTagSuggestions');
  if(!box) return;
  const open=document.getElementById('publishModal')?.classList.contains('show');
  if(!open){ box.hidden=true; return; }
  const query=(document.getElementById('publishTagsInput')||{}).value||'';
  const q=query.trim().replace(/^#+/,'').toLowerCase();
  const ctx=[q,(document.getElementById('publishTitle')||{}).value||'',(document.getElementById('publishDesc')||{}).value||'',(document.getElementById('publishCity')||{}).value||'',(document.getElementById('publishType')||{}).value||''].join(' ').toLowerCase();
  const ranked=FEED_TAG_SUGGESTIONS.map(function(t){
    let score=0;
    if(q&&t.name.toLowerCase().includes(q)) score+=80;
    t.keys.forEach(function(k){
      if(k&&ctx.includes(k.toLowerCase())) score+=6;
    });
    return {name:t.name,score:score};
  }).filter(function(t){
    return !publishSelectedTags.some(function(x){return x.toLowerCase()===t.name.toLowerCase();});
  }).sort(function(a,b){return b.score-a.score;}).slice(0,6);
  let html='';
  ranked.forEach(function(t){
    html+=`<button type="button" class="tag-suggestion" data-add-publish-tag="${safeText(t.name)}">＋ #${safeText(t.name)}</button>`;
  });
  if(q&&!publishSelectedTags.some(function(x){return x.toLowerCase()===q;})){
    html+=`<button type="button" class="tag-suggestion" data-add-publish-tag="${safeText(q)}">＋ 创建 #${safeText(q)}</button>`;
  }
  if(!html){ box.hidden=true; return; }
  box.innerHTML=html;
  box.hidden=false;
  box.querySelectorAll('[data-add-publish-tag]').forEach(function(btn){
    btn.onclick=function(){ addPublishTag(btn.dataset.addPublishTag); const inp=document.getElementById('publishTagsInput'); if(inp) inp.value=''; };
  });
}

function updatePublishTypeHint(){
  const type=(document.getElementById('publishType')||{}).value||'路线';
  const hint=document.getElementById('publishTypeHint');
  if(!hint) return;
  const map={
    '路线':'写清起终点、计划时长与沿途 2–3 个亮点，方便他人复走。',
    '打卡':'分享店名/街区、人均或招牌，并注明适合停留的时段。',
    '攻略':'补充预约、装备、交通规则等实用信息，比堆景点名更有帮助。',
    '夜游':'说明光线时段、安全与返程方式，摄影向可提机位方向。',
    '拍照':'标注大致位置与侧光/蓝调时段，给后来的人留一点探索空间。'
  };
  hint.textContent=map[type]||'用真实体验帮助同路人。';
}

function updatePublishCharCounts(){
  const title=(document.getElementById('publishTitle')||{}).value||'';
  const desc=(document.getElementById('publishDesc')||{}).value||'';
  const tc=document.getElementById('publishTitleCount');
  const dc=document.getElementById('publishDescCount');
  if(tc) tc.textContent=title.length+' / 80';
  if(dc) dc.textContent=desc.length+' / 2000';
}

function resetPublishComposer(presetType){
  publishSelectedTags=[];
  const form=document.getElementById('publishPostForm');
  if(form) form.reset();
  const typeEl=document.getElementById('publishType');
  if(typeEl&&presetType) typeEl.value=presetType;
  renderPublishSelectedTags();
  updatePublishTypeHint();
  updatePublishCharCounts();
  refreshPublishTagSuggestions();
}

function openPublish(presetType){
  if(!requireLoginForPost()) return;
  fillPublishRouteSelect();
  resetPublishComposer(presetType||'');
  showModal('publishModal');
}

async function submitPublishPostForm(ev){
  if(ev) ev.preventDefault();
  if(!requireLoginForPost()) return;
  const pending=(document.getElementById('publishTagsInput')||{}).value||'';
  if(pending.trim()) addPublishTag(pending);
  const tags=[...publishSelectedTags];
  try{
    await CitywalkCommunityApi.createPost({
      type:(document.getElementById('publishType')||{}).value,
      city:(document.getElementById('publishCity')||{}).value,
      title:(document.getElementById('publishTitle')||{}).value,
      desc:(document.getElementById('publishDesc')||{}).value,
      image_url:(document.getElementById('publishImage')||{}).value,
      tags:tags,
      route_id:(document.getElementById('publishRouteId')||{}).value||'',
      share_route_id:(document.getElementById('publishShareRouteId')||{}).value||'',
    });
    closeModal('publishModal');
    resetPublishComposer('');
    showToast('已发布');
    await loadCommunityUgc();
  }catch(e){
    showToast(e.message||'发布失败');
  }
}

async function submitBuddyCreateForm(ev){
  if(ev) ev.preventDefault();
  if(!requireLoginForPost()) return;
  const tagsRaw=(document.getElementById('buddyCreateTags')||{}).value||'';
  const tags=tagsRaw.split(/[,，]/).map(s=>s.trim()).filter(Boolean);
  try{
    await CitywalkCommunityApi.createBuddy({
      city:(document.getElementById('buddyCreateCity')||{}).value,
      title:(document.getElementById('buddyCreateTitle')||{}).value,
      desc:(document.getElementById('buddyCreateDesc')||{}).value,
      date:(document.getElementById('buddyCreateDate')||{}).value,
      filter:(document.getElementById('buddyCreateFilter')||{}).value,
      slots_max:(document.getElementById('buddyCreateMax')||{}).value,
      tags:tags,
    });
    closeModal('buddyModal');
    showToast('招募已发布');
    await loadCommunityUgc();
    ensureBuddiesPageOpen({ scroll: true });
  }catch(e){
    showToast(e.message||'发起失败');
  }
}
function showModal(id){document.getElementById(id).classList.add('show');document.body.style.overflow='hidden'}
function closeModal(id){document.getElementById(id).classList.remove('show');document.body.style.overflow=''}

/** 供搜索、结果跳转等：切到找搭子视图 */
function ensureBuddiesPageOpen(options) {
  switchCommunityView('buddies', { skipHash: false, instant: !(options && options.scroll) });
}

function openBuddiesPage(event) {
  if (event) event.preventDefault();
  switchCommunityView('buddies');
}

function toggleBuddiesPage(event) {
  if (event) { event.preventDefault(); event.stopPropagation(); }
  if (communityViewId === 'buddies') switchCommunityView('home');
  else switchCommunityView('buddies');
}

function closeBuddiesPage() {
  switchCommunityView('inspire');
}

function setHeroPrimaryBuddyLabel(isOpen){
  const heroBtn=document.querySelector('.hero-btn.primary');
  if(!heroBtn) return;
  const label=heroBtn.querySelector('.hero-btn-label');
  const icon=heroBtn.querySelector('.hero-btn-icon');
  if(label) label.textContent=isOpen?'返回首页':'找搭子同行';
  if(icon) icon.textContent=isOpen?'↕':'👥';
}

function updateBuddyToggle(isOpen) {
  setHeroPrimaryBuddyLabel(isOpen);
  syncCommunityNavActive(isOpen ? 'buddies' : communityViewId);
}

const MOBILE_LAYOUT_MQ=typeof window!=='undefined'&&window.matchMedia?window.matchMedia('(max-width: 760px)'):null;
function isMobileLayout(){return MOBILE_LAYOUT_MQ?MOBILE_LAYOUT_MQ.matches:false}

function initMobileLayoutDefaults() {
  /* 视图由 switchCommunityView 控制，不再折叠搭子区块 */
}

function syncMobileFilterTriggers(){
  const buddyBtn=document.getElementById('buddyFilterTrigger');
  if(buddyBtn) buddyBtn.textContent='筛选 · '+(activeBuddyFilter()||'全部');
  const typeBtn=document.getElementById('inspireTypeTrigger');
  const type=document.querySelector('.feed-tab.active')?.dataset.type||'全部';
  if(typeBtn) typeBtn.textContent='类型 · '+type;
}

function closeMobileFilterSheet(){
  const sheet=document.getElementById('mobileFilterSheet');
  if(!sheet) return;
  sheet.hidden=true;
  sheet.setAttribute('aria-hidden','true');
  if(document.body.style.overflow==='hidden'&&!document.querySelector('.modal.show')) document.body.style.overflow='';
}

function openMobileFilterSheet(mode){
  const sheet=document.getElementById('mobileFilterSheet');
  const bodyEl=document.getElementById('mobileSheetBody');
  const titleEl=document.getElementById('mobileSheetTitle');
  if(!sheet||!bodyEl||!titleEl) return;
  bodyEl.innerHTML='';
  if(mode==='buddy'){
    titleEl.textContent='找搭子筛选';
    document.querySelectorAll('#buddyFilters .buddy-filter').forEach(function(btn){
      const chip=document.createElement('button');
      chip.type='button';
      chip.className='mobile-sheet-chip'+(btn.classList.contains('active')?' active':'');
      chip.textContent=btn.textContent;
      chip.dataset.filter=btn.dataset.filter||'';
      chip.addEventListener('click',function(){
        document.querySelectorAll('.buddy-filter').forEach(function(b){
          b.classList.toggle('active',b.dataset.filter===chip.dataset.filter);
        });
        renderBuddies(chip.dataset.filter||'全部');
        syncMobileFilterTriggers();
        closeMobileFilterSheet();
      });
      bodyEl.appendChild(chip);
    });
  }else if(mode==='inspire-type'){
    titleEl.textContent='笔记类型';
    document.querySelectorAll('#feedTabs .feed-tab').forEach(function(btn){
      const chip=document.createElement('button');
      chip.type='button';
      chip.className='mobile-sheet-chip'+(btn.classList.contains('active')?' active':'');
      chip.textContent=btn.textContent;
      chip.dataset.type=btn.dataset.type||'全部';
      chip.addEventListener('click',function(){
        feedViewSavedOnly=false;
        feedVisibleCount=8;
        setFeedTypeFilter(chip.dataset.type||'全部');
        syncMobileFilterTriggers();
        closeMobileFilterSheet();
      });
      bodyEl.appendChild(chip);
    });
  }
  sheet.hidden=false;
  sheet.setAttribute('aria-hidden','false');
  document.body.style.overflow='hidden';
}

function bindMobileDensityUi(){
  const searchToggle=document.getElementById('searchNavToggle');
  const searchInput=document.getElementById('searchInput');
  syncSearchNavToggleUi();
  if(searchToggle){
    searchToggle.addEventListener('click',function(){
      if(document.body.classList.contains('community-view-me')) return;
      const open=!document.body.classList.contains('search-nav-open');
      document.body.classList.toggle('search-nav-open',open);
      syncSearchNavToggleUi();
      if(open){
        if(communityViewId==='home'&&typeof switchCommunityView==='function'){
          switchCommunityView('inspire',{skipHash:false,instant:true,keepSearchOpen:true});
        }
        if(searchInput) searchInput.focus();
      }
    });
  }
  document.addEventListener('keydown',function(ev){
    if(ev.key!=='Escape') return;
    if(document.body.classList.contains('search-nav-open')) closeMobileSearchNav();
  });
  const buddyTrigger=document.getElementById('buddyFilterTrigger');
  if(buddyTrigger) buddyTrigger.addEventListener('click',function(){openMobileFilterSheet('buddy');});
  const inspireTrigger=document.getElementById('inspireTypeTrigger');
  if(inspireTrigger) inspireTrigger.addEventListener('click',function(){openMobileFilterSheet('inspire-type');});
  ['mobileFilterSheetClose','mobileFilterSheetDone','mobileFilterSheetBackdrop'].forEach(function(id){
    const el=document.getElementById(id);
    if(el) el.addEventListener('click',closeMobileFilterSheet);
  });
  if(MOBILE_LAYOUT_MQ){
    MOBILE_LAYOUT_MQ.addEventListener('change',function(){
      initMobileLayoutDefaults();
      closeMobileFilterSheet();
      if(!isMobileLayout()) document.body.classList.remove('search-nav-open');
    });
  }
}

function scrollToId(id) {
  if (COMMUNITY_VIEW_IDS.includes(id) || id === 'me') {
    if (id === 'me') openMePage({});
    else switchCommunityView(id);
    return;
  }
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}
function saveRoute(btn){btn.textContent=btn.textContent==='♡'?'♥':'♡';btn.style.color=btn.textContent==='♥'?'#ff385c':''}
function toggleLike(el){el.classList.toggle('liked');el.textContent=el.classList.contains('liked')?el.textContent.replace('♡','♥'):el.textContent.replace('♥','♡')}
function toggleSaveText(el){el.classList.toggle('liked');el.textContent=el.classList.contains('liked')?'♣ 已收藏':'♧ 收藏'}
function favoriteRoute(){if(!currentRouteId)return;toggleRouteFavorite(currentRouteId);document.getElementById('routeFavoriteModalBtn').textContent=isRouteFavorite(currentRouteId)?'♥ 已收藏路线':'♡ 收藏这条路线';}

// city tabs（动态重建后仍可用事件委托）
const cityTabsEl=document.getElementById('cityTabs');
if(cityTabsEl){
  cityTabsEl.addEventListener('click',(ev)=>{
    const btn=ev.target.closest('.city-tab');
    if(!btn) return;
    document.querySelectorAll('#cityTabs .city-tab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    renderInspire();
  });
}

// feed type tabs（灵感工具条）
Array.from(document.querySelectorAll('.feed-tab')).forEach(btn=>btn.addEventListener('click',()=>{
  feedViewSavedOnly=false;
  feedVisibleCount=8;
  setFeedTypeFilter(btn.dataset.type||'全部');
}));
const feedSavedToggle=document.getElementById('feedSavedToggle');
if(feedSavedToggle){
  feedSavedToggle.addEventListener('click',function(){
    feedViewSavedOnly=!feedViewSavedOnly;
    feedVisibleCount=Math.max(8,feedSavedIds.size||8);
    syncFeedSavedCounts();
    renderInspire();
    scrollToId('inspire');
  });
}
const feedSort=document.getElementById('feedSort');
if(feedSort) feedSort.addEventListener('change',()=>renderInspire());
const feedLoadMore=document.getElementById('feedLoadMore');
if(feedLoadMore) feedLoadMore.addEventListener('click',function(){
  feedVisibleCount+=6;
  renderInspire();
});
// buddy filters
Array.from(document.querySelectorAll('.buddy-filter')).forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('.buddy-filter').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderBuddies(btn.dataset.filter);
  renderSearchResultsBar();
  syncMobileFilterTriggers();
}));

// global search（范围在 #searchResultsBar 内切换）
let searchTimer;
const searchInputEl=document.getElementById('searchInput');
if(searchInputEl){
  searchInputEl.addEventListener('input',function(){
    clearTimeout(searchTimer);
    searchTimer=setTimeout(function(){
      feedVisibleCount=8;
      applyCommunitySearch({ scroll: true });
    },120);
  });
}
const searchResultsScopeEl=document.getElementById('searchResultsScope');
if(searchResultsScopeEl){
  searchResultsScopeEl.addEventListener('click',function(ev){
    const btn=ev.target.closest('[data-search-scope]');
    if(!btn) return;
    setCommunitySearchScope(btn.dataset.searchScope||'all');
    applyCommunitySearch({ scroll: false });
  });
}
const searchResultsClear=document.getElementById('searchResultsClear');
if(searchResultsClear) searchResultsClear.addEventListener('click',clearCommunitySearch);

// close modals by backdrop + ESC
Array.from(document.querySelectorAll('.modal')).forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeModal(m.id)}));
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.modal.show').forEach(m=>closeModal(m.id))});

bindCommunityRouter();

renderFootprints();
renderFeedHotTags();
syncFeedSavedCounts();
syncSearchScopeUi();
applyCommunitySearch({ scroll: false });
renderPointsBoard();
setMePrimaryTab('saved', false);
setMeSavedTab('notes', false);
renderMePage();
document.querySelectorAll('.me-primary-tab').forEach(function (btn) {
  btn.addEventListener('click', function () { setMePrimaryTab(btn.dataset.meTab || 'saved'); });
});
document.querySelectorAll('.me-saved-tab').forEach(function (btn) {
  btn.addEventListener('click', function () { setMeSavedTab(btn.dataset.meSaved || 'notes'); });
});
const meOpenAuthBtn = document.getElementById('meOpenAuthBtn');
if (meOpenAuthBtn) meOpenAuthBtn.addEventListener('click', function () {
  if (typeof CitywalkAuth !== 'undefined') CitywalkAuth.openAuthModal('login');
});
const meOpenAccountBtn = document.getElementById('meOpenAccountBtn');
if (meOpenAccountBtn) meOpenAccountBtn.addEventListener('click', function () {
  if (typeof CitywalkAuth !== 'undefined') CitywalkAuth.openAuthModal('account');
});
renderHeroBuddyPreview();
updateHeroBuddyCount();
bindMobileDensityUi();
initMobileLayoutDefaults();
syncMobileFilterTriggers();
syncCommunityViewFromHash();

const publishPostForm=document.getElementById('publishPostForm');
if(publishPostForm) publishPostForm.addEventListener('submit',submitPublishPostForm);
const publishTypeEl=document.getElementById('publishType');
if(publishTypeEl) publishTypeEl.addEventListener('change',function(){ updatePublishTypeHint(); refreshPublishTagSuggestions(); });
const publishTitleEl=document.getElementById('publishTitle');
if(publishTitleEl) publishTitleEl.addEventListener('input',function(){ updatePublishCharCounts(); refreshPublishTagSuggestions(); });
const publishDescEl=document.getElementById('publishDesc');
if(publishDescEl) publishDescEl.addEventListener('input',function(){ updatePublishCharCounts(); refreshPublishTagSuggestions(); });
const publishCityEl=document.getElementById('publishCity');
if(publishCityEl) publishCityEl.addEventListener('input',refreshPublishTagSuggestions);
const publishTagsInput=document.getElementById('publishTagsInput');
if(publishTagsInput){
  publishTagsInput.addEventListener('input',refreshPublishTagSuggestions);
  publishTagsInput.addEventListener('keydown',function(e){
    if(e.key==='Enter'||e.key===','||e.key==='，'){
      e.preventDefault();
      const val=publishTagsInput.value.trim();
      if(val&&addPublishTag(val)) publishTagsInput.value='';
    }
  });
  publishTagsInput.addEventListener('focus',refreshPublishTagSuggestions);
}
const buddyCreateForm=document.getElementById('buddyCreateForm');
if(buddyCreateForm) buddyCreateForm.addEventListener('submit',submitBuddyCreateForm);

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
  switchCommunityView('spots', { instant: true });
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
    importPlannedRouteFromSession({ awardPoints: false, openFootprintForm: false });
    try{
      const cleanUrl=new URL(window.location.href);
      cleanUrl.searchParams.delete('import');
      window.history.replaceState({},'',cleanUrl.toString());
    }catch(e){}
  },180);
}

const sharedRouteId=integrationParams.get('r');
if(sharedRouteId&&/^[A-Za-z0-9_-]{6,24}$/.test(sharedRouteId)){
  setTimeout(function(){
    importSharedRouteById(sharedRouteId,{ openFootprintForm:false });
    try{
      const cleanUrl=new URL(window.location.href);
      cleanUrl.searchParams.delete('r');
      window.history.replaceState({},'',cleanUrl.toString());
    }catch(e){}
  },220);
}

if(typeof CitywalkAuth!=='undefined'){
  const _origAuthChrome = CitywalkAuth.updateAuthChrome.bind(CitywalkAuth);
  CitywalkAuth.updateAuthChrome = function () {
    _origAuthChrome();
    updateUserAvatarPopover();
  };
  CitywalkAuth.initAuth().then(function () {
    updateUserAvatarPopover();
    return loadCommunityUgc();
  });
}else{
  loadCommunityUgc();
}

window.addEventListener('hashchange', syncCommunityViewFromHash);
