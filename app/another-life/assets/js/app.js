(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // 排盘引擎与字形文件都不再首屏下载：点“展开”时才拉 bazi.js，进命盘页时才拉 fire-glyphs.js。
  const BAZI_SRC = 'assets/js/bazi.js?v=20261110m';
  let baziLoad = null;
  function loadBazi() {
    if (window.BAZI) return Promise.resolve(window.BAZI);
    if (!baziLoad) baziLoad = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = BAZI_SRC;
      script.async = true;
      script.onload = () => (window.BAZI ? resolve(window.BAZI) : reject(new Error('排盘脚本未就绪')));
      script.onerror = () => { baziLoad = null; script.remove(); reject(new Error('排盘脚本加载失败')); };
      document.head.append(script);
    });
    return baziLoad;
  }
  const bazi = () => window.BAZI;
  let glyphLoad = null;
  function loadGlyphs() {
    if (window.FIRE_GLYPHS) return Promise.resolve();
    if (!glyphLoad) glyphLoad = new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'assets/js/fire-glyphs.js?v=20261110m';
      script.async = true;
      script.onload = resolve;
      script.onerror = () => { glyphLoad = null; resolve(); };
      document.head.append(script);
    });
    return glyphLoad;
  }
  const cities = window.CITY_RAW.split(';').filter(Boolean).map((line) => {
    const [name, lon, lat] = line.split(',');
    return { name, lon: Number(lon), lat: Number(lat) };
  });
  let calendar = 'solar';
  let result = null;
  let nodes = [];
  let pageIndex = 0;
  let busy = false;
  let turning = false;
  let activeImage = 0;
  let currentArt = 'opening';
  let goldToken = 0;
  let goldWriters = [];
  let echoMode = false;
  let choices = {};
  let sceneLoadId = 0;
  const readyArt = new Map();
  const decodedArt = [];
  const screens = ['cover', 'birth', 'inscription', 'story'];

  function toast(message) {
    $('toast').textContent = message;
    $('toast').hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { $('toast').hidden = true; }, 3200);
  }

  function showScreen(id) {
    screens.forEach((screen) => { $(screen).hidden = screen !== id; });
    $('open-chapters').hidden = id !== 'story';
    $('edit').hidden = id !== 'story';
    $('character').hidden = true;
    $('scene-layers').hidden = id !== 'story';
    if (id !== 'story') document.body.dataset.weather = 'clear';
    document.body.dataset.screen = id;
    // 换屏时把焦点交给新屏的标题，读屏和键盘用户不会停留在已经隐藏的控件上
    if (id === 'story') {
      startDrift();
      setTimeout(() => { if (document.body.dataset.screen === 'story') $('story-copy').focus({ preventScroll: true }); }, 80);
    } else {
      stopDrift();
      if (id === 'birth') setTimeout(() => { if (document.body.dataset.screen === 'birth') $('birth-title').focus({ preventScroll: true }); }, 80);
    }
  }

  function preloadArt(key) {
    if (!readyArt.has(key)) readyArt.set(key, new Promise((resolve) => {
      const image = new Image();
      image.onload = () => { (image.decode ? image.decode() : Promise.resolve()).catch(() => {}).then(() => {
        // 只留最近 6 张解码图，避免整段人生下来把几十张 1600px 位图一直钉在内存里
        decodedArt.push(image); if (decodedArt.length > 6) decodedArt.shift();
        resolve(window.ART[key]);
      }); };
      image.onerror = () => resolve(window.ART[key]);
      const srcset = window.ART_SRCSET && window.ART_SRCSET[key];
      if (srcset) { image.sizes = '100vw'; image.srcset = srcset; }
      image.src = window.ART[key];
    }));
    return readyArt.get(key);
  }

  // 换幕：新画面从一滴墨晕开的形状里显出来（用不规则 clip-path 长大），而不是简单淡入淡出
  let sceneZ = 3;
  async function setScene(key, bloomAt) {
    const token = ++sceneLoadId;
    if (currentArt === key) return;
    const src = await preloadArt(key);
    if (token !== sceneLoadId || currentArt === key) return;
    const next = activeImage ? $('scene-a') : $('scene-b');
    const old = activeImage ? $('scene-b') : $('scene-a');
    next.getAnimations().forEach((a) => { if (a.id === 'ink') a.cancel(); });
    const srcset = window.ART_SRCSET && window.ART_SRCSET[key];
    if (srcset) { next.sizes = '100vw'; next.srcset = srcset; }
    else { next.removeAttribute('srcset'); next.removeAttribute('sizes'); }
    next.src = src;
    next.style.clipPath = ''; next.style.transition = '';
    next.style.animation = 'none';
    void next.offsetWidth;
    next.style.animation = '';
    next.style.zIndex = '2'; old.style.zIndex = '1';
    activeImage = 1 - activeImage;
    currentArt = key;
    const useBloom = bloomAt != null && !reduced && document.body.dataset.screen === 'story' && next.animate;
    if (!useBloom) {
      next.classList.add('active'); old.classList.remove('active');
      return;
    }
    // 墨滴晕开：用一块不规则的多边形（clip-path）从落点向外长大，比大图蒙版逐帧重绘轻得多，手机上不卡
    const w = next.offsetWidth || innerWidth, h = next.offsetHeight || innerHeight;
    const cx = bloomAt, cy = 62, R = Math.hypot(w, h) * 1.15, N = 26;
    const rnd = () => Math.random() - .5;
    const J = [0, 1, 2].map(() => Array.from({ length: N }, rnd));
    const blob = (rpx, jit, k) => `polygon(${Array.from({ length: N }, (_, i) => {
      const a = i / N * 6.2832, rr = rpx * (1 + jit * (J[k][i] + Math.sin(a * 3 + k) * .45));
      return `${(cx + rr * Math.cos(a) / w * 100).toFixed(2)}% ${(cy + rr * Math.sin(a) / h * 100).toFixed(2)}%`;
    }).join(',')})`;
    Object.assign(next.style, { clipPath: blob(6, .3, 0), opacity: '1', transition: 'none' });
    next.classList.add('active');
    const grow = next.animate([{ clipPath: blob(6, .3, 0) }, { clipPath: blob(R * .38, .34, 1), offset: .42 }, { clipPath: blob(R, .14, 2) }], { duration: 1150, easing: 'cubic-bezier(.3,.08,.22,1)', fill: 'forwards', id: 'ink' });
    try { await grow.finished; } catch (_) { return; }
    if (token !== sceneLoadId) return;
    old.classList.remove('active');
    Object.assign(next.style, { clipPath: '', transition: '' });
    grow.cancel();
  }

  function options(id, entries, selected) {
    $(id).replaceChildren(...entries.map(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      return option;
    }));
    if (selected != null && [...$(id).options].some((option) => option.value === String(selected))) $(id).value = selected;
  }

  function syncDate(monthValue = Number($('month').value), dayValue = Number($('day').value)) {
    const year = Number($('year').value);
    const monthNames = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
    let months;
    if (calendar === 'lunar') {
      const { LunarYear } = bazi().lib;
      const all = LunarYear.fromYear(year).getMonths().map((month) => month.getMonth());
      const start = all.indexOf(1);
      months = all.slice(start, start + 13);
      const end = months.indexOf(1, 1);
      if (end >= 0) months = months.slice(0, end);
    } else months = Array.from({ length: 12 }, (_, i) => i + 1);
    options('month', months.map((month) => [month, calendar === 'lunar' ? `${month < 0 ? '闰' : ''}${monthNames[Math.abs(month) - 1]}月` : `${month}月`]), months.includes(monthValue) ? monthValue : Math.abs(monthValue));
    const month = Number($('month').value);
    const count = calendar === 'lunar' ? bazi().lib.LunarMonth.fromYm(year, month).getDayCount() : new Date(Date.UTC(year, month, 0)).getUTCDate();
    const lunarDays = ['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十','廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];
    options('day', Array.from({ length: count }, (_, i) => [i + 1, calendar === 'lunar' ? lunarDays[i] : `${i + 1}日`]), Math.min(dayValue || 1, count));
  }

  options('year', Array.from({ length: 201 }, (_, i) => [1900 + i, `${1900 + i}年`]), 1995);
  syncDate(6, 15);
  const branches = '子丑寅卯辰巳午未申酉戌亥';
  options('hour', Array.from({ length: 24 }, (_, hour) => [hour, `${String(hour).padStart(2, '0')} 时 · ${branches[Math.floor((hour + 1) / 2) % 12]}`]), 12);
  options('minute', Array.from({ length: 60 }, (_, minute) => [minute, `${String(minute).padStart(2, '0')} 分`]), 0);
  cities.forEach((city) => { const option = document.createElement('option'); option.value = city.name; $('cities').append(option); });
  $('year').addEventListener('change', () => syncDate());
  $('month').addEventListener('change', () => syncDate());
  document.querySelectorAll('[name=calendar]').forEach((radio) => radio.addEventListener('change', async () => {
    const year = Number($('year').value);
    const month = Number($('month').value);
    const day = Number($('day').value);
    const target = radio.value;
    try { await loadBazi(); } catch (error) { toast('排盘脚本未能加载，请检查网络后重试'); document.querySelector(`[name=calendar][value=${calendar}]`).checked = true; return; }
    const { Solar, Lunar } = bazi().lib;
    const converted = calendar === 'solar' ? Solar.fromYmd(year, month, day).getLunar() : Lunar.fromYmd(year, month, day).getSolar();
    if (converted.getYear() < 1900 || converted.getYear() > 2100) {
      document.querySelector(`[name=calendar][value=${calendar}]`).checked = true;
      return toast('转换后的年份超出 1900–2100 范围');
    }
    calendar = target;
    $('year').value = converted.getYear();
    syncDate(converted.getMonth(), converted.getDay());
  }));
  $('city').addEventListener('change', () => {
    const match = cities.find((city) => city.name === $('city').value.trim());
    if (match) { $('longitude').value = match.lon; $('latitude').value = match.lat; }
    else toast('城市未收录，请在校时设置里填写经纬度');
  });

  function inputOf() {
    const month = Number($('month').value);
    return {
      calendar, y: Number($('year').value), m: Math.abs(month), d: Number($('day').value),
      h: Number($('hour').value), mi: Number($('minute').value), leap: month < 0,
      lon: Number($('longitude').value), lat: Number($('latitude').value),
      gender: document.querySelector('[name=gender]:checked')?.value || null,
      useTrueSolar: $('true-solar').checked, ziMode: $('zi-mode').value,
      jieBasis: $('jie-basis').value, yunSect: Number($('yun-sect').value),
      dst: $('dst').value, dstAmbiguous: $('dst-ambiguous').value,
    };
  }


  function singaporeToday() {
    const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Singapore', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date());
    return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
  }

  async function compute(input) {
    const opts = Object.assign({ today: singaporeToday(), robustN: 400 }, window.__examOpt ? window.__examOpt() : {});
    function main() {
      const res = bazi().run(input, opts);
      return { result: res };
    }
    // 真 worker 文件（importScripts 加载引擎），不再是“把 bazi.js 源码 fetch 下来再拼 blob”
    try {
      return await new Promise((resolve, reject) => {
        let worker;
        try { worker = new Worker('assets/js/bazi-worker.js'); }
        catch (error) { const e = new Error('worker 不可用'); e.infra = true; reject(e); return; }
        const timer = setTimeout(() => { worker.terminate(); const e = new Error('推演超时，请重试'); e.infra = false; reject(e); }, 20000);
        worker.onmessage = (event) => {
          clearTimeout(timer); worker.terminate();
          if (event.data && event.data.error) reject(new Error(event.data.error));
          else resolve({ result: event.data.result });
        };
        worker.onerror = () => { clearTimeout(timer); worker.terminate(); const e = new Error('worker 启动失败'); e.infra = true; reject(e); };
        worker.postMessage({ input, opts });
      });
    } catch (error) {
      if (!error.infra) throw error;
      return main();
    }
  }

  function createFireWriter(targetId, char, size) {
    const target=$(targetId), key=targetId+'-'+goldToken;
    const shape=window.FIRE_GLYPHS[char];
    target.innerHTML=`<svg viewBox="0 0 1024 1024" width="${size}" height="${size}" aria-label="${char}"><defs>
      <linearGradient id="gold-${key}" x2=".4" y2="1"><stop stop-color="#fff0b6"/><stop offset=".5" stop-color="#efb866"/><stop offset="1" stop-color="#a66030"/></linearGradient>
      <mask id="reveal-${key}" maskUnits="userSpaceOnUse" x="-200" y="-300" width="1500" height="1600"><rect class="reveal-area" x="-200" y="1100" width="1500" height="0" fill="white"/></mask>
      <clipPath id="front-${key}"><rect class="fire-band" x="-200" y="1060" width="1500" height="85"/></clipPath>
      <filter id="flame-${key}" x="-40%" y="-50%" width="180%" height="200%"><feTurbulence type="fractalNoise" baseFrequency=".016 .035" numOctaves="2" seed="4" result="noise"><animate attributeName="baseFrequency" values=".016 .035;.026 .06;.016 .035" dur=".45s" repeatCount="indefinite"/></feTurbulence><feDisplacementMap in="SourceGraphic" in2="noise" scale="70" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="1.2"/><feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#ff6e17" flood-opacity=".85"/></filter>
      </defs><g transform="translate(0 900) scale(1 -1)">
      <path class="revealed-glyph" d="${shape}" fill="url(#gold-${key})" mask="url(#reveal-${key})"/>
      <g filter="url(#flame-${key})"><g clip-path="url(#front-${key})"><path class="burning-front" d="${shape}" fill="#fff2ac" stroke="#ff982c" stroke-width="30" mask="url(#reveal-${key})"/></g></g>
      <g class="living-fire" filter="url(#flame-${key})" opacity=".65"><path d="${shape}" fill="none" stroke="#ff9d35" stroke-width="9" mask="url(#reveal-${key})"/></g>
      </g></svg>`;
    const rect=target.querySelector('.reveal-area'), band=target.querySelector('.fire-band');
    let animation,settle; const state={y:1100};
    function draw(){rect.setAttribute('y',state.y);rect.setAttribute('height',1100-state.y);band.setAttribute('y',state.y-25);}
    function complete(){state.y=-250;draw();target.querySelector('.burning-front').style.opacity=0;}
    return {
      pauseAnimation(){animation?.kill();settle?.();settle=null;},
      showCharacter(){complete();},
      animateCharacter(){return new Promise(resolve=>{settle=resolve;state.y=940;draw();animation=gsap.to(state,{y:-150,duration:1.25,ease:'none',onUpdate:draw,onComplete:()=>{complete();settle=null;resolve();}});});}
    };
  }

  // ── 逐字边缘燃烧 ──
  // 火先在每个金字的笔画边界上点着，向内向外同时蔓延；烧过的地方露出后面的画（故事页的第一幅），
  // 没烧到的地方仍是原来的命盘页。距离场按「到最近一个字边界的距离」算，每个字略有先后。
  let burnRunning = false;
  function glyphSources() {
    const out = [];
    const keys = ['year', 'month', 'day', 'hour'];
    keys.forEach((key, i) => Array.from(result.chart.pillars[key].ganzhi).forEach((char, j) => {
      const holder = $(`glyph-${i}-${j}`);
      const svg = holder && holder.querySelector('svg');
      const rect = (svg || holder)?.getBoundingClientRect();
      if (!rect || !rect.width) return;
      out.push({ char, rect, path: window.FIRE_GLYPHS?.[char] || null, order: out.length });
    }));
    return out;
  }

  function noiseField(gw, gh, cell, seed) {
    const cw = Math.ceil(gw / cell) + 2, ch = Math.ceil(gh / cell) + 2;
    let s = seed >>> 0;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const lat = new Float32Array(cw * ch).map(rnd);
    const out = new Float32Array(gw * gh);
    for (let y = 0; y < gh; y++) {
      const fy = y / cell, y0 = fy | 0, ty = fy - y0, sy = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < gw; x++) {
        const fx = x / cell, x0 = fx | 0, tx = fx - x0, sx = tx * tx * (3 - 2 * tx);
        const a = lat[y0 * cw + x0], b = lat[y0 * cw + x0 + 1], c = lat[(y0 + 1) * cw + x0], d = lat[(y0 + 1) * cw + x0 + 1];
        out[y * gw + x] = a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
      }
    }
    return out;
  }

  function drawBackdrop(ctx, W, H, img, px, tex) {
    // 与故事页 CSS 同一套：手机=上半幅画+底部融进深青；电脑=整幅画+左侧一层薄影。第一幕是那幅深青抽象画：贴底对齐，让山脉露出来
    const mobile = W < 761;
    const body = document.body;
    let artH = H;
    if (mobile) {
      const prev = { screen: body.dataset.screen, beat: body.dataset.beat };
      body.dataset.screen = 'story'; body.dataset.beat = 'origin';
      const probe = document.createElement('div');
      probe.style.cssText = 'position:absolute;left:-9999px;top:0;width:1px;height:var(--split);visibility:hidden;pointer-events:none';
      body.append(probe);
      artH = Math.round(probe.getBoundingClientRect().height) || Math.round(H * .45);
      probe.remove();
      body.dataset.screen = prev.screen || ''; body.dataset.beat = prev.beat || '';
    }
    const cx = parseFloat(getComputedStyle(body).getPropertyValue('--cx')) || 0;
    const cy = parseFloat(getComputedStyle(body).getPropertyValue('--cy')) || 0;
    ctx.fillStyle = '#0f2b2a'; ctx.fillRect(0, 0, W, H);
    if (tex && tex.naturalWidth) {
      const sc = Math.max(W / tex.naturalWidth, H / tex.naturalHeight);
      ctx.drawImage(tex, (W - tex.naturalWidth * sc) / 2, (H - tex.naturalHeight * sc) / 2, tex.naturalWidth * sc, tex.naturalHeight * sc);
    }
    if (img && img.naturalWidth) {
      const scale = Math.max(W / img.naturalWidth, artH / img.naturalHeight);
      const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, artH); ctx.clip();
      ctx.translate(cx, cy);
      { const oy = mobile ? artH : artH / 2; ctx.translate(W / 2, oy); ctx.scale(1.07, 1.07); ctx.translate(-W / 2, -oy); }
      ctx.drawImage(img, (W - dw) * .5, mobile ? artH - dh : (artH - dh) * .5, dw, dh);
      ctx.restore();
    }
    let g;
    if (mobile) {
      g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(15,43,42,.5)'); g.addColorStop(.12, 'rgba(15,43,42,0)');
      g.addColorStop(Math.max(.2, (artH - 150) / H), 'rgba(15,43,42,0)'); g.addColorStop(Math.min(.99, (artH - 2) / H), 'rgba(15,43,42,1)'); g.addColorStop(Math.min(.995, (artH + 18) / H), 'rgba(15,43,42,1)'); g.addColorStop(Math.min(1, (artH + 84) / H), 'rgba(15,43,42,0)'); g.addColorStop(1, 'rgba(15,43,42,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    } else {
      g = ctx.createLinearGradient(0, 0, W, 0);
      [[0, .7], [.3, .38], [.55, 0]].forEach(([o, a]) => g.addColorStop(o, `rgba(15,43,42,${a})`));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      g = ctx.createLinearGradient(0, H, 0, 0);
      g.addColorStop(0, 'rgba(15,43,42,.92)'); g.addColorStop(.1, 'rgba(15,43,42,.6)'); g.addColorStop(.24, 'rgba(15,43,42,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(15,43,42,.5)'); g.addColorStop(.18, 'rgba(15,43,42,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
  }


  // ── 把「故事页第一页」连字带版面画进幕后的画布：烧穿的地方露出的就是已经有字的真页面 ──
  const rgbaOf = (c, mul = 1) => { const m = String(c).match(/[\d.]+/g); if (!m || m.length < 3) return null; const a = (m.length > 3 ? +m[3] : 1) * mul; return a > .004 ? `rgba(${m[0]},${m[1]},${m[2]},${a})` : null; };
  function rrect(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); if (r <= 0) { ctx.rect(x, y, w, h); return; } ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function paintDom(ctx, roots) {
    const all = [];
    roots.forEach((r) => { all.push(r, ...r.querySelectorAll('*')); });
    const rng = document.createRange();
    all.forEach((el) => {
      if (el.closest('[hidden]')) return;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      let op = 1; for (let p = el; p && p.nodeType === 1; p = p.parentElement) op *= parseFloat(getComputedStyle(p).opacity);
      if (op < .01) return;
      const r = el.getBoundingClientRect();
      let clip = null;
      for (let p = el; p && p.nodeType === 1 && p !== document.body; p = p.parentElement) {
        const pc = getComputedStyle(p);
        if (/(hidden|clip|auto|scroll)/.test(pc.overflowX + pc.overflowY)) { const q = p.getBoundingClientRect(); clip = clip ? [Math.max(clip[0], q.left), Math.max(clip[1], q.top), Math.min(clip[2], q.right), Math.min(clip[3], q.bottom)] : [q.left, q.top, q.right, q.bottom]; }
      }
      ctx.save();
      if (clip) { ctx.beginPath(); ctx.rect(clip[0], clip[1], Math.max(0, clip[2] - clip[0]), Math.max(0, clip[3] - clip[1])); ctx.clip(); }
      if (r.width > 0 && r.height > 0) {
        const rad = parseFloat(cs.borderTopLeftRadius) || 0;
        const bg = cs.backgroundClip === 'text' ? null : rgbaOf(cs.backgroundColor, op);
        if (bg) { ctx.fillStyle = bg; rrect(ctx, r.left, r.top, r.width, r.height, rad); ctx.fill(); }
        const sides = ['Top', 'Right', 'Bottom', 'Left'].map((sd) => ({ w: parseFloat(cs['border' + sd + 'Width']) || 0, st: cs['border' + sd + 'Style'], c: rgbaOf(cs['border' + sd + 'Color'], op) }));
        const same = sides.every((q) => q.w === sides[0].w && q.c === sides[0].c && q.st === sides[0].st);
        if (same && sides[0].w > 0 && sides[0].st !== 'none' && sides[0].c) {
          ctx.strokeStyle = sides[0].c; ctx.lineWidth = sides[0].w; if (sides[0].st === 'dashed') ctx.setLineDash([3, 3]);
          rrect(ctx, r.left + sides[0].w / 2, r.top + sides[0].w / 2, r.width - sides[0].w, r.height - sides[0].w, rad); ctx.stroke(); ctx.setLineDash([]);
        } else {
          sides.forEach((q, i) => { if (q.w > 0 && q.st !== 'none' && q.c) { ctx.fillStyle = q.c; if (i === 0) ctx.fillRect(r.left, r.top, r.width, q.w); if (i === 1) ctx.fillRect(r.right - q.w, r.top, q.w, r.height); if (i === 2) ctx.fillRect(r.left, r.bottom - q.w, r.width, q.w); if (i === 3) ctx.fillRect(r.left, r.top, q.w, r.height); } });
        }
      }
      const gradText = cs.backgroundClip === 'text' || cs.webkitBackgroundClip === 'text';
      el.childNodes.forEach((tn) => {
        if (tn.nodeType !== 3 || !tn.nodeValue.trim()) return;
        ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        ctx.textBaseline = 'alphabetic';
        const asc = ctx.measureText('国').fontBoundingBoxAscent ?? parseFloat(cs.fontSize) * .88;
        let fill = rgbaOf(cs.webkitTextFillColor || cs.color, op);
        if (gradText) {
          const cols = (cs.backgroundImage.match(/rgba?\([^)]+\)/g) || []).map((c) => rgbaOf(c, op)).filter(Boolean);
          if (el.id === 'st-glyph') { const g = ctx.createLinearGradient(0, r.top, r.width * .2, r.bottom); g.addColorStop(0, rgbaOf('rgb(244,200,120)', op)); g.addColorStop(.55, rgbaOf('rgb(232,150,70)', op)); g.addColorStop(1, rgbaOf('rgb(200,96,40)', op)); fill = g; }
          else if (cols.length > 1) { const g = ctx.createLinearGradient(0, r.top, r.width * .25, r.bottom); cols.forEach((c, i) => g.addColorStop(i / (cols.length - 1), c)); fill = g; }
        }
        if (!fill) return;
        ctx.fillStyle = fill;
        const sw = parseFloat(cs.webkitTextStrokeWidth) || 0, sc = sw ? rgbaOf(cs.webkitTextStrokeColor, op) : null;
        if (sc) { ctx.strokeStyle = sc; ctx.lineWidth = sw; ctx.lineJoin = 'round'; }
        const str = tn.nodeValue;
        for (let i = 0; i < str.length; i++) {
          if (/\s/.test(str[i])) continue;
          rng.setStart(tn, i); rng.setEnd(tn, i + 1);
          const q = rng.getClientRects()[0]; if (!q || !q.width) continue;
          ctx.fillText(str[i], q.left, q.top + asc); window.__paintCount = (window.__paintCount || 0) + 1;
          if (sc) ctx.strokeText(str[i], q.left, q.top + asc);
        }
      });
      ctx.restore();
    });
  }
  // 暂时翻到故事页量好版面、画下来，再原样翻回——整个过程同步完成，屏幕上不会闪
  async function paintStoryFirstPage(ctx) {
    try { await document.fonts.ready; } catch (_) { /* 忽略 */ }
    const body = document.body;
    const prev = { screen: body.dataset.screen, beat: body.dataset.beat, weather: body.dataset.weather, scene: body.dataset.scene };
    const hid = screens.map((id) => [id, $(id).hidden]);
    const bars = ['open-chapters', 'edit', 'character', 'scene-layers'].map((id) => [id, $(id).hidden]);
    body.classList.add('measuring');
    try {
      screens.forEach((id) => { $(id).hidden = id !== 'story'; });
      bars.forEach(([id]) => { $(id).hidden = id === 'scene-layers' ? false : false; });
      body.dataset.screen = 'story';
      showNode(1, { dry: true });
      paintDom(ctx, [document.querySelector('header'), $('story')].filter(Boolean));
    } finally {
      hid.forEach(([id, h]) => { $(id).hidden = h; });
      bars.forEach(([id, h]) => { $(id).hidden = h; });
      body.dataset.screen = prev.screen; body.dataset.beat = prev.beat || ''; body.dataset.weather = prev.weather || 'clear'; body.dataset.scene = prev.scene || '';
      body.classList.remove('measuring');
    }
  }

  async function burnToStory(arrive) {
    if (burnRunning) return;
    if (reduced) { arrive(); return; }
    burnRunning = true;
    const W = innerWidth, H = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 3, Math.sqrt(8e6 / Math.max(1, W * H)));
    const k = Math.min(.6, Math.sqrt(110000 / (W * H)));
    const gw = Math.ceil(W * k) + 2, gh = Math.ceil(H * k) + 2;
    const src = glyphSources();
    const bgKey = bgOf(nodes[0]);
    const art = new Image(); art.src = await preloadArt(bgKey);
    try { await art.decode(); } catch (_) { /* 图片已在缓存时可能直接失败，忽略 */ }
    const px = W < 761 ? (sceneComposition(nodes[0], 'M')?.px ?? .6) : .5;
    const tex = new Image(); tex.src = window.ART['bg-ink'];
    try { await tex.decode(); } catch (_) { /* 忽略 */ }

    // 1) 字形栅格 → 边界种子
    const raster = document.createElement('canvas'); raster.width = gw; raster.height = gh;
    const rc = raster.getContext('2d', { willReadFrequently: true });
    src.forEach((g, n) => {
      rc.save();
      rc.fillStyle = `rgb(${n + 1},0,0)`;
      if (g.path) {
        const s = g.rect.width / 1024;
        rc.setTransform(s * k, 0, 0, -s * k, g.rect.left * k, (g.rect.top + 900 * s) * k);
        rc.fill(new Path2D(g.path));
      } else {
        rc.fillRect(g.rect.left * k, g.rect.top * k, g.rect.width * k, g.rect.height * k);
      }
      rc.restore();
    });
    const gd = rc.getImageData(0, 0, gw, gh).data;
    const N = gw * gh, INF = 1e9;
    const dist = new Float32Array(N).fill(INF);
    const inside = (x, y) => x >= 0 && y >= 0 && x < gw && y < gh && gd[(y * gw + x) * 4 + 3] > 110;
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const i = y * gw + x, here = inside(x, y);
      const nb = [inside(x - 1, y), inside(x + 1, y), inside(x, y - 1), inside(x, y + 1)];
      const edge = here ? nb.some((v) => !v) : nb.some(Boolean);
      if (!edge) continue;
      dist[i] = 0;
    }
    // 精确欧氏距离变换（Felzenszwalb）：等距线是圆，不是八边形
    const BIG = 1e20;
    const f1 = new Float32Array(Math.max(gw, gh)), d1 = new Float32Array(Math.max(gw, gh)), i1 = new Int32Array(Math.max(gw, gh));
    const vv = new Int32Array(Math.max(gw, gh)), zz = new Float32Array(Math.max(gw, gh) + 1);
    function pass(n) {
      let k = 0; vv[0] = 0; zz[0] = -BIG; zz[1] = BIG;
      for (let q = 1; q < n; q++) {
        let s;
        for (;;) { const p = vv[k]; s = ((f1[q] + q * q) - (f1[p] + p * p)) / (2 * q - 2 * p); if (s <= zz[k]) k--; else break; if (k < 0) { k = 0; break; } }
        k++; vv[k] = q; zz[k] = s; zz[k + 1] = BIG;
      }
      k = 0;
      for (let q = 0; q < n; q++) { while (zz[k + 1] < q) k++; d1[q] = (q - vv[k]) * (q - vv[k]) + f1[vv[k]]; i1[q] = vv[k]; }
    }
    const g2 = new Float32Array(N), srcY = new Int32Array(N);
    for (let x = 0; x < gw; x++) {
      for (let y = 0; y < gh; y++) f1[y] = dist[y * gw + x] === 0 ? 0 : BIG;
      pass(gh);
      for (let y = 0; y < gh; y++) { g2[y * gw + x] = d1[y]; srcY[y * gw + x] = i1[y]; }
    }
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) f1[x] = g2[y * gw + x];
      pass(gw);
      for (let x = 0; x < gw; x++) { dist[y * gw + x] = Math.sqrt(d1[x]); }
    }
    let maxD = 0;
    for (let i = 0; i < N; i++) { dist[i] = dist[i] >= 1e9 ? 0 : dist[i] / k; if (dist[i] > maxD) maxD = dist[i]; }

    // 2) 噪声：边缘不规则 + 缓慢闪动
    const n1 = noiseField(gw, gh, Math.max(3, 14 * k), 7), n2 = noiseField(gw, gh, Math.max(2, 5 * k), 19), n3 = noiseField(gw, gh, Math.max(2, 9 * k), 31);
    const jag = new Float32Array(N);
    for (let i = 0; i < N; i++) jag[i] = (n1[i] * .66 + n2[i] * .34) * 46;

    // 3) 画布
    const overlay = document.createElement('div'); overlay.className = 'burn-overlay';
    const canvas = document.createElement('canvas'); canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    overlay.append(canvas); document.body.append(overlay);
    const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
    const backdrop = document.createElement('canvas'); backdrop.width = canvas.width; backdrop.height = canvas.height;
    const bctx = backdrop.getContext('2d'); bctx.scale(dpr, dpr); drawBackdrop(bctx, W, H, art, px, tex);
    await paintStoryFirstPage(bctx);
    window.__burnBackdrop = backdrop;
    const maskC = document.createElement('canvas'); maskC.width = gw; maskC.height = gh;
    const mctx = maskC.getContext('2d'); const mimg = mctx.createImageData(gw, gh); const md = mimg.data;
    const rimC = document.createElement('canvas'); rimC.width = gw; rimC.height = gh;
    const rctx = rimC.getContext('2d'); const rimg = rctx.createImageData(gw, gh); const rd = rimg.data;

    $('inscription').classList.add('igniting');
    haptic([16, 90, 10, 70, 12, 56, 14, 44, 16, 34, 18, 26, 22, 20, 26, 14, 30]);   // 越烧越密的心跳
    $('inscription').style.pointerEvents = 'none';
    const total = maxD + 46 + 40;
    const duration = 3600;
    const sparks = [];
    const t0 = performance.now();
    let lastE = -1;
    const SC = 15, EM = 3.2, GL = 30;   // 焦边宽、火线宽、余烬宽（像素）
    await new Promise((resolve) => {
      function frame(now) {
        const hold = window.__burnAt != null;           // 测试钩子：定格在指定毫秒
        const e = hold ? window.__burnAt : now - t0;
        if (hold && e === lastE) { requestAnimationFrame(frame); return; }
        lastE = e;
        const p = Math.min(1, e / duration);
        const T = Math.pow(p, 1.7) * total;
        const wob = Math.sin(e * .011);
        const front = [];
        for (let i = 0; i < N; i++) {
          const x = i % gw, y = (i / gw) | 0;
          const o = i * 4;
          const stagger = (y / gh) * 34 + (x / gw) * 22;   // 火往上、往右略快一点，边缘不会同时起
          const d = dist[i] + jag[i] + (n3[i] - .5) * 9 * wob + stagger;
          const v = T - d;
          // 蒙版：烧穿的地方透出后面的画
          const a = v <= 0 ? 0 : v >= 2.5 ? 255 : (v / 2.5) * 255;
          md[o] = md[o + 1] = md[o + 2] = 255; md[o + 3] = a;
          // 边缘特效
          let r = 0, g = 0, b = 0, al = 0;
          if (v <= 0) {
            if (v > -SC) { const f = 1 + v / SC; al = f * f * .88; r = 34 + f * 24; g = 15 + f * 8; b = 6; }
            if (v > -EM * 1.6) { const f = 1 + v / (EM * 1.6); r = 255; g = 130 + f * 110; b = 40 + f * 90; al = Math.max(al, Math.min(1, .35 + f * .75)); front.push(i); }
          } else {
            if (v < EM * 1.4) { const f = 1 - v / (EM * 1.4); r = 255; g = 190 + f * 60; b = 90 + f * 120; al = .55 + f * .45; if (v < 1.2) front.push(i); }
            else if (v < GL) {
              const f = 1 - (v - EM * 1.4) / (GL - EM * 1.4);
              const flick = .6 + .4 * n2[i];
              r = 255; g = 92 + f * 80; b = 22 + f * 24; al = f * f * .62 * flick;
            }
          }
          rd[o] = r; rd[o + 1] = g; rd[o + 2] = b; rd[o + 3] = Math.min(255, al * 255);
        }
        mctx.putImageData(mimg, 0, 0); rctx.putImageData(rimg, 0, 0);

        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, W, H);
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(backdrop, 0, 0, W, H);
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(maskC, 0, 0, gw, gh, 0, 0, gw / k, gh / k);
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(rimC, 0, 0, gw, gh, 0, 0, gw / k, gh / k);
        // 火星：从火线上随机取点，向上飘，带一点横向摆动
        for (let s = 0; s < Math.min(9, front.length / 6 + 1); s++) {
          const i = front[(Math.random() * front.length) | 0];
          if (i == null) break;
          sparks.push({ x: (i % gw) / k, y: ((i / gw) | 0) / k, vx: (Math.random() - .5) * .9, vy: -(.8 + Math.random() * 2.1), life: 1, size: .8 + Math.random() * 1.8, hue: Math.random() });
        }
        ctx.globalCompositeOperation = 'lighter';
        for (let s = sparks.length - 1; s >= 0; s--) {
          const q = sparks[s]; q.x += q.vx + Math.sin(q.y * .05 + s) * .25; q.y += q.vy; q.vy *= .992; q.life -= .022;
          if (q.life <= 0) { sparks.splice(s, 1); continue; }
          ctx.globalAlpha = Math.min(1, q.life * 1.2);
          ctx.fillStyle = q.hue > .6 ? '#ffe39a' : q.hue > .25 ? '#ffb347' : '#ff7a2a';
          ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (.6 + q.life * .6), 0, 6.283); ctx.fill();
        }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        if (p >= 1) { resolve(); return; }
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
    // 全部烧穿：换成真正的故事页，再把覆盖的画布淡掉
    arrive();
    haptic([46, 30, 18]);
    $('inscription').classList.remove('igniting');
    $('inscription').style.pointerEvents = '';
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    overlay.style.transition = 'opacity .7s ease'; overlay.style.opacity = '0';
    setTimeout(() => { overlay.remove(); burnRunning = false; }, 760);
  }

  function revealGold() {
    goldToken++;
    goldWriters.forEach((writer) => { writer.pauseAnimation(); writer.showCharacter({ duration: 0 }); });
    $('gold-terms').classList.add('visible');
    $('gold-continue').disabled = false;
    $('gold-continue').innerHTML = echoMode ? '回到这一生 <span>↗</span>' : '焚字入卷 <span>↗</span>';
    $('gold-skip').classList.add('is-hidden');
  }

  async function inscription(isEcho = false) {
    echoMode = isEcho;
    showScreen('inscription');
    const token = ++goldToken;
    goldWriters = [];
    $('gold-continue').disabled = true;
    $('gold-continue').innerHTML = '正在落字 <span>·</span>';
    $('gold-skip').hidden = false;
    $('gold-skip').classList.remove('is-hidden');
    $('gold-terms').classList.remove('visible');
    const chart = result.chart;
    const n = result.natal;
    const keys = ['year', 'month', 'day', 'hour'];
    $('gold-pillars').innerHTML = keys.map((key, i) => `<div class="gold-pillar"><span>${['年柱', '月柱', '日柱', '时柱'][i]}</span><div class="glyph" id="glyph-${i}-0"></div><div class="glyph" id="glyph-${i}-1"></div></div>`).join('');
    $('gold-pillars').setAttribute('aria-label', keys.map((key) => chart.pillars[key].ganzhi).join(' '));
    $('gold-terms').innerHTML = `<div class="destiny-identity"><span>${chart.input.genderCode === 'M' ? '乾造' : '坤造'}</span><i></i><span>${n.dm.gan}${n.dm.el}日主</span><i></i><span>${escape(n.strength.label)}</span></div><div class="destiny-reading"><span class="destiny-pattern">${escape(n.geju.name)}</span><div class="destiny-elements"><p><em>喜</em>${n.xiji.xi.map(item=>item.el).join(' · ')}</p><p><em>忌</em>${n.xiji.ji.map(item=>item.el).join(' · ') || '无明确忌神'}</p></div></div><div class="destiny-onset"><span>${chart.yun.forward ? '顺行' : '逆行'} · ${chart.yun.start.years}岁${chart.yun.start.months}个月${chart.yun.start.days}天起运</span><time>${chart.yun.startSolar}</time></div>`;
    const size = innerWidth <= 760 ? 64 : innerHeight <= 700 ? 78 : 100;
    // 先把四柱显示出来，不等金文字形文件。字形慢时直接落到文字，不让人对着空白页等。
    const paintFallback = () => keys.forEach((key, i) => Array.from(chart.pillars[key].ganzhi).forEach((char, j) => {
      const holder = $(`glyph-${i}-${j}`);
      if (holder) holder.innerHTML = `<span class="gold-char-fallback">${char}</span>`;
    }));
    paintFallback();
    // 最多等 1.5 秒；超时就用当前文字先把命盘页交出去，按钮仍然可点。
    const loaded = await Promise.race([
      loadGlyphs().then(() => true),
      new Promise((resolve) => setTimeout(() => resolve(false), 1500)),
    ]);
    if (token !== goldToken) return;
    if (loaded && window.FIRE_GLYPHS) {
      const glyphChars = [...new Set(keys.flatMap((key) => Array.from(chart.pillars[key].ganzhi)))];
      const glyphPaths = glyphChars.map((char) => window.FIRE_GLYPHS?.[char]).filter(Boolean);
      const glyphsSane = glyphPaths.length === glyphChars.length && new Set(glyphPaths).size === glyphChars.length;
      if (glyphsSane) {
        keys.forEach((key, i) => Array.from(chart.pillars[key].ganzhi).forEach((char, j) => {
          const holder = $(`glyph-${i}-${j}`);
          if (!holder) return;
          holder.innerHTML = '';
          if (window.FIRE_GLYPHS?.[char]) { const w = createFireWriter(`glyph-${i}-${j}`, char, size); w.row = j; goldWriters.push(w); }
          else holder.innerHTML = `<span class="gold-char-fallback">${char}</span>`;
        }));
      }
    }
    $('gold-continue').disabled = false;
    $('gold-continue').innerHTML = echoMode ? '回到这一生 <span>↗</span>' : '焚字入卷 <span>↗</span>';
    if (reduced) return revealGold();
    if (!goldWriters.length) { revealGold(); return; }
    try {
      // 四柱一起、一口气下来：天干快落到底时，地支紧接着从同一道火线继续往下
      const runs = [];
      for (const row of [0, 1]) {
        if (token !== goldToken) return;
        runs.push(...goldWriters.filter((w) => w.row === row).map((w) => w.animateCharacter()));
        if (row === 0) await new Promise((r) => setTimeout(r, 1120));
      }
      await Promise.all(runs);
      if (token === goldToken) revealGold();
    } catch (error) { if (token === goldToken) revealGold(); }
  }

  const TONE = { '大顺': 'up', '顺': 'up', '平': 'mid', '滞': 'low', '凶': 'bad' };
  const weatherOf = (node) => node.label === '凶' ? 'rain' : node.label === '滞' ? 'overcast' : (node.label === '顺' || node.label === '大顺') ? 'gold' : 'clear';
  const SEAL_STYLE = { child: 'row', school: 'row', exam: 'row', campus: 'row', depart: 'row', work: 'row', bond: 'row', turn: 'row', late: 'row', now: 'row' };
  const SEAL_IMG = { child: 'you', school: 'shao', exam: 'kao', campus: 'xue', depart: 'xing', work: 'ye', bond: 'yuan', turn: 'zhe', late: 'wan', now: 'jin' };
  const fateKey = () => innerWidth < 761 ? 'bg-fate-p' : 'bg-fate';
  // 只用背景图 + 少量"家具式"道具（放在空房间的地面上）。不放人物——画面里的人本来就在背景里。
  // 选图跟着这张盘走：同一阶段，不同的人（路线/强弱/吉凶）会落到不同的场景；同一个人的一生里，同一张图不重复出现。
  const prop = (asset, x, h, b = 4) => ({ asset, role: 'prop', x, b, h });
  function scenePlan() {
    if (scenePlan.cache && scenePlan.cache.r === result) return scenePlan.cache.v;
    const grp = result.natal.counts.grp;
    const seed = ['year', 'month', 'day', 'hour'].reduce((n, k) => n + [...result.chart.pillars[k].ganzhi].reduce((a, c) => a + c.charCodeAt(0), 0), 0);
    const outward = (grp['食伤'] || 0) + (grp['比劫'] || 0), inward = (grp['印'] || 0) + (grp['官杀'] || 0);
    const rot = (arr, n) => arr.map((_, i) => arr[(i + n) % arr.length]);
    const used = new Set(), plan = {};
    nodes.forEach((node, idx) => {
      const good = node.label === '顺' || node.label === '大顺', great = node.label === '大顺';
      const bad = node.label === '凶' || node.label === '滞', rain = node.label === '凶';
      const route = node.route, sd = seed + idx * 7;
      let weather = weatherOf(node), cands = [];
      const C = (bg, items = [], px = .6) => ({ bg, items, px });
      // 只有文字真的写到了，才用对应场景（法庭/病房/婴儿房），不凭空套图
      const txt = JSON.stringify([node.lines, node.omens, node.head]);
      const kids = /子女|孩子|晚辈/.test(txt), court = /官非|官司|诉讼|手续纠纷/.test(txt), sick = /手术|受伤|疾病|刑伤|身体/.test(txt);
      const study = (grp['印'] || 0) >= 2.4, a0 = node.age || 0;
      const partner = /合伙|共财|分利|合作|纠纷/.test(txt);
      switch (node.key) {
        case 'origin': case 'end': plan[node.key] = { bg: fateKey(), weather: 'clear', px: .5, items: [] }; return;
        case 'child':
          cands = (bad || inward > outward + 1) ? [C('childhood'), C('bg-yard', [], .7)] : outward > inward + 1 ? [C('bg-yard', [], .7), C('childhood')] : rot([C('bg-yard', [], .7), C('childhood')], sd); break;
        case 'school':
          cands = (bad || (grp['印'] || 0) >= 2.4) ? [C('bg-night'), C('school', [], .62)] : [C('school', [], .62), C('bg-night')]; break;
        case 'exam':
          weather = bad ? 'overcast' : weather;
          cands = [C('bg-exam', [prop('prop-examdesk', 68, 36, 3), ...(rain ? [prop('prop-umbrella', 30, 20, 2)] : [])]), C('bg-library', [], .55), C('school', [], .62)]; break;
        case 'campus':
          cands = study ? [C('bg-library', [], .55), C('bg-campus', [prop('prop-luggage', 73, 27, 3)]), C('bg-plaza', [], .5)] : rot([C('bg-campus', [prop('prop-luggage', 73, 27, 3)]), C('bg-plaza', [], .5)], sd); break;
        case 'depart':
          cands = route === 'independent' ? [C('bg-airport', [], .5), C('bg-train', [], .55), C('departure', [], .62), C('bg-rental')]
            : route === 'practical' ? [C('bg-train', [], .55), C('departure', [prop('prop-luggage', 76, 30, 3)], .62), C('bg-rental'), C('bg-airport', [], .5)]
              : (bad || route === 'create') ? [C('bg-rental'), C('departure', [prop('prop-luggage', 76, 30, 3)], .62), C('bg-train', [], .55)] : [C('departure', [], .62), C('bg-train', [], .55), C('bg-rental')]; break;
        case 'bond':
          weather = great ? 'gold' : weather;
          cands = great ? [C('bg-wedding'), C('bg-marriage'), C('bg-relationship')]
            : good ? rot([C('bg-marriage'), C('bg-relationship'), C('bg-livingroom', [], .55)], sd)
              : [C('bg-relationship', bad ? [prop('prop-umbrella', 22, 22, 2)] : []), C('bg-marriage')]; break;
        case 'work':
          if (partner && bad && !court) cands = [C('bg-conference', [], .55), C('bg-openoffice', [], .62), C('bg-smallbusiness', [prop('prop-shopcounter', 70, 36, 3)])];
          else if (court) cands = [C('bg-court', [], .6), C('bg-conference', [], .55), C('bg-office', [], .6)];
          else if (route === 'practical' && seed % 2 === 0) cands = [C('bg-factory', [], .6), C('bg-smallbusiness', [prop('prop-shopcounter', 70, 36, 3)]), C('bg-openoffice', [], .62)];
          else if (route === 'create' && study) cands = [C('bg-lab', [], .55), C('work'), C('bg-openoffice', [], .62)];
          else if (route === 'practical' || route === 'independent') cands = [C('bg-smallbusiness', [prop('prop-shopcounter', 70, 36, 3)]), C(good ? 'bg-meeting' : 'bg-openoffice', [], .62)];
          else if (route === 'create') cands = [C('work'), C('bg-openoffice', [], .62)];
          else cands = good ? [C('bg-meeting', [], .62), C('bg-openoffice', [], .62)] : bad ? [C('bg-office', [prop('prop-office-desk', 70, 36, 3)]), C('bg-openoffice', [], .62)] : [C('bg-openoffice', [], .62), C('bg-meeting', [], .62)]; break;
        case 'turn':
          cands = kids ? [C('bg-nursery', [], .55), C('bg-newhome', [], .62), C('together')]
            : court ? [C('bg-court', [], .6), C('midlife', [], .62)]
              : rain ? [C('bg-rainstreet', [], .5), C('midlife', [], .62), C('together')]
                : (sick && bad) ? [C('bg-ward', [], .55), C('midlife', [], .62)]
                  : good ? [C('bg-newhome', [], .62), C('bg-park', [], .5), C('together'), C('midlife')] : bad ? [C('midlife', [], .62), C('together')] : [C('together'), C('bg-conference', [], .55), C('midlife', [], .62)]; break;
        case 'now': {
          const a = node.age || 0;
          cands = kids && a >= 24 && a <= 48 ? [C('bg-nursery', [], .55), C('together')] : a <= 12 ? [C('bg-yard', [], .7), C('childhood')] : a <= 17 ? [C('school', [], .62), C('bg-night')] : a <= 22 ? [C('bg-campus', [], .6), C('bg-night')]
            : a <= 32 ? [C('bg-rental'), C('bg-openoffice', [], .62), C('together')] : a <= 52 ? [C('together'), C('bg-newhome', [], .62), C('midlife', [], .62)] : [C('midlife', [], .62), C('elder', [], .62), C('together')];
          break;
        }
        case 'late':
          cands = (sick && bad) ? [C('bg-ward', [], .55), C('elder', [], .62), C('bg-park', [], .5)] : good ? [C('bg-park', [], .5), C('elder', [], .62), C('bg-yard', [], .7)] : [C('elder', [], .62), C('bg-park', [], .5), C('bg-yard', [], .7), C('midlife', [], .62)]; break;
        default: plan[node.key] = null; return;
      }
      // 年代：同一人生阶段，不同年代的人不该坐在同一个场景里——高铁、玻璃航站楼、开放式办公室、独居出租屋这些都有"出现的年份"
      {
        const Y = node.year || 0, FROM = { 'bg-train': 2008, 'bg-airport': 1999, 'bg-conference': 1998, 'bg-court': 1995, 'bg-factory': 1998, 'bg-lab': 2000, 'bg-library': 2003, 'bg-livingroom': 2003, 'bg-meeting': 2003, 'bg-newhome': 1998, 'bg-night': 1992, 'bg-nursery': 2003, 'bg-openoffice': 2003, 'bg-park': 1998, 'bg-plaza': 2003, 'bg-rainstreet': 1998, 'bg-rental': 2008, 'bg-ward': 1998, 'bg-wedding': 2000, 'bg-office': 1995, work: 1998 };
        const UNTIL = { departure: 2018 };
        if (Y) {
          const ok = cands.filter((c) => Y >= (FROM[c.bg] || 0) && Y <= (UNTIL[c.bg] || 9999));
          const SAFE = { child: [C('childhood'), C('bg-yard', [], .7)], school: [C('school', [], .62)], exam: [C('bg-exam'), C('school', [], .62)], campus: [C('bg-campus', [prop('prop-luggage', 73, 27, 3)])], depart: [C('departure', [], .62)], bond: [C('bg-marriage'), C('bg-relationship')], work: [C('bg-smallbusiness', [prop('prop-shopcounter', 70, 36, 3)]), C('bg-yard', [], .7)], turn: [C('midlife', [], .62), C('together')], now: [C('midlife', [], .62), C('together')], late: [C('elder', [], .62), C('midlife', [], .62)] }[node.key] || [];
          cands = ok.length ? ok : SAFE;
          if (node.key === 'depart' && Y >= 2012) cands = [...cands.filter((c) => c.bg !== 'departure'), ...cands.filter((c) => c.bg === 'departure')];
        }
      }
      const pick = cands.find((c) => !used.has(c.bg)) || cands[0];
      used.add(pick.bg);
      plan[node.key] = { ...pick, weather };
    });
    scenePlan.cache = { r: result, v: plan };
    return plan;
  }
  const sceneComposition = (node) => scenePlan()[node.key] || null;

  function renderSceneLayers(node) {
    const layout = sceneComposition(node);
    const host = $('scene-layers');
    const oldStage = host.querySelector('.stage:not(.leaving)');
    if (oldStage) { oldStage.classList.add('leaving'); setTimeout(() => oldStage.remove(), 520); }
    document.body.dataset.weather = layout?.weather || 'clear';
    document.body.dataset.beat = node.key;
    if (!layout) return null;
    const px = innerWidth < 761 ? (layout.px ?? .6) : .5;
    document.body.style.setProperty('--px', String(px));
    const stage = document.createElement('div'); stage.className = 'stage';
    layout.items.forEach((item, i) => {
      const el = document.createElement('div');
      el.className = `sprite ${item.role}`;
      el.dataset.asset = item.asset;
      el.style.cssText = `--x:${item.x};--b:${item.b};--h:${item.h};animation-delay:${(oldStage ? .5 : .25) + i * .2}s`;
      if (item.frame != null) {
        el.style.backgroundImage = `url("${window.ART[item.asset]}")`;
        el.style.backgroundPosition = `${item.frame / 3 * 100}% center`;
        el.classList.add('sheet');
      } else {
        const image = new Image();
        const srcset = window.ART_SRCSET && window.ART_SRCSET[item.asset];
        if (srcset) { image.sizes = '45vw'; image.srcset = srcset; }
        image.src = window.ART[item.asset]; image.alt = '';
        el.append(image);
      }
      stage.append(el);
    });
    host.append(stage);
    return layout;
  }

  const esc = escape;
  const bgOf = (node) => sceneComposition(node)?.bg || node.scene;
  // 开头把「2025年（乙巳，行乙巳运）高考：凶——」这类与上方日期重复的前缀去掉，只留断语本身
  const tidy = (h) => String(h || '').replace(/^\d{4}年（[^）]*）[^：:]{0,8}[：:]\s*/, '').replace(/^(大顺|顺|平|滞|凶)[—–-]{1,2}/, '');
  function showNode(direction = 1, opt = {}) {
    const dry = !!opt.dry, instant = !!opt.instant;
    const node = nodes[pageIndex];
    const body = document.body;
    body.dataset.scene = node.key;
    $('story').dataset.key = node.key;
    $('story').dataset.state = node.state || '';
    let composition;
    if (dry) { document.body.dataset.beat = node.key; document.body.dataset.weather = weatherOf(node); composition = sceneComposition(node); }
    else {
      composition = renderSceneLayers(node);
      setScene(composition?.bg || node.scene, instant ? null : (direction > 0 ? 66 : 34));
    }
    if (instant) document.body.classList.add('no-enter'); else if (!dry) document.body.classList.remove('no-enter');
    // 章：命、归不盖章（那是深青本身的两端），改用"三层山"配色的大字；中间九章的印各有各的位置与落法
    const sealStyle = SEAL_STYLE[node.key] || 'glyph';
    $('story').dataset.seal = sealStyle;
    $('st-glyph').textContent = sealStyle === 'glyph' ? node.ch : '';
    const sealImg = SEAL_IMG[node.key] ? `url("${window.ART['seal-' + SEAL_IMG[node.key]]}")` : 'none';
    $('st-seal').style.backgroundImage = sealStyle === 'row' ? sealImg : 'none';
    $('st-stamp').style.backgroundImage = sealStyle !== 'row' && sealStyle !== 'glyph' ? sealImg : 'none';
    $('story').dataset.sealpos = node.key === 'now' ? 'left' : 'right';
    $('st-seal').setAttribute('aria-label', node.ch);
    const stamped = $('story'); stamped.classList.remove('stamp-go'); void stamped.offsetWidth; stamped.classList.add('stamp-go');
    if (!dry && sealStyle !== 'glyph') { const at = pageIndex; setTimeout(() => { if (pageIndex === at) { haptic(16); } }, 460); }
    $('st-title').textContent = node.chapter;
    const isYear = Boolean(node.year);
    rollWhen($('st-when'), node);
    const st = $('st-state'); st.textContent = isYear ? node.state : ''; st.dataset.s = node.state || ''; st.hidden = !isYear;
    const lab = $('st-label'); lab.textContent = isYear ? node.label : ''; lab.dataset.t = TONE[node.label] || ''; lab.hidden = !isYear;
    const head = node.key === 'end' ? '先凭记忆排出你最难、最顺的三年，再来对照' : tidy(node.head);
    $('st-head').textContent = head;
    $('st-head').dataset.len = head.length <= 17 ? 'short' : 'long';
    const NUM = '一二三四五六七八';
    const marks = node.key === 'origin' ? (node.marks || []) : [];
    $('st-marks').innerHTML = marks.map((m, i) => `<li${i === 0 ? ' class="open"' : ''}><div class="mk"><i>${NUM[i]}</i><b>${esc(m.k)}</b><u></u></div><div class="mm"><div><span>${esc(m.m)}</span></div></div></li>`).join('');
    $('st-marks').hidden = !marks.length;
    $('st-lines').innerHTML = (node.lines || []).map((line) => `<p>${esc(line)}</p>`).join('');
    $('st-omens').innerHTML = (node.omens || []).map((o) => `<li class="${o.up ? 'up' : 'down'}"><b>${esc(o.t)}</b><span>${esc(o.m)}</span></li>`).join('');
    $('st-omens').hidden = !(node.omens || []).length;
    $('st-luck').innerHTML = node.lk && node.newLk ? `<b>${esc(node.lk.gz)}运</b><i>${node.lk.from}–${node.lk.to}岁 · ${esc(node.lk.label)}</i><span>${esc(node.lk.brief)}</span>` : '';
    $('st-luck').hidden = !$('st-luck').innerHTML;
    const yrRow = (r, cls) => `<div class="yr ${cls}"><b>${r.year}</b><i>${r.age}岁 · ${esc(r.gz)}年 · ${esc(r.label)}</i><span>${esc(r.tone)}｜${esc(r.theme)}${r.tags ? '｜' + esc(r.tags) : ''}</span></div>`;
    $('st-check').innerHTML = node.key === 'end' && node.rows && (node.rows.worst.length || node.rows.best.length) ? `${node.rows.worst.length ? `<em>最难的三年</em>${node.rows.worst.map((r) => yrRow(r, 'w')).join('')}` : ''}${node.rows.best.length ? `<em class="second">最顺的三年</em>${node.rows.best.map((r) => yrRow(r, 'g')).join('')}` : ''}<small>对得上，是这套规则看得准；对不上，就是它在你身上不准——这本身也是有价值的结论。</small>` : node.state === '已过' && node.check ? `<em>回头对一对</em>${esc(node.check)}` : '';
    $('st-check').hidden = !$('st-check').innerHTML;
    $('ending-actions').hidden = node.key !== 'end';
    { const ei = $('eight-inline'); if (node.key === 'end') { if (typeof renderEightInline === 'function') renderEightInline(); } else if (ei) ei.remove(); }
    $('previous').disabled = pageIndex === 0;
    $('next').innerHTML = pageIndex === nodes.length - 1 ? '合 卷 <span>→</span>' : '往下走 <span>→</span>';
    $('page-number').textContent = `${String(pageIndex + 1).padStart(2, '0')} / ${String(nodes.length).padStart(2, '0')}`;
    [...$('timeline-buttons').children].forEach((button, i) => { button.classList.toggle('current', i === pageIndex); button.classList.toggle('passed', i < pageIndex); button.setAttribute('aria-current', i === pageIndex ? 'step' : 'false'); });
    $('timeline-progress').style.width = `${pageIndex / (nodes.length - 1) * 100}%`;
    const copy = $('story-copy');
    copy.classList.remove('copy-enter'); void copy.offsetWidth; copy.classList.add('copy-enter');
    copy.scrollTop = 0;
    document.body.classList.remove('story-reading');
    [...copy.children].forEach((child, i) => child.style.setProperty('--i', i));
    [...$('st-marks').children, ...$('st-lines').children, ...$('st-omens').children].forEach((child, i) => child.style.setProperty('--j', i));
    copy.style.setProperty('--dir', String(direction));
    moveBead();
    if (dry) return;
    if (!instant) { haptic(direction > 0 ? [10, 40, 8] : 8); }
    [1, 2].forEach((k) => { if (nodes[pageIndex + k]) preloadArt(bgOf(nodes[pageIndex + k])); });
  }

  async function goTo(index) {
    if (turning || index < 0 || index >= nodes.length || index === pageIndex) return;
    turning = true;
    try {
      const dir = index > pageIndex ? 1 : -1;
      const copy = $('story-copy');
      if (!reduced && copy.animate) {
        // 旧的这一幕像墨一样散开：朝来时的反方向飘走、变淡、微微模糊
        const out = copy.animate([{ opacity: 0, transform: `translateX(${-dir * 22}px)`, filter: 'blur(4px)' }], { duration: 210, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
        try { await out.finished; } catch (_) { /* 忽略 */ }
      }
      pageIndex = index; showNode(dir);
      copy.getAnimations().forEach((a) => { if (!a.id) a.cancel(); });
    } finally { setTimeout(() => { turning = false; }, 380); }
  }


  // 命局总批：点一条，展开它的意思（一次只展开一条）
  $('st-marks').addEventListener('click', (e) => {
    const li = e.target.closest('li'); if (!li) return;
    const was = li.classList.contains('open');
    [...$('st-marks').children].forEach((x) => x.classList.remove('open'));
    if (!was) li.classList.add('open');
    haptic(10);
  });
  // 统一的底色：深青宣纸（取自那幅抽象画的暗部），故事页的下半幅与命盘页都铺它
  (() => { const st = document.createElement('style'); st.textContent = `:root{--ink-tex:url("${new URL(window.ART['bg-ink'], document.baseURI).href}")}`; document.head.append(st); })();
  function itemHtml(item) {
    return `<article class="report-item"><p>${escape(item.text)}</p>${item.why?.length ? `<details><summary>展开原始依据</summary><ul>${item.why.map((text) => `<li>${escape(text)}</li>`).join('')}</ul></details>` : ''}${item.check ? `<p class="basis-evidence">回溯核对 · ${escape(item.check)}</p>` : ''}</article>`;
  }

  function showEvidence() {
    const node = nodes[pageIndex];
    if (!node.year) return;
    const a = result.natal;
    $('node-basis').innerHTML = `<p class="basis-heading">${esc(node.chapter)} · ${node.year}年${esc(node.gz)} · ${node.age}岁 · ${esc(node.label)}</p><p class="basis-row">日主 ${a.dm.gan}${a.dm.el} · ${esc(a.strength.label)} · ${esc(a.geju.name)} · 喜${a.xiji.xi.map((x) => x.el).join('')} 忌${a.xiji.ji.map((x) => x.el).join('') || '无'}<br>当年天干地支：${esc(node.stem)}${node.lk ? `<br>所在大运：${esc(node.lk.gz)}（${node.lk.from}–${node.lk.to}岁，${esc(node.lk.label)}）` : ''}</p><ul class="basis-evidence">${node.hits.map((h) => `<li>${esc(h)}</li>`).join('')}</ul><p class="basis-evidence">年份取法：该年龄段内，岁运分数偏离整体水平最大、且与前一年反差最大的一年；高考、婚恋年份直接取自对应篇章。评分是规则内的相对刻度，不是概率。</p>`;
    $('report-dialog').showModal();
  }

  function download() {
    const header = `另一个我 · 一生批注\n出生钟面时间 ${result.chart.clock}\n四柱 ${['year', 'month', 'day', 'hour'].map((key) => result.chart.pillars[key].ganzhi).join(' ')}\n`;
    const narrative = nodes.map((n) => `\n【${n.chapter}】${n.year ? `${n.year}年 ${n.gz} ${n.age}岁 ${n.label}（${n.state}）` : ''}\n${n.head}\n${(n.lines || []).join('\n')}${(n.omens || []).length ? '\n' + n.omens.map((o) => `· ${o.t}：${o.m}`).join('\n') : ''}`).join('\n');
    const report = bazi().R.renderText(result.report, { why: true });
    const text = header + narrative + '\n\n完整解读与依据\n' + report + '\n\n评分为规则内的相对刻度，不是概率；高龄年份用于取景，不是寿命推断。';
    const url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = '另一个我-一生批注.txt'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  // ── 终章：合卷 ──
  // 点「合卷」→ 页面淡去，背景按原来的格局慢慢变成明亮的青橙配色 → 两列竖排的一句话从上往下写出来
  // → 再点一下：整屏化作像素，聚成最初的那枚印章（只有印章）→ 两秒后浮出「退出 / 重来」
  let finaleRunning = false;
  const FINALE_LINES = ['你一定要好好生活', '别想太多w'];
  function ensureFinaleDom() {
    if ($('finale')) return;
    const el = document.createElement('div');
    el.id = 'finale'; el.hidden = true;
    el.innerHTML = '<img id="finale-art" alt=""><div id="finale-text" role="img" aria-label="你一定要好好生活，别想太多w">'
      + FINALE_LINES.map((line) => '<p>' + Array.from(line).map((c) => c === 'w' ? '<span class="w"><svg viewBox="0 0 34 26" aria-hidden="true"><path d="M3 5.5 C4 22 12 24.5 16.5 11.5 C21 24.5 29.5 22 31 4.5"/></svg></span>' : '<span>' + c + '</span>').join('') + '</p>').join('')
      + '</div><div id="finale-hint">轻 点 一 下</div>';
    document.body.append(el);
    const canvas = document.createElement('canvas');
    canvas.id = 'finale-canvas'; canvas.hidden = true; canvas.setAttribute('aria-hidden', 'true');
    document.body.append(canvas);
    const opts = document.createElement('div');
    opts.id = 'finale-opts'; opts.hidden = true;
    opts.innerHTML = '<button type="button" id="finale-exit">退 出</button><i></i><button type="button" id="finale-again">重 来</button>';
    $('cover').append(opts);
    const bye = document.createElement('p');
    bye.id = 'finale-bye'; bye.hidden = true; bye.textContent = '好好生活。';
    $('cover').append(bye);
    $('finale-exit').addEventListener('click', finaleExit);
    $('finale-again').addEventListener('click', finaleAgain);
    el.addEventListener('click', () => { if (el.dataset.ready === 'true') finaleToSeal(); });
  }

  function playFinale() {
    if (finaleRunning) return;
    finaleRunning = true;
    ensureFinaleDom();
    const F = $('finale'), art = $('finale-art');
    const finaleSrcset = window.ART_SRCSET && window.ART_SRCSET['finale-art'];
    if (finaleSrcset) { art.sizes = '100vw'; art.srcset = finaleSrcset; }
    art.src = window.ART['finale-art'];
    F.dataset.ready = 'false'; F.hidden = false;
    gsap.set(F, { opacity: 1 });
    gsap.set(art, { opacity: 0 });
    gsap.set('#finale-text span', { opacity: 0, y: 0, filter: 'none' });
    gsap.set('#finale-hint', { opacity: 0 });
    gsap.set('#finale-text .w path', { strokeDashoffset: 90 });
    haptic([10, 40, 10]);
    const tl = gsap.timeline();
    tl.to(['#story', 'header'], { opacity: 0, duration: .9, ease: 'power1.out' }, 0);
    tl.to(art, { opacity: 1, duration: 3.6, ease: 'power1.inOut' }, .6);
    const col1 = '#finale-text p:nth-child(1) span', col2 = '#finale-text p:nth-child(2) span';
    const n1 = FINALE_LINES[0].length;
    const at = 3.3;
    // 只做从上到下的逐字显影，一列结束再下一列；不位移、不模糊。
    tl.to(col1, { opacity: 1, duration: .16, ease: 'none', stagger: .16 }, at);
    const col2At = at + n1 * .16 + .22;
    tl.to(col2, { opacity: 1, duration: .16, ease: 'none', stagger: .16 }, col2At);
    tl.to('#finale-text .w path', { strokeDashoffset: 0, duration: .6, ease: 'power1.out' }, col2At + (FINALE_LINES[1].length - 1) * .16 + .1);
    const done = col2At + FINALE_LINES[1].length * .16 + .35;
    tl.call(() => { F.dataset.ready = 'true'; }, [], done);
    tl.to('#finale-hint', { opacity: .5, duration: 1.4, ease: 'power1.out' }, done + 1.6);
  }

  async function finaleToSeal() {
    const F = $('finale');
    if (F.dataset.ready !== 'true') return;
    F.dataset.ready = 'false';
    haptic([14, 60, 10]);
    await sealReady;
    const W = innerWidth, H = innerHeight;
    // 1 把当前这一屏（明亮的画 + 字）画进一张画布，按格取色
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const snap = document.createElement('canvas');
    snap.width = Math.round(W * ratio); snap.height = Math.round(H * ratio);
    const sc = snap.getContext('2d');
    sc.setTransform(ratio, 0, 0, ratio, 0, 0);
    const art = $('finale-art');
    const op = (getComputedStyle(art).objectPosition || '50% 50%').split(' ').map((v) => parseFloat(v) / 100);
    const sw = art.naturalWidth || 1600, sh = art.naturalHeight || 900;
    const k = Math.max(W / sw, H / sh);
    sc.drawImage(art, (W - sw * k) * op[0], (H - sh * k) * (op[1] == null ? .5 : op[1]), sw * k, sh * k);
    F.querySelectorAll('#finale-text span').forEach((s) => {
      const r = s.getBoundingClientRect(), cs = getComputedStyle(s);
      if (s.classList.contains('w')) {
        sc.save(); sc.translate(r.left, r.top + r.height * .1); sc.scale(r.width / 34, r.width / 34);
        sc.strokeStyle = cs.color; sc.lineWidth = 3.6; sc.lineCap = 'round'; sc.lineJoin = 'round';
        sc.stroke(new Path2D('M3 5.5 C4 22 12 24.5 16.5 11.5 C21 24.5 29.5 22 31 4.5')); sc.restore();
        return;
      }
      sc.font = cs.fontSize + ' ' + cs.fontFamily; sc.fillStyle = cs.color; sc.textAlign = 'center'; sc.textBaseline = 'middle';
      sc.fillText(s.textContent, r.left + r.width / 2, r.top + r.height / 2 + parseFloat(cs.fontSize) * .04);
    });
    // 2 先把封面铺在下面（被明亮的画盖着，看不见），量出印章的位置；封面只留印章
    resetEntry();
    document.body.classList.add('finale-end');
    showScreen('cover');
    gsap.set(['#story', 'header'], { clearProps: 'opacity' });
    $('entry-seal').style.opacity = '0';
    const rect = $('entry-seal').getBoundingClientRect();
    const sampled = document.createElement('canvas');
    sampled.width = Math.round(rect.width); sampled.height = Math.round(rect.height);
    const sx = sampled.getContext('2d', { willReadFrequently: true });
    const srcW = W <= 760 ? 490 : 550, srcH = srcW * sealImage.height / sealImage.width;
    sx.drawImage(sealImage, (rect.width - srcW) / 2, (rect.height - srcH) * .52, srcW, srcH);
    const td = sx.getImageData(0, 0, sampled.width, sampled.height).data;
    const targets = [];
    for (let y = 0; y < sampled.height; y += 2) for (let x = 0; x < sampled.width; x += 2) {
      const i = (y * sampled.width + x) * 4;
      if (td[i] <= 105 || td[i] <= td[i + 1] * 1.45 || td[i + 1] >= 155) continue;
      targets.push([rect.left + x, rect.top + y, td[i], td[i + 1], td[i + 2]]);
    }
    let rs = 20261109;
    const rnd = () => ((rs = (rs * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = targets.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [targets[i], targets[j]] = [targets[j], targets[i]]; }
    // 3 粒子：每一格一粒，起点是它在画面里的位置，终点是印章上的某一点
    // 像素化的终点格子 = 粒子的起始格子，两段首尾相接；格子取得更细（约 1.3 万粒）
    const step = Math.max(4, Math.round(Math.sqrt(W * H / 13000)));
    const cols = Math.ceil(W / step), rows = Math.ceil(H / step);
    const cell = document.createElement('canvas'); cell.width = cols; cell.height = rows;
    const cx0 = cell.getContext('2d', { willReadFrequently: true }); cx0.imageSmoothingQuality = 'high';
    cx0.drawImage(snap, 0, 0, W * ratio, H * ratio, 0, 0, cols, rows);
    const sd = cx0.getImageData(0, 0, cols, rows).data;
    const PD = 1.5; // 先从清晰一点点变粗，再散开
    const P = [];
    for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) {
      const i = ((y / step | 0) * cols + (x / step | 0)) * 4;
      const t = targets[P.length % Math.max(1, targets.length)] || [W / 2, H / 2, 168, 64, 46];
      const jx = (rnd() - .5) * 1.4, jy = (rnd() - .5) * 1.4;
      const mx = (x + step / 2 + t[0]) / 2 + (rnd() - .5) * W * .42, my = (y + t[1]) / 2 + (rnd() - .5) * H * .42 - H * .08;
      P.push({ x0: x + step / 2, y0: y + step / 2, x1: t[0] + jx, y1: t[1] + jy, cx: mx, cy: my, r0: sd[i], g0: sd[i + 1], b0: sd[i + 2], r1: t[2], g1: t[3], b1: t[4], d: PD + (y / H) * .95 + rnd() * .55, dur: 1.9 + rnd() * 1.0 });
    }
    const canvas = $('finale-canvas');
    canvas.width = W * ratio; canvas.height = H * ratio;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const clamp = (v) => Math.max(0, Math.min(1, v));
    const ease = (u) => (u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
    const T = { t: 0, fade: 0 };
    const tmp = document.createElement('canvas'); tmp.width = cols * step + step; tmp.height = rows * step + step;
    const tx = tmp.getContext('2d'); tx.imageSmoothingQuality = 'high';
    const paint = () => {
      ctx.clearRect(0, 0, W, H);
      if (T.t < PD) {
        // 清晰 → 逐级变粗：块边长从 1 指数增长到 step
        const b = Math.pow(step, ease(clamp(T.t / PD)));
        if (b < 1.4) { ctx.imageSmoothingEnabled = true; ctx.drawImage(snap, 0, 0, W, H); return; }
        const c2 = Math.ceil(W / b), r2 = Math.ceil(H / b);
        tx.clearRect(0, 0, c2 + 1, r2 + 1);
        tx.drawImage(snap, 0, 0, W * ratio, H * ratio, 0, 0, W / b, H / b);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tmp, 0, 0, c2, r2, 0, 0, c2 * b, r2 * b);
        ctx.imageSmoothingEnabled = true;
        return;
      }
      ctx.globalAlpha = 1 - T.fade;
      for (const p of P) {
        const u = clamp((T.t - p.d) / p.dur), e = ease(u), m = 1 - e;
        const x = m * m * p.x0 + 2 * m * e * p.cx + e * e * p.x1, y = m * m * p.y0 + 2 * m * e * p.cy + e * e * p.y1;
        const s = u <= 0 ? step + .6 : Math.max(2.1, (step + .6) * (1 - Math.min(1, u * 3.2)) + 2.1);
        const c = clamp((u - .45) / .5);
        ctx.fillStyle = 'rgb(' + ((p.r0 + (p.r1 - p.r0) * c) | 0) + ',' + ((p.g0 + (p.g1 - p.g0) * c) | 0) + ',' + ((p.b0 + (p.b1 - p.b0) * c) | 0) + ')';
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
    };
    paint();
    canvas.hidden = false;
    F.hidden = true;
    const total = PD + 0.95 + .55 + 2.9;
    const tl = gsap.timeline();
    tl.to(T, { t: total, duration: total, ease: 'none', onUpdate: paint }, 0);
    tl.to(T, { fade: 1, duration: .8, ease: 'power1.inOut', onUpdate: paint }, total - .45);
    tl.to('#entry-seal', { opacity: 1, duration: .8, ease: 'power1.inOut' }, total - .45);
    tl.call(() => { canvas.hidden = true; }, [], total + .5);
    const opts = $('finale-opts');
    opts.hidden = false; gsap.set(opts, { opacity: 0 });
    tl.to(opts, { opacity: 1, duration: 1.1, ease: 'power1.out' }, total + .35 + 2);
  }

  function finaleExit() {
    try { window.close(); } catch (e) { /* 浏览器不让关就停在这里 */ }
    gsap.to(['#entry-seal', '#finale-opts'], { opacity: 0, duration: 1.4, ease: 'power1.inOut' });
    const bye = $('finale-bye');
    bye.hidden = false; gsap.fromTo(bye, { opacity: 0 }, { opacity: 1, duration: 1.6, delay: 1.2, ease: 'power1.out' });
  }

  function finaleAgain() {
    finaleRunning = false;
    goldToken++;
    $('finale-opts').hidden = true; $('finale-bye').hidden = true;
    document.body.classList.remove('finale-end', 'finale');
    resetEntry();
    gsap.set(['#story', 'header', '#finale-opts', '#finale-bye'], { clearProps: 'opacity' });
    showScreen('cover');
    setScene('opening');
  }

  // 八个字的书法字形（与金字同一套），结局页直接摆出来
  function eightGrid(pre) {
    const keys = ['year', 'month', 'day', 'hour'], names = ['年', '月', '日', '时'];
    const glyph = (char, id) => {
      const d = window.FIRE_GLYPHS && window.FIRE_GLYPHS[char];
      if (!d) return `<span class="eight-fallback">${char}</span>`;
      return `<svg viewBox="40 -60 960 960" aria-label="${char}"><defs><linearGradient id="eg-${id}" x2=".4" y2="1"><stop stop-color="#fff0b6"/><stop offset=".5" stop-color="#efb866"/><stop offset="1" stop-color="#a66030"/></linearGradient></defs><g transform="translate(0 840) scale(1 -1)"><path d="${d}" fill="url(#eg-${id})"/></g></svg>`;
    };
    return '<div class="eight-grid">'
      + keys.map((k, i) => { const gz = Array.from(result.chart.pillars[k].ganzhi); return `<div class="eight-col">${glyph(gz[0], pre + i + 'a')}${glyph(gz[1], pre + i + 'b')}<i>${names[i]}</i></div>`; }).join('')
      + '</div>';
  }
  function renderEightInline() {
    const box = $('ending-actions'); if (!box || typeof result === 'undefined' || !result || !result.chart) return;
    let el = $('eight-inline');
    if (!el) { el = document.createElement('div'); el.id = 'eight-inline'; box.parentNode.insertBefore(el, box); }
    el.innerHTML = '<p class="eight-title">最初的八个字</p>' + eightGrid('in');
    gsap.fromTo('#eight-inline .eight-col', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: .7, ease: 'power2.out', stagger: .09, delay: .2 });
  }

  // ── 再看最初的八个字：不再重放燃烧，直接把八个字摆出来（用的是金字同一套书法字形）──
  function showEight() {
    let el = $('eight');
    if (!el) {
      el = document.createElement('div');
      el.id = 'eight'; el.hidden = true;
      document.body.append(el);
      el.addEventListener('click', () => {
        gsap.to(el, { opacity: 0, duration: .4, ease: 'power1.in', onComplete: () => { el.hidden = true; } });
      });
    }
    el.innerHTML = '<p class="eight-title">最初的八个字</p>' + eightGrid('ov') + '<p class="eight-hint">轻 点 合 上</p>';
    el.hidden = false;
    gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: .45, ease: 'power1.out' });
    gsap.fromTo('#eight .eight-col', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .7, ease: 'power2.out', stagger: .09, delay: .12 });
  }


  $('birth-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    const knownCity = cities.find((city) => city.name === $('city').value.trim());
    const advanced = document.querySelector('.advanced');
    if (!knownCity && !advanced.open) { advanced.open = true; $('form-error').textContent = '请确认出生地的经纬度后，再展开人生。'; return; }
    if (!window.BAZI) {
      $('form-error').textContent = '正在准备排盘…';
      try { await loadBazi(); } catch (error) { $('form-error').textContent = '排盘脚本加载失败，请检查网络后重试。'; return; }
    }
    let quick;
    const input = inputOf();
    try { quick = bazi().core.compute(input); } catch (error) { $('form-error').textContent = error.message; return; }
    if (quick.error) { $('form-error').textContent = quick.error; return; }
    const today = singaporeToday();
    const todayString = `${today.year}-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`;
    if (quick.clock.slice(0, 10) > todayString) { $('form-error').textContent = '请选择已经发生的出生日期。'; return; }
    busy = true;
    $('form-error').textContent = '';
    $('calculate').disabled = true;
    $('calculate').textContent = '正在展开时间…';
    try {
      const data = await compute(input);
      if (data.result.error) throw new Error(data.result.error);
      result = data.result;
      choices = {};
      nodes = LifeStory.create(result);
      pageIndex = 0;
      $('timeline-buttons').innerHTML = nodes.map((node, index) => `<button data-index="${index}" aria-label="${node.chapter}">${node.ch}</button>`).join('');
      $('chapter-list').innerHTML = nodes.map((node, index) => `<button data-index="${index}">${String(index + 1).padStart(2, '0')} · ${escape(node.chapter)}<small>${node.year ? `${node.year}年 · ${node.age}岁 · ${node.label}` : escape(node.head)}</small></button>`).join('');
      $('report-content').innerHTML = result.report.sections.map((section) => `<section class="report-section"><h3>${escape(section.title)}</h3>${section.items.map(itemHtml).join('')}</section>`).join('');
      preloadArt('opening');
      inscription();
    } catch (error) { $('form-error').textContent = `推演没有完成。${error.message}`; }
    finally { busy = false; $('calculate').disabled = false; $('calculate').innerHTML = '展开我的平行人生 <span>↗</span>'; }
  });

  let entryActive = false;
  let entryRun = 0;
  let entryTimeline;
  const sealImage = new Image();
  const sealReady = new Promise(resolve => { sealImage.onload = resolve; sealImage.onerror = resolve; });
  sealImage.src = window.ART['seal-reference'];

  function resetEntry() {
    entryRun++;
    entryActive = false;
    entryTimeline?.kill();
    entryTimeline = null;
    $('entry-canvas').hidden = true;
    gsap.set(['#cover', '#entry-seal', '#entry-caption', '#begin', '.birth-copy', '.form-wrap'], { clearProps:'opacity,transform,filter' });
    $('begin').disabled = false;
    $('begin').innerHTML = '启 卷 <span>↗</span>';
  }

  function finishEntry() {
    resetEntry();
    showScreen('birth');
    setScene('childhood');
    syncBirthReels();
    // 填表这段时间通常有十几秒：趁空闲把排盘引擎和字形文件悄悄下好，点“展开”时就不用等
    setTimeout(() => { loadBazi().catch(() => {}); loadGlyphs(); }, 1200);
  }

  let entryMorphCache = null;
  let entryMorphBuilding = null;
  async function buildEntryMorph() {
    const albumKey = innerWidth <= 760 ? 'album-mobile' : 'album-desktop';
    const albumEl = document.querySelector('.album-art img');
    const W = innerWidth, H = innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    if (albumEl) albumEl.loading = 'eager';
    try { await document.fonts.ready; } catch (_) { /* 字体就绪后再取文字位置 */ }
    await Promise.all([sealReady, preloadArt(albumKey)]);

    let source = albumEl;
    if (!source || !source.complete || !source.naturalWidth) {
      source = new Image();
      source.src = window.ART[albumKey];
      try { await source.decode(); } catch (_) { /* 已缓存失败时继续用底色 */ }
    }
    const target = document.createElement('canvas');
    target.width = Math.round(W * ratio); target.height = Math.round(H * ratio);
    const tc = target.getContext('2d');
    tc.setTransform(ratio, 0, 0, ratio, 0, 0);
    tc.fillStyle = '#f4eedf'; tc.fillRect(0, 0, W, H);
    const stageW = Math.max(W, 1.7777778 * H);
    const stageH = Math.max(H, .5625 * W);
    if (source && source.naturalWidth) tc.drawImage(source, (W - stageW) / 2, (H - stageH) / 2, stageW, stageH);
    // 像片尾那样连标题/扉页文字一起取样，不是只拼一张空相册
    const birth = $('birth');
    const copy = document.querySelector('.birth-copy');
    const wasHidden = birth.hidden;
    const copyOpacity = copy ? copy.style.opacity : '';
    birth.hidden = false;
    if (copy) copy.style.opacity = '1';
    try { paintDom(tc, [document.querySelector('header'), copy].filter(Boolean)); } catch (_) { /* 忽略 */ }
    birth.hidden = wasHidden;
    if (copy) copy.style.opacity = copyOpacity;

    const step = Math.max(4, Math.round(Math.sqrt(W * H / 13000)));
    const cols = Math.ceil(W / step), rows = Math.ceil(H / step);
    const cell = document.createElement('canvas'); cell.width = cols; cell.height = rows;
    const cc = cell.getContext('2d', { willReadFrequently: true });
    cc.imageSmoothingQuality = 'high';
    cc.drawImage(target, 0, 0, W * ratio, H * ratio, 0, 0, cols, rows);
    const td = cc.getImageData(0, 0, cols, rows).data;

    const rect = $('entry-seal').getBoundingClientRect();
    const sampled = document.createElement('canvas');
    sampled.width = Math.max(1, Math.round(rect.width));
    sampled.height = Math.max(1, Math.round(rect.height));
    const sc = sampled.getContext('2d', { willReadFrequently: true });
    const sourceWidth = W <= 760 ? 490 : 550;
    const sourceHeight = sourceWidth * sealImage.height / sealImage.width;
    sc.drawImage(sealImage, (rect.width - sourceWidth) / 2, (rect.height - sourceHeight) * .52, sourceWidth, sourceHeight);
    const sd = sc.getImageData(0, 0, sampled.width, sampled.height).data;
    const starts = [];
    for (let y = 0; y < sampled.height; y += 2) for (let x = 0; x < sampled.width; x += 2) {
      const i = (y * sampled.width + x) * 4;
      if (sd[i] <= 105 || sd[i] <= sd[i + 1] * 1.45 || sd[i + 1] >= 155) continue;
      starts.push({ x: rect.left + x, y: rect.top + y, r: sd[i], g: sd[i + 1], b: sd[i + 2] });
    }
    if (!starts.length) starts.push({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, r: 190, g: 60, b: 45 });
    let rs = 20261110;
    const rnd = () => ((rs = (rs * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = starts.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [starts[i], starts[j]] = [starts[j], starts[i]]; }

    const P = [];
    let n = 0;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      const s = starts[n % starts.length]; n++;
      const tx = x * step + step / 2, ty = y * step + step / 2;
      const mx = (s.x + tx) / 2 + (rnd() - .5) * W * .42;
      const my = (s.y + ty) / 2 + (rnd() - .5) * H * .42 - H * .08;
      P.push({ sx: s.x, sy: s.y, tx, ty, cx: mx, cy: my,
        sr: s.r, sg: s.g, sb: s.b, tr: td[i], tg: td[i + 1], tb: td[i + 2], d: rnd() * .16 });
    }
    return { key: albumKey, W, H, ratio, target, step, P };
  }

  async function prepareEntryMorph() {
    const key = innerWidth <= 760 ? 'album-mobile' : 'album-desktop';
    const W = innerWidth, H = innerHeight;
    if (entryMorphCache && entryMorphCache.key === key && entryMorphCache.W === W && entryMorphCache.H === H) return entryMorphCache;
    if (entryMorphBuilding) {
      const value = await entryMorphBuilding;
      if (value && value.key === key && value.W === W && value.H === H) return value;
    }
    entryMorphBuilding = buildEntryMorph().then((value) => {
      entryMorphCache = value;
      return value;
    }).finally(() => { entryMorphBuilding = null; });
    return entryMorphBuilding;
  }

  async function playEntry() {
    if (entryActive) return;
    const albumKey = innerWidth <= 760 ? 'album-mobile' : 'album-desktop';
    const albumEl = document.querySelector('.album-art img');
    if (reduced) { await preloadArt(albumKey); return finishEntry(); }
    entryActive = true;
    const run = ++entryRun;
    $('begin').disabled = true;
    if (albumEl) albumEl.loading = 'eager';
    await Promise.all([sealReady, preloadArt(albumKey)]);
    if (!entryActive || run !== entryRun) return;

    const prep = await prepareEntryMorph().catch(() => null);
    if (!entryActive || run !== entryRun) return;
    if (!prep) { finishEntry(); return; }
    const { W, H, ratio, target, step, P } = prep;
    const canvas = $('entry-canvas');
    canvas.hidden = false; canvas.style.opacity = '1';
    canvas.width = Math.round(W * ratio); canvas.height = Math.round(H * ratio);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const clamp = (v) => Math.max(0, Math.min(1, v));
    const ease = (u) => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    const state = { p: 0, r: 0 };
    const tmp = document.createElement('canvas');
    const tx = tmp.getContext('2d');
    const paint = () => {
      const p = state.p, r = state.r;
      ctx.clearRect(0, 0, W, H);
      $('entry-seal').style.opacity = String(1 - clamp((p - .18) / .5));
      if (p >= 1) {
        // 反向复刻片尾的 1.5 秒像素化前奏：从整格像素页逐级还原到清晰页
        const b = Math.max(1, Math.pow(step, 1 - ease(clamp(r))));
        if (b <= 1.4) {
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(target, 0, 0, target.width, target.height, 0, 0, W, H);
        } else {
          const c2 = Math.ceil(W / b), r2 = Math.ceil(H / b);
          tmp.width = c2; tmp.height = r2;
          tx.clearRect(0, 0, c2, r2);
          tx.imageSmoothingQuality = 'high';
          tx.drawImage(target, 0, 0, target.width, target.height, 0, 0, c2, r2);
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(tmp, 0, 0, c2, r2, 0, 0, W, H);
          ctx.imageSmoothingEnabled = true;
        }
        return;
      }
      for (const q of P) {
        const local = clamp((p - q.d) / (1 - q.d || 1));
        const ee = ease(local), m = 1 - ee;
        const x = m * m * q.sx + 2 * m * ee * q.cx + ee * ee * q.tx;
        const y = m * m * q.sy + 2 * m * ee * q.cy + ee * ee * q.ty;
        const c = clamp((local - .45) / .5);
        const size = 2.1 + (step + .6 - 2.1) * ee;
        ctx.fillStyle = `rgb(${(q.sr + (q.tr - q.sr) * c) | 0},${(q.sg + (q.tg - q.sg) * c) | 0},${(q.sb + (q.tb - q.sb) * c) | 0})`;
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      }
    };
    paint();
    gsap.set(['.birth-copy', '.form-wrap'], { opacity: 0, y: 8 });
    entryTimeline = gsap.timeline({ onUpdate: paint, onComplete: finishEntry });
    entryTimeline.to(['#entry-caption', '#begin'], { opacity: 0, duration: .4 }, 0);
    entryTimeline.to(state, { p: 1, duration: 4.4, ease: 'none' }, 0);
    entryTimeline.call(() => { showScreen('birth'); }, [], 4.4);
    entryTimeline.to(state, { r: 1, duration: 1.5, ease: 'power1.inOut' }, 3.9);
    entryTimeline.to(canvas, { opacity: 0, duration: .7, ease: 'power1.inOut' }, 5.2);
    entryTimeline.to('.birth-copy', { opacity: 1, y: 0, duration: .6, ease: 'power2.out' }, 5.2);
    entryTimeline.to('.form-wrap', { opacity: 1, y: 0, duration: .8, ease: 'power2.out' }, 5.3);
    entryTimeline.to({}, { duration: .2 });
  }

  function syncBirthReels(direction=0, activeId=null) {
    for(const id of ['year','month','day','hour','minute','exam']) {
      const select=$(id),viewport=$('reel-'+id);
      if(!viewport) continue;
      const selected=select.selectedIndex;
      const track=viewport.firstElementChild;
      const signature = [select.selectedIndex, ...Array.from(select.options).slice(Math.max(0, selected-2), selected+3).map(option => option.textContent)].join('|');
      if (track.dataset.signature === signature) continue;
      track.dataset.signature = signature;
      track.replaceChildren();
      for(let offset=-2;offset<=2;offset++) {
        const row=document.createElement('div');
        const option=select.options[selected+offset];
        row.className='reel-row'+(offset===0?' selected':'');
        row.textContent=option?option.textContent.replace(' 时',''):'';
        track.append(row);
      }
      viewport.setAttribute('aria-valuemin','0');
      viewport.setAttribute('aria-valuemax',String(select.options.length-1));
      viewport.setAttribute('aria-valuenow',String(selected));
      viewport.setAttribute('aria-valuetext',select.options[selected]?.textContent||'');
      if(direction && id === activeId && !reduced) gsap.fromTo(track,{y:direction*12,opacity:.65},{y:0,opacity:1,duration:.26,ease:'power2.out',overwrite:true});
    }
  }

  function stepBirthReel(id,delta) {
    const select=$(id);
    const index=Math.max(0,Math.min(select.options.length-1,select.selectedIndex+delta));
    if(index===select.selectedIndex) return;
    select.selectedIndex=index;
    select.dispatchEvent(new Event('change',{bubbles:true}));
    syncBirthReels(delta,id);
  }

  function createBirthReels() {
    for(const id of ['year','month','day','hour','minute','exam']) {
      const select=$(id),label=select.getAttribute('aria-label');
      const shell=document.createElement('div');shell.className='birth-reel';
      const up=document.createElement('button');up.type='button';up.className='reel-arrow';up.textContent='⌃';up.setAttribute('aria-label',label+'上一个');
      const down=document.createElement('button');down.type='button';down.className='reel-arrow';down.textContent='⌄';down.setAttribute('aria-label',label+'下一个');
      const viewport=document.createElement('div');viewport.id='reel-'+id;viewport.className='reel-viewport';viewport.tabIndex=0;viewport.setAttribute('role','spinbutton');viewport.setAttribute('aria-label',label);
      const track=document.createElement('div');track.className='reel-track';viewport.append(track);
      shell.append(up,viewport,down);select.after(shell);select.classList.add('reel-native');select.tabIndex=-1;
      up.addEventListener('click',()=>stepBirthReel(id,-1));down.addEventListener('click',()=>stepBirthReel(id,1));
      viewport.addEventListener('keydown',event=>{if(['ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();stepBirthReel(id,event.key==='ArrowDown'?1:-1);}});
      let lastWheel=0;
      viewport.addEventListener('wheel',event=>{event.preventDefault();if(performance.now()-lastWheel>90){stepBirthReel(id,event.deltaY>0?1:-1);lastWheel=performance.now();}},{passive:false});
      viewport.addEventListener('pointerdown',event=>{
        viewport.setPointerCapture(event.pointerId);let priorY=event.clientY;
        const move=event=>{const delta=priorY-event.clientY;if(Math.abs(delta)>25){stepBirthReel(id,delta>0?1:-1);priorY=event.clientY;}};
        const end=()=>{viewport.removeEventListener('pointermove',move);viewport.removeEventListener('pointerup',end);viewport.removeEventListener('pointercancel',end);};
        viewport.addEventListener('pointermove',move);viewport.addEventListener('pointerup',end);viewport.addEventListener('pointercancel',end);
      });
    }
    $('birth-form').addEventListener('change',()=>queueMicrotask(()=>syncBirthReels()));
    syncBirthReels();
  }
  (function examSetup() {
    const sel = $('exam');
    const base = () => { const y = Number($('year').value) || 2000, mo = Number($('month').value) || 1; return y + 18 + (mo >= 9 ? 1 : 0); };
    const fill = () => {
      const r = base();
      sel.innerHTML = [-3, -2, -1, 0, 1, 2, 3].map((d) => '<option value="' + (r + d) + '"' + (d === 0 ? ' selected' : '') + '>' + (r + d) + '</option>').join('') + '<option value="x">没参加</option>';
      sel.selectedIndex = 3;
    };
    fill();
    $('birth-form').addEventListener('change', (e) => { if (['year', 'month', 'day'].includes(e.target.id)) fill(); });
    window.__examOpt = () => { if (sel.value === 'x') return { noExam: true }; const r = base(); return Number(sel.value) === r ? {} : { examYear: Number(sel.value) }; };
  })();
  createBirthReels();
  function setupAlbumForm() {
    const form = $('birth-form');
    const fields = [...form.children].filter(el => el.classList.contains('field'));
    const caption = form.querySelector('.form-caption'), advanced = form.querySelector('.advanced');
    const note = [...form.children].find(el => el.classList.contains('footnote'));
    const status = $('form-error'), calculate = $('calculate');
    let step = 1, turningPage = false;
    const sections = [1,2,3].map(n => { const el = document.createElement('section'); el.className='album-step'; el.dataset.step=n; return el; });
    sections[0].append(fields[0], fields[1]); sections[1].append(fields[2], fields[3]); sections[2].append(fields[4], fields[5], advanced);
    if(note) sections[2].append(note);
    const footer=document.createElement('nav'); footer.className='album-navigation'; footer.setAttribute('aria-label','填写生辰的步骤');
    footer.innerHTML='<button id="album-back" type="button">← 上一步</button><span id="album-page-number"></span><button id="album-next" type="button">继续填写时辰 →</button>';
    const content=document.createElement('div'); content.className='album-page-content'; content.append(caption,...sections,status);
    form.replaceChildren(content,footer,calculate); form.dataset.writingMode='reel';
    fields[3].classList.add('album-gender'); fields[3].querySelector('.field-label').textContent='你的称谓 · 请点选';
    fields[3].querySelectorAll('input').forEach(el=>{el.checked=false;el.required=false;});
    fields[3].querySelectorAll('.segmented label').forEach(label=>{
      const mark=document.createElement('span');mark.className='pencil-choice';mark.setAttribute('aria-hidden','true');
      mark.innerHTML='<svg viewBox="0 0 28 28"><path d="M4 15 L10 22 L24 5" fill="none" stroke="#605b50" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 15.5 L10.5 21 L23 6" fill="none" stroke="#777064" stroke-opacity=".5" stroke-width=".65" stroke-linecap="round"/></svg>';
      label.insertBefore(mark,label.firstChild);
    });
    const summary=document.createElement('p'); summary.id='album-summary'; sections[2].prepend(summary);
    function updateRecord(){
      const gender=document.querySelector('[name=gender]:checked');
      const date=['year','month','day'].map(id=>$(id).selectedOptions[0]?.textContent).join(' ');
      $('album-record').textContent=date+' · '+(calendar==='solar'?'阳历':'农历');
      summary.textContent=$('album-record').textContent+' · '+['hour','minute'].map(id=>$(id).selectedOptions[0]?.textContent).join(' ')+' · 北京时间 · '+(gender?(gender.value==='F'?'女 · 坤造':'男 · 乾造'):'请选择称谓');
    }
    function render(number){
      step=number; sections.forEach((el,i)=>el.hidden=i+1!==step); form.dataset.albumStep=step;
      $('album-back').hidden=step===1; $('album-next').hidden=step===3; calculate.hidden=step!==3;
      caption.textContent=['翻开诞生的那天','留下一刻光阴','从这里，出发'][step-1]; { const h2=document.querySelector('#birth .birth-copy h2'); if(h2){ const t=['这一页，<br>写下你。','这一页，<br>写下时辰。','这一页，<br>写下来处。'][step-1]; if(h2.innerHTML!==t){ if(window.gsap){ gsap.killTweensOf(h2); gsap.fromTo(h2,{opacity:0,y:6},{opacity:1,y:0,duration:.55,ease:'power1.out'}); } h2.innerHTML=t; } } }
      $('album-next').textContent=step===1?'继续填写时辰 →':'继续填写出生地 →';
      $('album-page-number').textContent=String(step).padStart(2,'0')+' / 03'; status.textContent='';
      content.scrollTop=0; updateRecord();
    }
    async function showStep(number){
      if(turningPage||number===step)return;
      if(reduced){render(number);return;}
      turningPage=true;
      await gsap.to(content,{opacity:0,duration:.14,ease:'power1.out'});
      render(number);
      await gsap.to(content,{opacity:1,duration:.24,ease:'power1.out'});
      turningPage=false;
    }
    function next(){
      if(step===2&&!document.querySelector('[name=gender]:checked')){status.textContent='请点选男或女，再继续。';fields[3].classList.add('needs-gender');return;}
      showStep(Math.min(3,step+1));
    }
    $('album-next').addEventListener('click',next); $('album-back').addEventListener('click',()=>showStep(Math.max(1,step-1)));
    form.addEventListener('change',event=>{if(event.target.name==='gender'){fields[3].classList.remove('needs-gender');status.textContent='';}updateRecord();});
    form.addEventListener('submit',event=>{if(step<3||turningPage){event.preventDefault();event.stopImmediatePropagation();if(!turningPage)next();}},true);
    render(1);syncBirthReels();
    window.__album={get step(){return step;},get mode(){return 'reel';},get turning(){return turningPage;}};
  }
  setupAlbumForm();



  $('begin').addEventListener('click', () => { haptic([14, 70, 10]); playEntry(); });
  ['year', 'month', 'day', 'hour', 'minute'].forEach((id) => $(id).addEventListener('change', () => haptic(5)));
  $('edit').addEventListener('click', () => { showScreen('birth'); $('reel-year').focus({ preventScroll: true }); });
  $('home').addEventListener('click', (event) => { event.preventDefault(); if (!busy) { goldToken++; resetEntry(); showScreen('cover'); setScene('opening'); } });
  $('gold-skip').addEventListener('click', revealGold);
  $('gold-continue').addEventListener('click', () => { if (burnRunning || !result) return; goldToken++; burnToStory(() => { showScreen('story'); showNode(1, { instant: true }); }); });
  $('next').addEventListener('click', () => { if (pageIndex === nodes.length - 1) playFinale(); else goTo(pageIndex + 1); });
  $('previous').addEventListener('click', () => goTo(pageIndex - 1));
  $('echo-gold').addEventListener('click', () => showEight());
  $('download').addEventListener('click', download);
  $('open-chapters').addEventListener('click', () => $('chapters-dialog').showModal());
  document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => $(button.dataset.close).close()));
  [$('timeline-buttons'), $('chapter-list')].forEach((list) => list.addEventListener('click', (event) => {
    const button = event.target.closest('[data-index]');
    if (!button) return;
    if ($('chapters-dialog').open) $('chapters-dialog').close();
    goTo(Number(button.dataset.index));
  }));
  document.addEventListener('keydown', (event) => {
    if ($('story').hidden || document.querySelector('dialog[open]') || /INPUT|SELECT|BUTTON|SUMMARY/.test(event.target.tagName)) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); goTo(pageIndex + 1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(pageIndex - 1); }
  });
  // ── 触感与生命感 ──
  // 震动（安卓/部分浏览器）、点按涟漪、跟手滑动、镜头缓慢漂移与视差、数字滚动、火星般的时间轴光点。
  const canVibrate = typeof navigator.vibrate === 'function';
  function haptic(pattern) { if (reduced || !canVibrate) return; try { navigator.vibrate(pattern); } catch (_) { /* 忽略 */ } }
  // 点按涟漪 + 按钮轻震
  document.addEventListener('pointerdown', (event) => {
    if (reduced) return;
    const t = event.target;
    if (t.closest && t.closest('input,select,textarea,dialog')) return;
    const r = document.createElement('i'); r.className = 'ripple';
    r.style.left = event.clientX + 'px'; r.style.top = event.clientY + 'px';
    document.body.append(r); setTimeout(() => r.remove(), 800);
    if (t.closest && t.closest('button,summary,label')) haptic(7);
  }, { passive: true });

  // 镜头漂移（CSS 变量 --cx/--cy 由 rAF 写入）：缓慢呼吸 + 手指/鼠标/重力的视差
  const drift = { dragX: 0, tx: 0, ty: 0, mx: 0, my: 0, gx: 0, gy: 0 };
  addEventListener('pointermove', (event) => { if (event.pointerType === 'mouse') { drift.mx = (event.clientX / innerWidth - .5) * 16; drift.my = (event.clientY / innerHeight - .5) * 9; } }, { passive: true });
  addEventListener('deviceorientation', (event) => { if (event.gamma == null) return; drift.gx = Math.max(-1, Math.min(1, event.gamma / 25)) * 7; drift.gy = Math.max(-1, Math.min(1, ((event.beta || 45) - 50) / 25)) * 4; }, { passive: true });
  let driftFrame = 0;
  function driftLoop(now) {
    driftFrame = 0;
    if (reduced || document.body.dataset.screen !== 'story' || document.hidden) return;
    const t = now / 1000;
    const gx = Math.sin(t * .23) * 4.5 + Math.sin(t * .09 + 1) * 3, gy = Math.cos(t * .17) * 2.6;
    drift.tx += ((gx + drift.mx + drift.gx - drift.dragX * .09) - drift.tx) * .06;
    drift.ty += ((gy + drift.my + drift.gy) - drift.ty) * .06;
    document.body.style.setProperty('--cx', drift.tx.toFixed(2));
    document.body.style.setProperty('--cy', drift.ty.toFixed(2));
    driftFrame = requestAnimationFrame(driftLoop);
  }
  function startDrift() { if (!driftFrame && !reduced) driftFrame = requestAnimationFrame(driftLoop); }
  function stopDrift() { if (driftFrame) { cancelAnimationFrame(driftFrame); driftFrame = 0; } }

  // 数字滚动：翻到下一站时，年份与年龄像时间一样滚过去
  const roll = { year: null, age: 0, raf: 0 };
  function rollWhen(el, node) {
    cancelAnimationFrame(roll.raf);
    if (!node.year) { el.textContent = node.key === 'origin' ? '生辰落定的一刻' : '一生走完，回头看'; if (node.key === 'origin') { roll.year = +result.chart.clock.slice(0, 4); roll.age = 0; } return; }
    const y0 = roll.year ?? node.year, a0 = roll.age;
    const set = (y, a, done) => { el.textContent = `${Math.round(y)} · ${done ? node.gz : '··'} · ${Math.round(a)}岁`; };
    roll.year = node.year; roll.age = node.age;
    if (reduced || y0 === node.year) { set(node.year, node.age, true); return; }
    const t0 = performance.now(), dur = 780;
    (function step(now) {
      const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      set(y0 + (node.year - y0) * e, a0 + (node.age - a0) * e, p >= 1);
      if (p < 1) roll.raf = requestAnimationFrame(step);
    })(t0);
  }

  // 时间轴上的“火星”滑到当前这一站
  function moveBead() {
    const bead = $('st-bead'), btn = $('timeline-buttons').children[pageIndex];
    if (!bead || !btn) return;
    bead.style.transform = `translateX(${btn.offsetLeft + btn.offsetWidth / 2}px)`;
  }

  // 跟手滑动：正文随手指移动并变淡，过阈值放手翻页，不够则弹回
  (function swipe() {
    const area = $('story'), copy = $('story-copy');
    let sx = 0, sy = 0, st = 0, dragging = false, active = false, crossed = false, dx = 0;
    area.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button,summary,a,dialog') || e.button > 0) return;
      active = true; dragging = false; crossed = false; dx = 0; sx = e.clientX; sy = e.clientY; st = performance.now();
    });
    area.addEventListener('pointermove', (e) => {
      if (!active) return;
      const mx = e.clientX - sx, my = e.clientY - sy;
      if (!dragging) {
        if (Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) * 1.25) { dragging = true; try { area.setPointerCapture(e.pointerId); } catch (_) { /* 忽略 */ } copy.style.transition = 'none'; }
        else return;
      }
      const edge = (mx < 0 && pageIndex === nodes.length - 1) || (mx > 0 && pageIndex === 0);
      dx = mx * (edge ? .22 : 1);
      drift.dragX = dx;
      copy.style.transform = `translateX(${dx * .45}px)`;
      copy.style.opacity = String(Math.max(.25, 1 - Math.abs(dx) / 360));
      const over = Math.abs(dx) > 78;
      if (over && !crossed) haptic(6);
      crossed = over;
    });
    const end = () => {
      if (!active) return; active = false;
      const v = Math.abs(dx) / Math.max(1, performance.now() - st);
      const go = dragging && (Math.abs(dx) > 78 || v > .55 && Math.abs(dx) > 32);
      copy.style.transition = 'transform .45s cubic-bezier(.2,1.2,.4,1),opacity .3s,top .6s cubic-bezier(.16,1,.3,1),padding-bottom .6s cubic-bezier(.16,1,.3,1)';
      copy.style.transform = ''; copy.style.opacity = '';
      drift.dragX = 0; dragging = false;
      if (go) goTo(pageIndex + (dx < 0 ? 1 : -1));
      else if (Math.abs(dx) > 20) haptic(5);
      dx = 0;
    };
    area.addEventListener('pointerup', end); area.addEventListener('pointercancel', end);
  })();

  // 正文向上翻读时，画面收起一部分，给文字留出空间。
  // 滚动停稳后再进入，避免上滑途中突然让位；回到顶部才退出，回滑不会中途收起。
  (function storyReading() {
    const copy = $('story-copy');
    if (new URLSearchParams(location.search).get('read') === 'move') document.body.classList.add('read-move');
    const THRESHOLD = 48, RETRIGGER = 24, DELAY = 300, COOLDOWN = 500;
    let timer = 0, suppress = 0;
    const reading = () => document.body.classList.contains('story-reading');
    const enter = () => {
      clearTimeout(timer); timer = 0;
      if (!reading()) document.body.classList.add('story-reading');
    };
    const leave = () => {
      clearTimeout(timer); timer = 0;
      suppress = performance.now() + COOLDOWN;
      document.body.classList.remove('story-reading');
    };
    const onScroll = () => {
      if (performance.now() < suppress) return;
      if (reading()) {
        if (copy.scrollTop <= 4) leave();
        return;
      }
      if (copy.scrollTop > THRESHOLD) {
        clearTimeout(timer);
        timer = setTimeout(() => {
          timer = 0;
          if (copy.scrollTop > RETRIGGER) enter();
        }, DELAY);
      } else {
        clearTimeout(timer); timer = 0;
      }
    };
    copy.addEventListener('scroll', onScroll, { passive: true });
  })();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopDrift();
    else if (document.body.dataset.screen === 'story') startDrift();
  });
  setScene('opening');
  // 封面静止时提前把相册页和粒子目标算好，点击启卷不再先卡一下。
  setTimeout(() => { prepareEntryMorph().catch(() => {}); }, 700);
  let resizeTimer;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (document.body.dataset.screen === 'story') moveBead(); }, 150);
  });
  window.__life = { inputOf, get result() { return result; }, get nodes() { return nodes; }, get pageIndex() { return pageIndex; }, get choices() { return { ...choices }; }, skipEntry() { finishEntry(); }, plan() { const pl = scenePlan(); return nodes.map((n) => n.key + ':' + (n.year || '-') + ':' + (pl[n.key] ? pl[n.key].bg : '-')); }, finale() { playFinale(); }, finaleClick() { finaleToSeal(); }, jump(i) { showScreen('story'); pageIndex = i; showNode(1); }, burn() { burnToStory(() => { showScreen('story'); showNode(1, { instant: true }); }); } };
})();
