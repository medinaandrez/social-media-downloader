import { writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';

const colors = {
  background: '#0B5F51',
  accent: '#55D6B5',
  foreground: '#F7FFFB',
};

await writeFile('assets/icon.png', renderIcon(1024, { background: true, scale: 1 }));
await writeFile('assets/adaptive-icon.png', renderIcon(1024, { background: false, scale: 0.84 }));
await writeFile('assets/splash-icon.png', renderIcon(1024, { background: false, scale: 0.76 }));
await writeFile('assets/favicon.png', renderIcon(48, { background: true, scale: 1 }));

function renderIcon(size, options) {
  const supersampling = 4;
  const canvas = createCanvas(size * supersampling, size * supersampling);
  const canvasSize = size * supersampling;

  if (options.background) {
    fillRect(canvas, 0, 0, canvasSize, canvasSize, colors.background);
  }

  drawMark(canvas, canvasSize, options.scale);
  return downsample(canvas, size, size);
}

function drawMark(canvas, size, markScale) {
  const cx = size / 2;
  const cy = size / 2;
  const scaleX = (value) => cx + (value - 0.5) * size * markScale;
  const scaleY = (value) => cy + (value - 0.5) * size * markScale;
  const arrowStroke = size * 0.088 * markScale;
  const trayStroke = size * 0.056 * markScale;

  strokeLine(canvas, scaleX(0.5), scaleY(0.22), scaleX(0.5), scaleY(0.59), colors.foreground, arrowStroke);
  strokeLine(canvas, scaleX(0.34), scaleY(0.43), scaleX(0.5), scaleY(0.59), colors.foreground, arrowStroke);
  strokeLine(canvas, scaleX(0.66), scaleY(0.43), scaleX(0.5), scaleY(0.59), colors.foreground, arrowStroke);

  const trayPoints = [
    [0.30, 0.69],
    [0.30, 0.73],
    [0.305, 0.755],
    [0.32, 0.78],
    [0.345, 0.80],
    [0.38, 0.81],
    [0.62, 0.81],
    [0.655, 0.80],
    [0.68, 0.78],
    [0.695, 0.755],
    [0.70, 0.73],
    [0.70, 0.69],
  ].map(([x, y]) => [scaleX(x), scaleY(y)]);

  strokePolyline(canvas, trayPoints, colors.accent, trayStroke);
}

function createCanvas(width, height) {
  const png = new PNG({ width, height, colorType: 6 });
  png.data.fill(0);
  return png;
}

function fillRect(canvas, x, y, width, height, color) {
  const parsed = parseColor(color);
  for (let py = Math.max(0, Math.floor(y)); py < Math.min(canvas.height, Math.ceil(y + height)); py += 1) {
    for (let px = Math.max(0, Math.floor(x)); px < Math.min(canvas.width, Math.ceil(x + width)); px += 1) {
      setPixel(canvas, px, py, parsed);
    }
  }
}

function strokePolyline(canvas, points, color, width) {
  for (let index = 0; index < points.length - 1; index += 1) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[index + 1];
    strokeLine(canvas, x1, y1, x2, y2, color, width);
  }
}

function strokeLine(canvas, x1, y1, x2, y2, color, width) {
  const parsed = parseColor(color);
  const minX = Math.floor(Math.min(x1, x2) - width);
  const maxX = Math.ceil(Math.max(x1, x2) + width);
  const minY = Math.floor(Math.min(y1, y2) - width);
  const maxY = Math.ceil(Math.max(y1, y2) + width);
  const lengthSquared = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  const radius = width / 2;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const position = lengthSquared === 0
        ? 0
        : Math.max(0, Math.min(1, ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / lengthSquared));
      const nearestX = x1 + position * (x2 - x1);
      const nearestY = y1 + position * (y2 - y1);
      if ((x - nearestX) ** 2 + (y - nearestY) ** 2 <= radius ** 2) {
        blendPixel(canvas, x, y, parsed);
      }
    }
  }
}

function downsample(source, width, height) {
  const target = new PNG({ width, height, colorType: 6 });
  const scaleX = source.width / width;
  const scaleY = source.height / height;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const totals = [0, 0, 0, 0];
      let samples = 0;
      for (let sy = Math.floor(y * scaleY); sy < Math.floor((y + 1) * scaleY); sy += 1) {
        for (let sx = Math.floor(x * scaleX); sx < Math.floor((x + 1) * scaleX); sx += 1) {
          const sourceIndex = (source.width * sy + sx) * 4;
          totals[0] += source.data[sourceIndex];
          totals[1] += source.data[sourceIndex + 1];
          totals[2] += source.data[sourceIndex + 2];
          totals[3] += source.data[sourceIndex + 3];
          samples += 1;
        }
      }
      const targetIndex = (width * y + x) * 4;
      target.data[targetIndex] = Math.round(totals[0] / samples);
      target.data[targetIndex + 1] = Math.round(totals[1] / samples);
      target.data[targetIndex + 2] = Math.round(totals[2] / samples);
      target.data[targetIndex + 3] = Math.round(totals[3] / samples);
    }
  }

  return PNG.sync.write(target);
}

function parseColor(value) {
  const hex = value.replace('#', '');
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
    a: 255,
  };
}

function setPixel(canvas, x, y, color) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
    return;
  }
  const index = (canvas.width * y + x) * 4;
  canvas.data[index] = color.r;
  canvas.data[index + 1] = color.g;
  canvas.data[index + 2] = color.b;
  canvas.data[index + 3] = color.a;
}

function blendPixel(canvas, x, y, color) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
    return;
  }
  const index = (canvas.width * y + x) * 4;
  const alpha = color.a / 255;
  const inverse = 1 - alpha;
  canvas.data[index] = Math.round(color.r * alpha + canvas.data[index] * inverse);
  canvas.data[index + 1] = Math.round(color.g * alpha + canvas.data[index + 1] * inverse);
  canvas.data[index + 2] = Math.round(color.b * alpha + canvas.data[index + 2] * inverse);
  canvas.data[index + 3] = Math.round(255 * (alpha + (canvas.data[index + 3] / 255) * inverse));
}
