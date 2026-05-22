// ========== 像素涌流 · 主逻辑 ==========
(function() {
  // ── DOM refs ──────────────────────────────
  const canvas = document.getElementById('mainCanvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const statusEl = document.getElementById('status');
  const btnTransform = document.getElementById('btnTransform');
  const btnReset = document.getElementById('btnReset');
  const btnTrail = document.getElementById('btnTrail');
  const btnDownload = document.getElementById('btnDownload');
  const resSlider = document.getElementById('resolution');
  const resVal = document.getElementById('resVal');
  const sortSelect = document.getElementById('sortMethod');
  const trailStrengthSlider = document.getElementById('trailStrength');
  const trailStrengthGroup = document.getElementById('trailStrengthGroup');
  const trailValEl = document.getElementById('trailVal');
  const durSlider = document.getElementById('duration');
  const durValEl = document.getElementById('durVal');
  const easingSelect = document.getElementById('easingMethod');
  const progressBar = document.getElementById('progressBar');
  const zoneA = document.getElementById('zoneA');
  const zoneB = document.getElementById('zoneB');
  const fileA = document.getElementById('fileA');
  const fileB = document.getElementById('fileB');
  const infoA = document.getElementById('infoA');
  const infoB = document.getElementById('infoB');

  // ── State ─────────────────────────────────
  let originalImgA = null;
  let originalImgB = null;
  let imageAData = null;
  let imageBData = null;
  let sortedA = null;
  let animationId = null;
  let isAnimating = false;
  let isPaused = false;
  let pausedProgress = 0;
  let trailOn = false;
  let trailBuffer = null;

  // Responsive canvas display sizing
  function getDisplaySize() {
    const w = window.innerWidth;
    if (w <= 850) {
      return Math.min(w - 20, window.innerHeight - 270, 500);
    }
    if (w >= 1200) {
      // 3-column: left(220) + right(240) + gaps(40) + padding(40) = 540px overhead
      return Math.min(700, w - 540, window.innerHeight - 280);
    }
    // 2-column: left(220) + gap(20) + padding(40) = 280px overhead
    return Math.min(580, w - 280, window.innerHeight - 280);
  }

  // ── Helpers ───────────────────────────────
  const getResolution = () => parseInt(resSlider.value);
  const getSortMethod = () => sortSelect.value;
  const getDuration = () => parseInt(durSlider.value);

  function sortKey(r, g, b, method) {
    switch (method) {
      case 'luminance':
        return 0.299 * r + 0.587 * g + 0.114 * b;
      case 'saturation': {
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        return max === 0 ? 0 : (max - min) / max;
      }
      case 'hue': {
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        if (max === min) return 0;
        const d = max - min;
        if (max === r) return ((g - b) / d + (g < b ? 6 : 0)) / 6;
        if (max === g) return ((b - r) / d + 2) / 6;
        return ((r - g) / d + 4) / 6;
      }
      case 'red':   return r;
      case 'green': return g;
      case 'blue':  return b;
      default:      return 0.299 * r + 0.587 * g + 0.114 * b;
    }
  }

  // ── Image processing ──────────────────────
  function fileToImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('图片加载失败'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  }

  function cropAndResize(img, size) {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const octx = c.getContext('2d');
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const imgAspect = iw / ih;
    let sx, sy, sw, sh;
    if (imgAspect > 1) {
      sh = ih; sw = ih; sx = (iw - sw) / 2; sy = 0;
    } else {
      sw = iw; sh = iw; sx = 0; sy = (ih - sh) / 2;
    }
    octx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);
    return octx.getImageData(0, 0, size, size);
  }

  function processImages() {
    if (!imageAData || !imageBData) return;
    const method = getSortMethod();
    const size = imageAData.width;

    function extract(imageData) {
      const d = imageData.data;
      const pixels = [];
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const i = (y * size + x) * 4;
          pixels.push({
            r: d[i], g: d[i + 1], b: d[i + 2],
            x, y,
            key: sortKey(d[i], d[i + 1], d[i + 2], method)
          });
        }
      }
      return pixels;
    }

    const pixelsA = extract(imageAData);
    const pixelsB = extract(imageBData);
    pixelsA.sort((a, b) => a.key - b.key);
    pixelsB.sort((a, b) => a.key - b.key);

    sortedA = new Array(size * size);
    for (let i = 0; i < pixelsA.length; i++) {
      sortedA[i] = {
        r: pixelsA[i].r, g: pixelsA[i].g, b: pixelsA[i].b,
        sx: pixelsA[i].x, sy: pixelsA[i].y,
        tx: pixelsB[i].x, ty: pixelsB[i].y,
      };
    }
  }

  // ── Rendering ─────────────────────────────
  function setCanvasSize(size) {
    canvas.width = size;
    canvas.height = size;
    const ds = getDisplaySize();
    canvas.style.width = ds + 'px';
    canvas.style.height = ds + 'px';
  }

  function renderImageA() {
    if (!imageAData) return;
    const size = imageAData.width;
    setCanvasSize(size);
    ctx.putImageData(imageAData, 0, 0);
  }

  function renderFrame(progress) {
    if (!sortedA) return;
    const size = imageAData.width;
    setCanvasSize(size);

    if (!trailOn) {
      // ── Fresh frame (no trail) ──────────
      const imgData = ctx.createImageData(size, size);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 14; data[i + 1] = 14; data[i + 2] = 14; data[i + 3] = 255;
      }
      for (const p of sortedA) {
        const cx = p.sx + (p.tx - p.sx) * progress;
        const cy = p.sy + (p.ty - p.sy) * progress;
        const ix = Math.round(cx), iy = Math.round(cy);
        if (ix >= 0 && ix < size && iy >= 0 && iy < size) {
          const idx = (iy * size + ix) * 4;
          data[idx] = p.r; data[idx + 1] = p.g; data[idx + 2] = p.b; data[idx + 3] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    } else {
      // ── Trail effect: accumulate frames ──
      if (!trailBuffer || trailBuffer.width !== size) {
        trailBuffer = ctx.createImageData(size, size);
        initTrailBuffer(size);
      }
      const buf = trailBuffer.data;
      const t = (parseInt(trailStrengthSlider.value) - 1) / 9;
      const decay = 0.75 + t * 0.24;

      for (let i = 0; i < buf.length; i += 4) {
        buf[i]     *= decay;
        buf[i + 1] *= decay;
        buf[i + 2] *= decay;
        buf[i + 3] = 255;
      }
      // Draw current pixel positions at full brightness
      for (const p of sortedA) {
        const cx = p.sx + (p.tx - p.sx) * progress;
        const cy = p.sy + (p.ty - p.sy) * progress;
        const ix = Math.round(cx), iy = Math.round(cy);
        if (ix >= 0 && ix < size && iy >= 0 && iy < size) {
          const idx = (iy * size + ix) * 4;
          buf[idx] = p.r; buf[idx + 1] = p.g; buf[idx + 2] = p.b; buf[idx + 3] = 255;
        }
      }
      ctx.putImageData(trailBuffer, 0, 0);
    }
    progressBar.style.width = (progress * 100) + '%';
  }

  function initTrailBuffer(size) {
    const buf = trailBuffer.data;
    for (let i = 0; i < buf.length; i += 4) {
      buf[i] = 14; buf[i + 1] = 14; buf[i + 2] = 14; buf[i + 3] = 255;
    }
  }

  // ── Animation ─────────────────────────────
  const easingFns = {
    easeInOut: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    linear:    t => t,
    easeIn:    t => t * t * t,
    easeOut:   t => 1 - Math.pow(1 - t, 3),
    bounce:    t => {
      if (t < 1 / 2.75) return 7.5625 * t * t;
      if (t < 2 / 2.75) { t -= 1.5 / 2.75;   return 7.5625 * t * t + 0.75; }
      if (t < 2.5 / 2.75) { t -= 2.25 / 2.75; return 7.5625 * t * t + 0.9375; }
      t -= 2.625 / 2.75; return 7.5625 * t * t + 0.984375;
    },
    elastic:   t => t === 0 ? 0 : t === 1 ? 1
      : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1,
  };
  const applyEasing = t => (easingFns[easingSelect.value] || easingFns.easeInOut)(t);

  function startAnimation() {
    if (isAnimating || !sortedA) return;
    isAnimating = true;
    isPaused = false;
    if (pausedProgress === 0) trailBuffer = null;
    btnTransform.textContent = '⏸ 暂停';
    btnTransform.disabled = false;
    btnReset.disabled = true;
    statusEl.textContent = '变换中...';
    statusEl.className = 'status animating';

    const duration = getDuration();
    const startOffset = pausedProgress * duration;
    const startTime = performance.now() - startOffset;

    function frame(now) {
      const elapsed = now - startTime;
      const raw = Math.min(elapsed / duration, 1);
      pausedProgress = raw;
      renderFrame(applyEasing(raw));
      if (raw < 1) {
        animationId = requestAnimationFrame(frame);
      } else {
        isAnimating = false;
        isPaused = false;
        pausedProgress = 0;
        animationId = null;
        trailBuffer = null;
        btnTransform.textContent = '⟳ 开始变换';
        btnTransform.disabled = false;
        btnReset.disabled = false;
        statusEl.textContent = '变换完成！';
        statusEl.className = 'status ready';
      }
    }
    animationId = requestAnimationFrame(frame);
  }

  function pauseAnimation() {
    if (!isAnimating || isPaused) return;
    cancelAnimationFrame(animationId);
    animationId = null;
    isPaused = true;
    isAnimating = false;
    btnTransform.textContent = '▶ 继续';
    btnReset.disabled = false;
    statusEl.textContent = '已暂停 — 点击"继续"恢复动画';
    statusEl.className = 'status ready';
  }

  function resetToA() {
    if (isAnimating) { cancelAnimationFrame(animationId); isAnimating = false; animationId = null; }
    isPaused = false;
    pausedProgress = 0;
    trailBuffer = null;
    progressBar.style.width = '0%';
    renderImageA();
    btnTransform.textContent = '⟳ 开始变换';
    btnTransform.disabled = false;
    btnReset.disabled = false;
    statusEl.textContent = '已重置，点击"开始变换"重新播放';
    statusEl.className = 'status ready';
  }

  function updateResMax() {
    if (!originalImgA || !originalImgB) return;
    const nativeMax = Math.min(
      originalImgA.naturalWidth, originalImgA.naturalHeight,
      originalImgB.naturalWidth, originalImgB.naturalHeight
    );
    resSlider.max = nativeMax;
    resVal.max = nativeMax;
    updateResWarn(getResolution());
  }

  function updateResWarn(v) {
    const warn = document.getElementById('resWarn');
    if (!warn) return;
    if (v > 500) {
      warn.textContent = `${v}px 可能较慢`;
    } else {
      warn.textContent = '';
    }
  }

  function onBothReady() {
    updateResMax();
    processImages();
    renderImageA();
    progressBar.style.width = '0%';
    btnTransform.textContent = '⟳ 开始变换';
    btnTransform.disabled = false;
    btnReset.disabled = false;
    btnDownload.disabled = false;
    statusEl.textContent = '就绪，点击"开始变换"播放动画';
    statusEl.className = 'status ready';
  }

  function reprocessBoth() {
    const size = getResolution();
    if (originalImgA) {
      imageAData = cropAndResize(originalImgA, size);
      infoA.textContent = `已处理: ${size}×${size} 像素`;
    }
    if (originalImgB) {
      imageBData = cropAndResize(originalImgB, size);
      infoB.textContent = `已处理: ${size}×${size} 像素`;
    }
    if (imageAData && imageBData) onBothReady();
  }

  // ── Upload handling ───────────────────────
  function createUploadHandler(zoneEl, fileInput, infoEl, side) {
    async function handleFile(file) {
      infoEl.textContent = '加载中...';
      try {
        const img = await fileToImage(file);
        if (side === 'A') originalImgA = img;
        else originalImgB = img;

        // Show thumbnail
        zoneEl.querySelector('img')?.remove();
        zoneEl.querySelector('.placeholder')?.remove();
        const reader = new FileReader();
        reader.onload = e => {
          const thumb = document.createElement('img');
          thumb.src = e.target.result;
          zoneEl.appendChild(thumb);
        };
        reader.readAsDataURL(file);
        zoneEl.classList.add('has-image');

        const size = getResolution();
        const imageData = cropAndResize(img, size);
        infoEl.textContent = `已处理: ${size}×${size} 像素`;

        if (side === 'A') {
          imageAData = imageData;
          if (imageBData) onBothReady();
          else { statusEl.textContent = '已加载图片 A — 请上传图片 B'; statusEl.className = 'status'; }
        } else {
          imageBData = imageData;
          if (imageAData) onBothReady();
          else { statusEl.textContent = '已加载图片 B — 请上传图片 A'; statusEl.className = 'status'; }
        }
      } catch (err) {
        infoEl.textContent = '加载失败: ' + err.message;
        console.error(err);
      }
    }

    zoneEl.addEventListener('click', () => fileInput.click());
    zoneEl.addEventListener('dragover', e => { e.preventDefault(); zoneEl.style.borderColor = 'rgba(255,255,255,0.5)'; });
    zoneEl.addEventListener('dragleave', () => { zoneEl.style.borderColor = ''; });
    zoneEl.addEventListener('drop', e => {
      e.preventDefault();
      zoneEl.style.borderColor = '';
      if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) handleFile(fileInput.files[0]);
    });
  }

  createUploadHandler(zoneA, fileA, infoA, 'A');
  createUploadHandler(zoneB, fileB, infoB, 'B');

  // ── Control events ────────────────────────
  durSlider.addEventListener('input', () => {
    durValEl.textContent = (getDuration() / 1000).toFixed(1) + ' 秒';
  });

  let resDebounceTimer = null;
  resSlider.addEventListener('input', () => {
    resVal.value = getResolution();
    updateResWarn(getResolution());
    clearTimeout(resDebounceTimer);
    resDebounceTimer = setTimeout(() => {
      if (!isAnimating) reprocessBoth();
    }, 300);
  });

  resVal.addEventListener('change', () => {
    let v = parseInt(resVal.value);
    if (isNaN(v)) v = 120;
    v = Math.max(50, Math.min(parseInt(resSlider.max), Math.round(v / 10) * 10));
    resVal.value = v;
    resSlider.value = v;
    updateResWarn(v);
    clearTimeout(resDebounceTimer);
    resDebounceTimer = setTimeout(() => {
      if (!isAnimating) reprocessBoth();
    }, 300);
  });

  sortSelect.addEventListener('change', () => {
    if (isAnimating) return;
    if (imageAData && imageBData) {
      processImages();
      renderImageA();
      statusEl.textContent = '排序方式已更新';
      statusEl.className = 'status ready';
    }
  });

  btnTransform.addEventListener('click', () => {
    if (isPaused) {
      startAnimation();
    } else if (isAnimating) {
      pauseAnimation();
    } else {
      pausedProgress = 0;
      startAnimation();
    }
  });
  btnReset.addEventListener('click', resetToA);

  btnDownload.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'pixelflow.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  });

  // Toggle: trail effect
  btnTrail.addEventListener('click', () => {
    trailOn = !trailOn;
    btnTrail.classList.toggle('active', trailOn);
    trailStrengthGroup.style.display = trailOn ? '' : 'none';
    trailBuffer = null;
  });

  trailStrengthSlider.addEventListener('input', () => {
    trailValEl.textContent = trailStrengthSlider.value;
  });

  // Resize canvas on window resize
  window.addEventListener('resize', () => {
    if (imageAData && !isAnimating) {
      setCanvasSize(imageAData.width);
      ctx.putImageData(imageAData, 0, 0);
    }
  });

  // ── Init ──────────────────────────────────
  resVal.value = getResolution();
  setCanvasSize(getResolution());
})();