// ========== 风扇转速 · 摄像头帧差 + FFT ==========
// 采样中心 ROI 的相邻帧灰度差，凑满缓冲后做 FFT 找主频，换算轴转速。
// 读数历史持久化在本机，可导出 CSV。

(function () {
    "use strict";

    var video = document.getElementById("video");
    var canvas = document.getElementById("work");
    var ctx = canvas.getContext("2d", { willReadFrequently: true });
    var startBtn = document.getElementById("startBtn");
    var stopBtn = document.getElementById("stopBtn");
    var smoothEl = document.getElementById("smooth");
    var smoothVal = document.getElementById("smoothVal");
    var rpmDisplay = document.getElementById("rpmDisplay");
    var confOut = document.getElementById("confOut");
    var hzOut = document.getElementById("hzOut");
    var fftInfoOut = document.getElementById("fftInfoOut");
    var ptsOut = document.getElementById("ptsOut");
    var errBox = document.getElementById("errBox");
    var errHint = document.getElementById("errHint");
    var statusEl = document.getElementById("status");
    var refTapLayer = document.getElementById("refTapLayer");
    var refMarker = document.getElementById("refMarker");
    var refPatchRing = document.getElementById("refPatchRing");
    var pickRefBtn = document.getElementById("pickRefBtn");
    var patchSizeEl = document.getElementById("patchSize");
    var patchValEl = document.getElementById("patchVal");
    var bladeCyclesEl = document.getElementById("bladeCycles");
    var bladeCyclesValEl = document.getElementById("bladeCyclesVal");
    var stageCaption = document.getElementById("stageCaption");
    var readingList = document.getElementById("readingList");
    var historyCount = document.getElementById("historyCount");
    var historyEmpty = document.getElementById("historyEmpty");
    var exportBtn = document.getElementById("exportBtn");
    var clearHistoryBtn = document.getElementById("clearHistoryBtn");
    var readoutLive = document.getElementById("readoutLive");

    var refNx = 0.5;
    var refNy = 0.5;
    var refUserPlaced = false;
    var refPickMode = false;

    var stream = null;
    var running = false;
    var starting = false;
    var rafId = 0;
    var vfcHandle = 0;
    var lastFrameTime = 0;
    /** 上一帧 ROI 灰度，与当前帧同尺寸 */
    var prevGray = null;
    var prevPs = 0;
    var measuredFps = 30;

    /** 最近若干帧瞬时 RPM，用于滑动平均 */
    var rpmHistory = [];
    var lastGoodRpm = null;
    var lastGoodHz = null;
    var lastGoodConfText = null;
    var spectralFailStreak = 0;
    var SPECTRAL_FAIL_STREAK_CLEAR = 15;

    /** FFT 长度（须为 2 的幂） */
    var FFT_SIZE = 256;
    /** 帧差缓冲（环形，时间顺序由 copyDiffSequential 还原） */
    var diffRing = new Float32Array(FFT_SIZE);
    var diffWrite = 0;
    var diffFilled = 0;
    var fftRe = new Float32Array(FFT_SIZE);
    var fftIm = new Float32Array(FFT_SIZE);
    var winScratch = new Float32Array(FFT_SIZE);
    /** 谱峰相对邻域均值的倍数下限 */
    var PEAK_SNR_MIN = 2.2;

    // --- 读数记录 ---

    var STORAGE_KEY = "fanRpmReadings";
    var MAX_READINGS = 50;
    var RECORD_INTERVAL_MS = 3000;
    var readings = [];
    var lastRecordAt = 0;

    function loadReadings() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return [];
            var parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed.filter(function (item) {
                return item && Number.isFinite(item.rpm) && Number.isFinite(item.t);
            }).slice(-MAX_READINGS);
        } catch (err) {
            return [];
        }
    }

    function saveReadings() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(readings));
        } catch (err) {
            // 隐私模式下不持久化，本次会话仍可见
        }
    }

    function formatTime(timestamp) {
        return new Date(timestamp).toLocaleTimeString("zh-CN", { hour12: false });
    }

    function renderHistory() {
        readingList.replaceChildren();

        readings.slice().reverse().forEach(function (item) {
            var row = document.createElement("li");

            var time = document.createElement("time");
            time.dateTime = new Date(item.t).toISOString();
            time.textContent = formatTime(item.t);

            var value = document.createElement("strong");
            value.textContent = Math.round(item.rpm).toLocaleString("zh-CN") + " RPM";

            var conf = document.createElement("span");
            conf.className = "reading-conf";
            conf.textContent = item.conf + "% · " + Number(item.hz).toFixed(2) + " Hz";

            row.appendChild(time);
            row.appendChild(value);
            row.appendChild(conf);
            readingList.appendChild(row);
        });

        historyCount.textContent = readings.length + " 条";
        historyEmpty.hidden = readings.length > 0;
        exportBtn.disabled = readings.length === 0;
        clearHistoryBtn.disabled = readings.length === 0;
    }

    function maybeRecord(rpm, hz, confPct) {
        var now = performance.now ? performance.now() : Date.now();
        if (now - lastRecordAt < RECORD_INTERVAL_MS) return;
        if (confPct < 30) return;

        lastRecordAt = now;
        readings.push({
            t: Date.now(),
            rpm: Math.round(rpm),
            hz: Number(hz.toFixed(2)),
            conf: confPct
        });
        if (readings.length > MAX_READINGS) readings.shift();

        saveReadings();
        renderHistory();

        if (readoutLive) {
            readoutLive.textContent = "当前约 " + Math.round(rpm) + " 转每分钟";
        }
    }

    function exportCsv() {
        if (!readings.length) return;

        var lines = ["时间,RPM,置信度,转频(Hz)"];
        readings.forEach(function (item) {
            lines.push([
                new Date(item.t).toLocaleString("zh-CN"),
                item.rpm,
                item.conf,
                item.hz
            ].join(","));
        });

        var blob = new Blob(["\ufeff" + lines.join("\r\n")], {
            type: "text/csv;charset=utf-8"
        });
        var url = URL.createObjectURL(blob);
        var link = document.createElement("a");
        var stamp = new Date().toISOString().slice(0, 10);
        link.href = url;
        link.download = "fan-rpm-" + stamp + ".csv";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        if (typeof showToast === "function") showToast("已导出 CSV", "success");
    }

    function clearHistory() {
        if (!readings.length) return;
        if (!window.confirm("清空全部读数记录？")) return;

        readings = [];
        lastRecordAt = 0;
        saveReadings();
        renderHistory();
        if (typeof showToast === "function") showToast("已清空记录", "info");
    }

    // --- 几何与 ROI ---

    function getCoverMapping(videoEl, vw, vh) {
        var r = videoEl.getBoundingClientRect();
        var dw = r.width;
        var dh = r.height;
        var videoRatio = vw / vh;
        var boxRatio = dw / dh;
        if (boxRatio > videoRatio) {
            var scaleW = dh / vh;
            var offsetX = (dw - vw * scaleW) / 2;
            return { scale: scaleW, offsetX: offsetX, offsetY: 0 };
        }
        var scaleH = dw / vw;
        var offsetY = (dh - vh * scaleH) / 2;
        return { scale: scaleH, offsetX: 0, offsetY: offsetY };
    }

    function clientToVideoPx(clientX, clientY, videoEl, vw, vh) {
        var r = videoEl.getBoundingClientRect();
        var relX = clientX - r.left;
        var relY = clientY - r.top;
        var m = getCoverMapping(videoEl, vw, vh);
        var px = (relX - m.offsetX) / m.scale;
        var py = (relY - m.offsetY) / m.scale;
        return {
            x: Math.max(0, Math.min(vw - 1, Math.round(px))),
            y: Math.max(0, Math.min(vh - 1, Math.round(py)))
        };
    }

    function videoPxToLayerPx(videoEl, vw, vh, px, py) {
        var m = getCoverMapping(videoEl, vw, vh);
        return {
            left: m.offsetX + px * m.scale,
            top: m.offsetY + py * m.scale
        };
    }

    function getPatchSideOdd() {
        var ps = parseInt(patchSizeEl.value, 10) || 21;
        if (ps % 2 === 0) ps += 1;
        return Math.max(15, Math.min(31, ps));
    }

    function updateRefMarkers() {
        var vw = video.videoWidth;
        var vh = video.videoHeight;
        if (!vw || !vh || !running) {
            refMarker.style.visibility = "hidden";
            refPatchRing.style.visibility = "hidden";
            return;
        }
        var cx = refUserPlaced ? refNx * (vw - 1) : 0.5 * (vw - 1);
        var cy = refUserPlaced ? refNy * (vh - 1) : 0.5 * (vh - 1);
        var pos = videoPxToLayerPx(video, vw, vh, cx, cy);
        refMarker.style.left = pos.left + "px";
        refMarker.style.top = pos.top + "px";
        refMarker.style.visibility = "visible";
        var ps = getPatchSideOdd();
        var m = getCoverMapping(video, vw, vh);
        var disp = ps * m.scale;
        refPatchRing.style.width = disp + "px";
        refPatchRing.style.height = disp + "px";
        refPatchRing.style.left = pos.left + "px";
        refPatchRing.style.top = pos.top + "px";
        refPatchRing.style.visibility = "visible";
    }

    function setErr(msg) {
        if (msg) {
            errBox.hidden = false;
            errBox.textContent = msg;
            if (errHint) errHint.hidden = false;
        } else {
            errBox.hidden = true;
            if (errHint) errHint.hidden = true;
        }
    }

    // --- 帧率与 FFT ---

    function effectiveFpsFromTimes(dtMs) {
        if (dtMs > 0 && dtMs < 500) {
            var f = 1000 / dtMs;
            measuredFps = measuredFps * 0.85 + f * 0.15;
        }
        return Math.min(120, Math.max(8, measuredFps));
    }

    function resetDiffBuffer() {
        diffWrite = 0;
        diffFilled = 0;
    }

    function pushDiffSample(x) {
        diffRing[diffWrite] = x;
        diffWrite = (diffWrite + 1) % FFT_SIZE;
        if (diffFilled < FFT_SIZE) diffFilled++;
    }

    /** Cooley–Tukey FFT，re/im 同长度 2 的幂 */
    function fftInPlace(re, im) {
        var n = re.length;
        var j = 0;
        for (var i = 1; i < n; i++) {
            var bit = n >> 1;
            for (; j & bit; bit >>= 1) j ^= bit;
            j ^= bit;
            if (i < j) {
                var t = re[i];
                re[i] = re[j];
                re[j] = t;
                t = im[i];
                im[i] = im[j];
                im[j] = t;
            }
        }
        for (var len = 2; len <= n; len <<= 1) {
            var ang = (-2 * Math.PI) / len;
            var wlen = Math.cos(ang);
            var wleni = Math.sin(ang);
            for (var start = 0; start < n; start += len) {
                var w = 1;
                var wi = 0;
                for (var k = 0; k < len >> 1; k++) {
                    var u = start + k;
                    var v = u + (len >> 1);
                    var tr = re[v] * w - im[v] * wi;
                    var ti = re[v] * wi + im[v] * w;
                    re[v] = re[u] - tr;
                    im[v] = im[u] - ti;
                    re[u] += tr;
                    im[u] += ti;
                    var nw = w * wlen - wi * wleni;
                    wi = w * wleni + wi * wlen;
                    w = nw;
                }
            }
        }
    }

    function meanAbsDiff(prev, curr, n) {
        var s = 0;
        for (var i = 0; i < n; i++) s += Math.abs(curr[i] - prev[i]);
        return s / n;
    }

    /**
     * 从帧差环形缓冲取满 FFT_SIZE 点后做加窗 FFT，找主频并换算轴转速。
     * peakHz 为帧差信号的调制频率；轴转频 Hz = peakHz / cyclesPerRev。
     */
    function estimateRpmFromFrameDiff(fsHz) {
        if (diffFilled < FFT_SIZE || !Number.isFinite(fsHz) || fsHz < 8) return null;

        var sum = 0;
        for (var i = 0; i < FFT_SIZE; i++) {
            var v = diffRing[(diffWrite + i) % FFT_SIZE];
            winScratch[i] = v;
            sum += v;
        }
        var mean = sum / FFT_SIZE;
        for (var j = 0; j < FFT_SIZE; j++) {
            var w = 0.5 * (1 - Math.cos((2 * Math.PI * j) / Math.max(1, FFT_SIZE - 1)));
            winScratch[j] = (winScratch[j] - mean) * w;
        }

        for (var k = 0; k < FFT_SIZE; k++) {
            fftRe[k] = winScratch[k];
            fftIm[k] = 0;
        }
        fftInPlace(fftRe, fftIm);

        var half = FFT_SIZE >> 1;
        var mags = new Float32Array(half);
        for (var m = 0; m < half; m++) {
            mags[m] = Math.hypot(fftRe[m], fftIm[m]);
        }

        var peakK = 1;
        var peakMag = mags[1];
        for (var p = 2; p < half - 1; p++) {
            if (mags[p] > peakMag) {
                peakMag = mags[p];
                peakK = p;
            }
        }

        var medSum = 0;
        var medCnt = 0;
        for (var q = 1; q < half - 1; q++) {
            if (q === peakK) continue;
            medSum += mags[q];
            medCnt++;
        }
        var med = medCnt > 0 ? medSum / medCnt : 0;
        var snr = med > 1e-9 ? peakMag / med : 0;
        if (snr < PEAK_SNR_MIN) return null;

        var peakHz = (peakK * fsHz) / FFT_SIZE;
        var cyclesPerRev = Math.max(1, parseInt(bladeCyclesEl.value, 10) || 3);
        var fRotHz = peakHz / cyclesPerRev;
        var rpmRaw = fRotHz * 60;

        if (!Number.isFinite(rpmRaw) || rpmRaw < 0.5 || rpmRaw > 200000) return null;
        if (peakHz < 0.08 || peakHz > 0.48 * fsHz) return null;

        var conf = Math.max(0, Math.min(1, (snr - PEAK_SNR_MIN) / 4));

        return {
            rpmRaw: rpmRaw,
            fRotHz: fRotHz,
            peakHz: peakHz,
            peakK: peakK,
            snr: snr,
            confidence: conf
        };
    }

    function applyRpmSmoothing(rawRpm) {
        var cap = parseInt(smoothEl.value, 10) || 5;
        rpmHistory.push(rawRpm);
        while (rpmHistory.length > cap) rpmHistory.shift();
        var s = 0;
        for (var i = 0; i < rpmHistory.length; i++) s += rpmHistory[i];
        return s / rpmHistory.length;
    }

    function processFrame(now) {
        var w = video.videoWidth;
        var h = video.videoHeight;
        if (!w || !h) return;

        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(video, 0, 0, w, h);

        var ps = getPatchSideOdd();
        var half = (ps - 1) >> 1;
        var cx = Math.round(refUserPlaced ? refNx * (w - 1) : 0.5 * (w - 1));
        var cy = Math.round(refUserPlaced ? refNy * (h - 1) : 0.5 * (h - 1));
        var x0 = Math.max(0, Math.min(w - ps, cx - half));
        var y0 = Math.max(0, Math.min(h - ps, cy - half));

        var img = ctx.getImageData(x0, y0, ps, ps);
        var d = img.data;
        var n = ps * ps;
        var gray = new Float32Array(n);
        for (var i = 0, p = 0; i < n; i++, p += 4) {
            gray[i] = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
        }

        updateRefMarkers();

        var dt = lastFrameTime ? (now - lastFrameTime) / 1000 : 0;
        lastFrameTime = now;
        effectiveFpsFromTimes(dt * 1000);

        fftInfoOut.textContent = FFT_SIZE + " 点 · " + diffFilled + "/" + FFT_SIZE;

        if (!prevGray || prevPs !== ps || prevGray.length !== n) {
            prevGray = gray;
            prevPs = ps;
            resetDiffBuffer();
            statusEl.textContent = "已采集上一帧，下一帧开始帧差…";
            return;
        }

        if (dt < 0.004 || dt > 0.35) {
            prevGray = gray;
            return;
        }

        var mad = meanAbsDiff(prevGray, gray, n);
        prevGray = gray;
        pushDiffSample(mad);

        if (diffFilled < FFT_SIZE) {
            ptsOut.textContent = "—";
            statusEl.textContent = "收集中… " + diffFilled + "/" + FFT_SIZE + " 帧（帧差均值 → FFT）";
            return;
        }

        var spec = estimateRpmFromFrameDiff(measuredFps);

        if (!spec) {
            spectralFailStreak++;
            ptsOut.textContent = "—";
            if (
                spectralFailStreak < SPECTRAL_FAIL_STREAK_CLEAR &&
                lastGoodRpm !== null &&
                lastGoodHz !== null
            ) {
                rpmDisplay.textContent = lastGoodRpm.toLocaleString("zh-CN");
                hzOut.textContent = lastGoodHz.toFixed(2);
                confOut.textContent = lastGoodConfText || "—";
                statusEl.textContent =
                    "本帧谱不可靠 · " + spectralFailStreak + "/" + SPECTRAL_FAIL_STREAK_CLEAR + " 后清空";
            } else {
                rpmDisplay.textContent = "—";
                hzOut.textContent = "—";
                confOut.textContent = "低";
                statusEl.textContent = "无法估计：请对准 ROI、调节「每转周期数」、提高对比度或帧率。";
            }
            return;
        }

        spectralFailStreak = 0;
        ptsOut.textContent = String(spec.peakK);

        var rpmSm = applyRpmSmoothing(spec.rpmRaw);
        var fRotHz = spec.fRotHz;
        var confPct = Math.min(99, Math.round(spec.confidence * 100));
        var confText = confPct + "%";

        rpmDisplay.textContent = Math.round(rpmSm).toLocaleString("zh-CN");
        hzOut.textContent = fRotHz.toFixed(2);
        confOut.textContent = confText;

        lastGoodRpm = Math.round(rpmSm);
        lastGoodHz = fRotHz;
        lastGoodConfText = confText;

        statusEl.textContent =
            "约 " + measuredFps.toFixed(0) + " fps · 帧差 + FFT · 谱峰 " +
            spec.peakHz.toFixed(2) + " Hz（已平滑）";

        maybeRecord(rpmSm, fRotHz, confPct);
    }

    function sampleFrame(now) {
        if (!running) return;

        if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
            if (video.requestVideoFrameCallback) {
                vfcHandle = video.requestVideoFrameCallback(sampleFrame);
            } else {
                rafId = requestAnimationFrame(sampleFrame);
            }
            return;
        }

        var dtSkip = lastFrameTime ? now - lastFrameTime : 0;
        var minGap = video.requestVideoFrameCallback ? 0 : 28;
        if (lastFrameTime && dtSkip < minGap) {
            if (video.requestVideoFrameCallback) {
                vfcHandle = video.requestVideoFrameCallback(sampleFrame);
            } else {
                rafId = requestAnimationFrame(sampleFrame);
            }
            return;
        }

        processFrame(now);

        if (video.requestVideoFrameCallback) {
            vfcHandle = video.requestVideoFrameCallback(sampleFrame);
        } else {
            rafId = requestAnimationFrame(sampleFrame);
        }
    }

    async function start() {
        if (running || starting) return;
        starting = true;

        try {
        setErr("");
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: "environment" },
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 60, max: 60 }
                },
                audio: false
            });
        } catch (e) {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: false
                });
            } catch (e2) {
                setErr("无法打开摄像头：" + (e2.message || "请检查权限与 HTTPS/本地环境。"));
                return;
            }
        }

        video.srcObject = stream;
        video.playsInline = true;
        video.muted = true;
        await video.play();

        running = true;
        lastFrameTime = 0;
        prevGray = null;
        prevPs = 0;
        resetDiffBuffer();
        rpmHistory.length = 0;
        lastGoodRpm = null;
        lastGoodHz = null;
        lastGoodConfText = null;
        spectralFailStreak = 0;
        lastRecordAt = 0;
        refUserPlaced = false;
        refNx = 0.5;
        refNy = 0.5;
        refPickMode = false;
        refTapLayer.classList.remove("active");
        pickRefBtn.textContent = "点选转轴投影";
        pickRefBtn.disabled = false;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        statusEl.textContent = "分析中…";
        ptsOut.textContent = "—";

        if (video.videoWidth && video.videoHeight) updateRefMarkers();

        var track = stream.getVideoTracks()[0];
        var settings = track.getSettings ? track.getSettings() : {};
        if (settings.frameRate) measuredFps = settings.frameRate;

        var onMeta = function () {
            updateRefMarkers();
            video.removeEventListener("loadedmetadata", onMeta);
        };
        video.addEventListener("loadedmetadata", onMeta);

        if (video.requestVideoFrameCallback) {
            vfcHandle = video.requestVideoFrameCallback(sampleFrame);
        } else {
            rafId = requestAnimationFrame(sampleFrame);
        }
        } finally {
            starting = false;
        }
    }

    function stop() {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
        if (video.cancelVideoFrameCallback && vfcHandle) {
            try {
                video.cancelVideoFrameCallback(vfcHandle);
            } catch (err) {
                // 忽略：部分浏览器回调已失效
            }
        }
        vfcHandle = 0;
        if (stream) {
            stream.getTracks().forEach(function (track) {
                track.stop();
            });
            stream = null;
        }
        video.srcObject = null;
        pickRefBtn.disabled = true;
        refPickMode = false;
        refTapLayer.classList.remove("active");
        refMarker.style.visibility = "hidden";
        refPatchRing.style.visibility = "hidden";
        startBtn.disabled = false;
        stopBtn.disabled = true;
        rpmDisplay.textContent = "—";
        confOut.textContent = "—";
        hzOut.textContent = "—";
        ptsOut.textContent = "—";
        statusEl.textContent = "已停止";
        prevGray = null;
        rpmHistory.length = 0;
        lastGoodRpm = null;
        lastGoodHz = null;
        lastGoodConfText = null;
        spectralFailStreak = 0;
    }

    smoothEl.addEventListener("input", function () {
        smoothVal.textContent = smoothEl.value;
        rpmHistory.length = 0;
    });

    patchSizeEl.addEventListener("input", function () {
        patchValEl.textContent = patchSizeEl.value;
        if (running) {
            prevGray = null;
            prevPs = 0;
            resetDiffBuffer();
            rpmHistory.length = 0;
            lastGoodRpm = null;
            lastGoodHz = null;
            lastGoodConfText = null;
            spectralFailStreak = 0;
            if (video.videoWidth && video.videoHeight) updateRefMarkers();
        }
    });

    bladeCyclesEl.addEventListener("input", function () {
        bladeCyclesValEl.textContent = bladeCyclesEl.value;
        rpmHistory.length = 0;
    });

    function toggleRefPickMode() {
        if (!running) return;
        refPickMode = !refPickMode;
        refTapLayer.classList.toggle("active", refPickMode);
        refTapLayer.setAttribute("aria-hidden", refPickMode ? "false" : "true");
        pickRefBtn.textContent = refPickMode ? "点击画面完成" : "点选转轴投影";
        stageCaption.textContent = refPickMode
            ? "点击转轴在画面上的投影（轮毂中心）"
            : "点「点选转轴」后在画面上点击";
    }

    function onRefPointerDown(e) {
        if (!refPickMode || !running) return;
        e.preventDefault();
        var vw = video.videoWidth;
        var vh = video.videoHeight;
        if (!vw || !vh) return;
        var p = clientToVideoPx(e.clientX, e.clientY, video, vw, vh);
        refNx = p.x / Math.max(1, vw - 1);
        refNy = p.y / Math.max(1, vh - 1);
        refUserPlaced = true;
        refPickMode = false;
        refTapLayer.classList.remove("active");
        refTapLayer.setAttribute("aria-hidden", "true");
        pickRefBtn.textContent = "点选转轴投影";
        stageCaption.textContent = "已设置转轴投影 · 可再次点选修改";
        prevGray = null;
        prevPs = 0;
        resetDiffBuffer();
        rpmHistory.length = 0;
        updateRefMarkers();
    }

    pickRefBtn.addEventListener("click", toggleRefPickMode);
    refTapLayer.addEventListener("pointerdown", onRefPointerDown);

    window.addEventListener("resize", function () {
        if (running) updateRefMarkers();
    });

    startBtn.addEventListener("click", start);
    stopBtn.addEventListener("click", stop);
    exportBtn.addEventListener("click", exportCsv);
    clearHistoryBtn.addEventListener("click", clearHistory);

    document.addEventListener("visibilitychange", function () {
        if (document.hidden && running) stop();
    });

    readings = loadReadings();
    renderHistory();
})();
