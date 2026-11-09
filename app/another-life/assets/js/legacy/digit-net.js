(function(root) {
  'use strict';
  function convolutionPool(input, channels, size, count, kernel, bias) {
    const convoluted = new Float32Array(count * size * size);
    for (let output = 0; output < count; output++) {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          let value = bias[output];
          for (let channel = 0; channel < channels; channel++) {
            for (let ky = 0; ky < 3; ky++) {
              const iy = y + ky - 1;
              if (iy < 0 || iy >= size) continue;
              for (let kx = 0; kx < 3; kx++) {
                const ix = x + kx - 1;
                if (ix < 0 || ix >= size) continue;
                value += input[channel * size * size + iy * size + ix] * kernel[((output * channels + channel) * 3 + ky) * 3 + kx];
              }
            }
          }
          convoluted[output * size * size + y * size + x] = Math.max(0, value);
        }
      }
    }
    const pooledSize = size / 2;
    const pooled = new Float32Array(count * pooledSize * pooledSize);
    for (let channel = 0; channel < count; channel++) {
      for (let y = 0; y < pooledSize; y++) {
        for (let x = 0; x < pooledSize; x++) {
          const index = channel * size * size + y * 2 * size + x * 2;
          pooled[channel * pooledSize * pooledSize + y * pooledSize + x] = Math.max(convoluted[index], convoluted[index + 1], convoluted[index + size], convoluted[index + size + 1]);
        }
      }
    }
    return pooled;
  }

  function dense(input, count, weights, bias, relu) {
    const output = new Float32Array(count);
    for (let row = 0; row < count; row++) {
      let value = bias[row];
      for (let column = 0; column < input.length; column++) value += input[column] * weights[row * input.length + column];
      output[row] = relu ? Math.max(0, value) : value;
    }
    return output;
  }

  function predict(pixels) {
    const w = root.DIGIT_MODEL.weights;
    let x = convolutionPool(pixels, 1, 28, 8, w['conv1.weight'].values, w['conv1.bias'].values);
    x = convolutionPool(x, 8, 14, 16, w['conv2.weight'].values, w['conv2.bias'].values);
    x = dense(x, 32, w['fc1.weight'].values, w['fc1.bias'].values, true);
    const logits = dense(x, 10, w['fc2.weight'].values, w['fc2.bias'].values, false);
    const max = Math.max(...logits);
    const probabilities = Array.from(logits, value => Math.exp(value - max));
    const sum = probabilities.reduce((a, b) => a + b, 0);
    const sorted = probabilities.map((value, digit) => ({ digit, confidence:value / sum })).sort((a, b) => b.confidence - a.confidence);
    return { ...sorted[0], alternatives:sorted.slice(0, 3), logits:Array.from(logits) };
  }

  function readCanvas(canvas) {
    const context = canvas.getContext('2d', { willReadFrequently:true });
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        if (data[(y * canvas.width + x) * 4 + 3] > 24) {
          minX = Math.min(minX, x); minY = Math.min(minY, y);
          maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        }
      }
    }
    if (maxX < 0) return null;
    const normalized = document.createElement('canvas');
    normalized.width = normalized.height = 28;
    const target = normalized.getContext('2d', { willReadFrequently:true });
    const width = maxX - minX + 1, height = maxY - minY + 1;
    const scale = 20 / Math.max(width, height);
    const scaledWidth = width * scale, scaledHeight = height * scale;
    target.drawImage(canvas, minX, minY, width, height, (28 - scaledWidth) / 2, (28 - scaledHeight) / 2, scaledWidth, scaledHeight);
    let normalizedData = target.getImageData(0, 0, 28, 28).data;
    let mass = 0, sumX = 0, sumY = 0;
    for (let i = 0; i < 784; i++) {
      const alpha = normalizedData[i * 4 + 3] / 255;
      mass += alpha; sumX += i % 28 * alpha; sumY += Math.floor(i / 28) * alpha;
    }
    if (mass < 1) return null;
    const centered = document.createElement('canvas');
    centered.width = centered.height = 28;
    const centeredContext = centered.getContext('2d');
    centeredContext.drawImage(normalized, Math.round(13.5 - sumX / mass), Math.round(13.5 - sumY / mass));
    normalizedData = centeredContext.getImageData(0, 0, 28, 28).data;
    return predict(Float32Array.from({ length:784 }, (_, i) => normalizedData[i * 4 + 3] / 255));
  }
  function readPage(canvas) {
    const sample = document.createElement('canvas');
    sample.width = 500; sample.height = 300;
    const ctx = sample.getContext('2d', { willReadFrequently:true });
    ctx.drawImage(canvas, 0, 0, 500, 300);
    const pixels = ctx.getImageData(0, 0, 500, 300).data;
    function bands(values, allowedGap) {
      const result = [];
      let start = -1, last = -1;
      for (let i = 0; i < values.length; i++) {
        if (!values[i]) continue;
        if (start < 0) start = i;
        if (last >= 0 && i - last > allowedGap + 1) { result.push([start, last]); start = i; }
        last = i;
      }
      if (start >= 0) result.push([start, last]);
      return result;
    }
    const rows = new Uint16Array(300);
    for (let y = 0; y < 300; y++) for (let x = 0; x < 500; x++) if (pixels[(y * 500 + x) * 4 + 3] > 32) rows[y]++;
    const lines = bands(rows, 6);
    const groups = [];
    const digits = [];
    for (const [top, bottom] of lines) {
      const columns = new Uint16Array(500);
      for (let x = 0; x < 500; x++) for (let y = top; y <= bottom; y++) if (pixels[(y * 500 + x) * 4 + 3] > 32) columns[x]++;
      const spans = bands(columns, 1);
      const boxes = [];
      for (const [left, right] of spans) {
        let actualTop = bottom, actualBottom = top;
        for (let x = left; x <= right; x++) for (let y = top; y <= bottom; y++) if (pixels[(y * 500 + x) * 4 + 3] > 32) { actualTop = Math.min(actualTop, y); actualBottom = Math.max(actualBottom, y); }
        const height = actualBottom - actualTop + 1;
        if (height < Math.max(3, (bottom - top) * .28) && right - left < (bottom - top) * .2) continue;
        const width = right - left + 1;
        if (width > height * 1.15) {
          let split = -1, minimum = Infinity;
          for (let x = Math.floor(left + width * .3); x < left + width * .7; x++) if (columns[x] < minimum) { minimum = columns[x]; split = x; }
          const peak = Math.max(...columns.slice(left, right + 1));
          if (minimum < peak * .38) {
            boxes.push({ left, right:split - 1, top:actualTop, bottom:actualBottom });
            boxes.push({ left:split, right, top:actualTop, bottom:actualBottom });
            continue;
          }
        }
        boxes.push({ left, right, top:actualTop, bottom:actualBottom });
      }
      const gaps = boxes.slice(1).map((box, i) => box.left - boxes[i].right - 1).filter(value => value > 0).sort((a, b) => a - b);
      const normalGap = gaps[Math.floor((gaps.length - 1) / 2)] || 3;
      const wordGap = Math.max((bottom - top + 1) * .2, normalGap * 1.65);
      let group = '';
      let previous;
      for (const box of boxes) {
        if (previous && box.left - previous.right > wordGap && group) { groups.push(group); group = ''; }
        const digitCanvas = document.createElement('canvas');
        digitCanvas.width = box.right - box.left + 5; digitCanvas.height = box.bottom - box.top + 5;
        digitCanvas.getContext('2d').drawImage(sample, box.left, box.top, box.right - box.left + 1, box.bottom - box.top + 1, 2, 2, box.right - box.left + 1, box.bottom - box.top + 1);
        const result = readCanvas(digitCanvas);
        if (result) { group += result.digit; digits.push({ ...result, box }); }
        previous = box;
      }
      if (group) groups.push(group);
    }
    return { groups, digits, raw:groups.join(' ') };
  }

  root.OfflineDigitReader = { predict, readCanvas, readPage };
})(typeof window !== 'undefined' ? window : globalThis);
