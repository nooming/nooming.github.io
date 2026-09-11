/* 音频转码：解码走 Web Audio；MP3 依赖先加载的 lamejs。 */

var AUDIO_CONVERTER_OBJECT_URL = null;
var LAME_RATES = [8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000];
var MP3_FRAME = 1152;

function showFileName(input) {
    var el = document.getElementById('file-name');
    if (!el) return;
    if (input.files && input.files.length > 0) {
        el.textContent = '已选择：' + input.files[0].name;
    } else {
        el.textContent = '未选择文件';
    }
}

function isMp3EncoderReady() {
    return typeof lamejs !== 'undefined' && typeof lamejs.Mp3Encoder === 'function';
}

function errorText(err) {
    if (!err) return '未知错误';
    if (typeof err === 'string') return err;
    var msg = (err.message && String(err.message).trim()) || err.name;
    return msg ? String(msg) : '未知错误';
}

function formatDecodeError(file, err) {
    var name = (file && file.name) || '该文件';
    var lower = name.toLowerCase();
    var hint = '浏览器一般能解码 WAV、MP3；Chrome / Safari 通常还能解码 M4A / AAC。AMR、WMA、SILK 以及多数录像容器无法转换。';
    if (/\.(amr|wma|silk|slk|ape|dts|ac3)$/i.test(lower)) {
        hint = name.replace(/^.*\./, '').toUpperCase() + ' 不在浏览器解码列表里，换 WAV / MP3 / M4A 再试。';
    }
    return '无法解码「' + name + '」。' + hint + '（' + errorText(err) + '）';
}

function clampSample(s) {
    s = s < -1 ? -1 : s > 1 ? 1 : s;
    return s < 0 ? s * 0x8000 : s * 0x7FFF;
}

function floatToInt16(input) {
    var output = new Int16Array(input.length);
    for (var i = 0; i < input.length; i++) {
        output[i] = clampSample(input[i]);
    }
    return output;
}

function resampleChannel(input, fromRate, toRate) {
    if (fromRate === toRate) return input;
    var ratio = fromRate / toRate;
    var outLen = Math.max(1, Math.round(input.length / ratio));
    var out = new Float32Array(outLen);
    var last = input.length - 1;
    for (var i = 0; i < outLen; i++) {
        var src = i * ratio;
        var i0 = Math.floor(src);
        var i1 = i0 < last ? i0 + 1 : last;
        var f = src - i0;
        out[i] = input[i0] * (1 - f) + input[i1] * f;
    }
    return out;
}

function pickLameRate(rate) {
    if (LAME_RATES.indexOf(rate) !== -1) return rate;
    var best = 44100;
    var diff = Math.abs(rate - best);
    for (var i = 0; i < LAME_RATES.length; i++) {
        var d = Math.abs(rate - LAME_RATES[i]);
        if (d < diff) {
            diff = d;
            best = LAME_RATES[i];
        }
    }
    return best;
}

function decodeAudioDataCompat(audioContext, arrayBuffer) {
    var copy = arrayBuffer.slice(0);
    return new Promise(function (resolve, reject) {
        var settled = false;
        function ok(buf) {
            if (settled) return;
            settled = true;
            resolve(buf);
        }
        function fail(err) {
            if (settled) return;
            settled = true;
            reject(err || new Error('EncodingError'));
        }
        try {
            var ret = audioContext.decodeAudioData(copy, ok, fail);
            if (ret && typeof ret.then === 'function') {
                ret.then(ok, fail);
            }
        } catch (err) {
            fail(err);
        }
    });
}

async function decodeAudioFile(file) {
    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
        throw new Error('当前浏览器没有 Web Audio，无法解码。');
    }
    var arrayBuffer = await file.arrayBuffer();
    var audioContext = new AudioCtx();
    try {
        if (audioContext.state === 'suspended') {
            try { await audioContext.resume(); } catch (e) { /* ignore */ }
        }
        return await decodeAudioDataCompat(audioContext, arrayBuffer);
    } catch (err) {
        throw new Error(formatDecodeError(file, err));
    } finally {
        try { audioContext.close(); } catch (e) { /* ignore */ }
    }
}

function audioBufferToWav(buffer) {
    var length = buffer.length;
    var numberOfChannels = buffer.numberOfChannels || 1;
    var sampleRate = buffer.sampleRate;
    var blockAlign = numberOfChannels * 2;
    var dataSize = length * blockAlign;
    var bufferSize = 44 + dataSize;
    var arrayBuffer = new ArrayBuffer(bufferSize);
    var view = new DataView(arrayBuffer);
    var pcm = new Int16Array(arrayBuffer, 44, length * numberOfChannels);
    var channels = [];
    var c;

    function writeString(offset, string) {
        for (var i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    writeString(0, 'RIFF');
    view.setUint32(4, bufferSize - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    for (c = 0; c < numberOfChannels; c++) {
        channels.push(buffer.getChannelData(c));
    }

    var o = 0;
    var i;
    for (i = 0; i < length; i++) {
        for (c = 0; c < numberOfChannels; c++) {
            pcm[o++] = clampSample(channels[c][i]);
        }
    }
    return arrayBuffer;
}

function copyFrame(src, start) {
    var frame = new Int16Array(MP3_FRAME);
    var remain = src.length - start;
    if (remain >= MP3_FRAME) {
        frame.set(src.subarray(start, start + MP3_FRAME));
    } else if (remain > 0) {
        frame.set(src.subarray(start));
    }
    return frame;
}

async function audioBufferToMp3(buffer) {
    if (!isMp3EncoderReady()) {
        throw new Error('MP3 编码器未加载。请确认本页的 lame.min.js 能打开，或改选 WAV。');
    }

    var srcRate = buffer.sampleRate;
    var outRate = pickLameRate(srcRate);
    var channelCount = buffer.numberOfChannels > 1 ? 2 : 1;
    var leftFloat = resampleChannel(buffer.getChannelData(0), srcRate, outRate);
    var rightFloat = null;
    if (channelCount === 2) {
        rightFloat = resampleChannel(buffer.getChannelData(1), srcRate, outRate);
    }

    var left = floatToInt16(leftFloat);
    var right = rightFloat ? floatToInt16(rightFloat) : null;
    var encoder = new lamejs.Mp3Encoder(channelCount, outRate, 128);
    var chunks = [];
    var i;

    for (i = 0; i < left.length; i += MP3_FRAME) {
        var leftFrame = copyFrame(left, i);
        var mp3buf = channelCount === 1
            ? encoder.encodeBuffer(leftFrame)
            : encoder.encodeBuffer(leftFrame, copyFrame(right, i));
        if (mp3buf && mp3buf.length > 0) {
            chunks.push(mp3buf);
        }
        if (i > 0 && i % (MP3_FRAME * 40) === 0) {
            await new Promise(function (r) { setTimeout(r, 0); });
        }
    }

    var flushed = encoder.flush();
    if (flushed && flushed.length > 0) {
        chunks.push(flushed);
    }

    var total = 0;
    for (i = 0; i < chunks.length; i++) total += chunks[i].length;
    if (total === 0) {
        throw new Error('MP3 编码结果为空，请换一段更长的音频再试。');
    }
    var result = new Uint8Array(total);
    var offset = 0;
    for (i = 0; i < chunks.length; i++) {
        result.set(chunks[i], offset);
        offset += chunks[i].length;
    }
    return result.buffer;
}

function safeDownloadName(name, ext) {
    var base = String(name || 'audio').replace(/\.[^/.]+$/, '');
    base = base.replace(/["<>\\/|?*]/g, '_').replace(/\s+/g, ' ').trim() || 'audio';
    return base + ext;
}

function setResultHtml(html) {
    var resultDiv = document.getElementById('result');
    if (resultDiv) resultDiv.innerHTML = html;
}

async function convertAudio() {
    var fileInput = document.getElementById('audio-file');
    var formatSelect = document.getElementById('target-format');
    var convertBtn = document.getElementById('convert-btn');

    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        setResultHtml('<p style="color: #e74c3c;">请先选择音频文件！</p>');
        return;
    }

    var file = fileInput.files[0];
    var targetFormat = formatSelect ? formatSelect.value : 'mp3';

    if (targetFormat === 'mp3' && !isMp3EncoderReady()) {
        setResultHtml('<p style="color: #e74c3c;">MP3 编码器未加载，无法转 MP3。可改选 WAV，或检查 assets/js/vendor/lame.min.js 是否存在。</p>');
        return;
    }

    if (convertBtn) convertBtn.disabled = true;
    setResultHtml('<p style="color: var(--color-theme-text-end);">正在转换，请稍候...</p>');

    try {
        var audioBuffer = await decodeAudioFile(file);
        var blob;
        var fileName;
        var formatName;

        if (targetFormat === 'wav') {
            blob = new Blob([audioBufferToWav(audioBuffer)], { type: 'audio/wav' });
            fileName = safeDownloadName(file.name, '.wav');
            formatName = 'WAV';
        } else {
            blob = new Blob([await audioBufferToMp3(audioBuffer)], { type: 'audio/mpeg' });
            fileName = safeDownloadName(file.name, '.mp3');
            formatName = 'MP3';
        }

        if (AUDIO_CONVERTER_OBJECT_URL) {
            URL.revokeObjectURL(AUDIO_CONVERTER_OBJECT_URL);
        }
        AUDIO_CONVERTER_OBJECT_URL = URL.createObjectURL(blob);

        setResultHtml(
            '<p style="color: #27ae60;">转换成功！</p>' +
            '<a href="' + AUDIO_CONVERTER_OBJECT_URL + '" download="' + fileName +
            '" style="display: inline-block; padding: 10px 20px; background-color: #27ae60; color: white; border-radius: 0; text-decoration: none; margin-top: 10px;">下载 ' +
            formatName + ' 文件</a>'
        );
    } catch (error) {
        setResultHtml('<p style="color: #e74c3c;">转换失败：' + errorText(error) + '</p>');
    } finally {
        if (convertBtn) convertBtn.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', function () {
    var convertBtn = document.getElementById('convert-btn');
    if (convertBtn) {
        convertBtn.addEventListener('click', convertAudio);
    }
});
