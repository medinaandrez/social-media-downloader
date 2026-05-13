import { writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';

const colors = {
  background: '#071511',
  backgroundLight: '#0d201b',
  accent: '#50d4b4',
  accentDark: '#12856f',
  white: '#f7fffb',
};

await writeFile('assets/icon.png', renderIcon(1024, { background: true, scale: 1 }));
await writeFile('assets/adaptive-icon.png', renderIcon(1024, { background: false, scale: 0.92 }));
await writeFile('assets/splash-icon.png', renderIcon(1024, { background: false, scale: 0.82 }));
await writeFile('assets/favicon.png', renderIcon(48, { background: true, scale: 1 }));

function renderIcon(size, options) {
  const scale = 4;
  const canvas = createCanvas(size * scale, size * scale);
  const s = size * scale;

  if (options.background) {
    fillRect(canvas, 0, 0, s, s, colors.background);
    fillCircle(canvas, s * 0.22, s * 0.18, s * 0.52, rgba(colors.backgroundLight, 0.9));
    fillCircle(canvas, s * 0.86, s * 0.82, s * 0.48, rgba(colors.accentDark, 0.2));
  }

  const markScale = options.scale;
  const cx = s / 2;
  const cy = s / 2;
  const unit = s * 0.54 * markScale;
  const left = cx - unit / 2;
  const top = cy - unit / 2;

  roundRect(canvas, left, top, unit, unit, unit * 0.18, rgba(colors.white, 0.08));
  strokeRoundRect(canvas, left, top, unit, unit, unit * 0.18, colors.accent, Math.max(10 * scale, s * 0.018));

  const play = [
    [cx - unit * 0.12, cy - unit * 0.22],
    [cx - unit * 0.12, cy + unit * 0.22],
    [cx + unit * 0.24, cy],
  ];
  fillPolygon(canvas, play, colors.white);

  const arrowX = cx;
  const arrowTop = cy + unit * 0.17;
  const arrowBottom = cy + unit * 0.39;
  const stroke = Math.max(13 * scale, s * 0.022);
  strokeLine(canvas, arrowX, arrowTop, arrowX, arrowBottom, colors.accent, stroke);
  strokeLine(canvas, arrowX, arrowBottom, arrowX - unit * 0.12, arrowBottom - unit * 0.12, colors.accent, stroke);
  strokeLine(canvas, arrowX, arrowBottom, arrowX + unit * 0.12, arrowBottom - unit * 0.12, colors.accent, stroke);
  strokeLine(canvas, cx - unit * 0.22, cy + unit * 0.47, cx + unit * 0.22, cy + unit * 0.47, colors.accent, stroke);

  return downsample(canvas, size, size);
}

function createCanvas(width, height) {
  const png = new PNG({ width, height, colorType: 6 });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 0;
    png.data[i + 1] = 0;
    png.data[i + 2] = 0;
    png.data[i + 3] = 0;
  }
  return png;
}

function fillRect(canvas, x, y, width, height, color) {
  const c = parseColor(color);
  for (let py = Math.max(0, Math.floor(y)); py < Math.min(canvas.height, Math.ceil(y + height)); py += 1) {
    for (let px = Math.max(0, Math.floor(x)); px < Math.min(canvas.width, Math.ceil(x + width)); px += 1) {
      setPixel(canvas, px, py, c);
    }
  }
}

function fillCircle(canvas, cx, cy, radius, color) {
  const c = parseColor(color);
  const r2 = radius * radius;
  for (let y = Math.max(0, Math.floor(cy - radius)); y < Math.min(canvas.height, Math.ceil(cy + radius)); y += 1) {
    for (let x = Math.max(0, Math.floor(cx - radius)); x < Math.min(canvas.width, Math.ceil(cx + radius)); x += 1) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) {
        blendPixel(canvas, x, y, c);
      }
    }
  }
}

function roundRect(canvas, x, y, width, height, radius, color) {
  const c = parseColor(color);
  for (let py = Math.floor(y); py < Math.ceil(y + height); py += 1) {
    for (let px = Math.floor(x); px < Math.ceil(x + width); px += 1) {
      if (insideRoundRect(px, py, x, y, width, height, radius)) {
        blendPixel(canvas, px, py, c);
      }
    }
  }
}

function strokeRoundRect(canvas, x, y, width, height, radius, color, strokeWidth) {
  const c = parseColor(color);
  for (let py = Math.floor(y - strokeWidth); py < Math.ceil(y + height + strokeWidth); py += 1) {
    for (let px = Math.floor(x - strokeWidth); px < Math.ceil(x + width + strokeWidth); px += 1) {
      const outer = insideRoundRect(px, py, x, y, width, height, radius);
      const inner = insideRoundRect(
        px,
        py,
        x + strokeWidth,
        y + strokeWidth,
        width - strokeWidth * 2,
        height - strokeWidth * 2,
        Math.max(0, radius - strokeWidth),
      );
      if (outer && !inner) {
        blendPixel(canvas, px, py, c);
      }
    }
  }
}

function insideRoundRect(px, py, x, y, width, height, radius) {
  const rx = Math.max(x + radius, Math.min(px, x + width - radius));
  const ry = Math.max(y + radius, Math.min(py, y + height - radius));
  return (px - rx) ** 2 + (py - ry) ** 2 <= radius ** 2;
}

function fillPolygon(canvas, points, color) {
  const c = parseColor(color);
  const minY = Math.floor(Math.min(...points.map((point) => point[1])));
  const maxY = Math.ceil(Math.max(...points.map((point) => point[1])));

  for (let y = minY; y <= maxY; y += 1) {
    const intersections = [];
    for (let i = 0; i < points.length; i += 1) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[(i + 1) % points.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        intersections.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
      }
    }
    intersections.sort((a, b) => a - b);
    for (let i = 0; i < intersections.length; i += 2) {
      for (let x = Math.floor(intersections[i]); x <= Math.ceil(intersections[i + 1]); x += 1) {
        blendPixel(canvas, x, y, c);
      }
    }
  }
}

function strokeLine(canvas, x1, y1, x2, y2, color, width) {
  const c = parseColor(color);
  const minX = Math.floor(Math.min(x1, x2) - width);
  const maxX = Math.ceil(Math.max(x1, x2) + width);
  const minY = Math.floor(Math.min(y1, y2) - width);
  const maxY = Math.ceil(Math.max(y1, y2) + width);
  const length2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  const radius = width / 2;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const t = Math.max(0, Math.min(1, ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / length2));
      const px = x1 + t * (x2 - x1);
      const py = y1 + t * (y2 - y1);
      if ((x - px) ** 2 + (y - py) ** 2 <= radius ** 2) {
        blendPixel(canvas, x, y, c);
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
          const index = (source.width * sy + sx) * 4;
          totals[0] += source.data[index];
          totals[1] += source.data[index + 1];
          totals[2] += source.data[index + 2];
          totals[3] += source.data[index + 3];
          samples += 1;
        }
      }
      const index = (width * y + x) * 4;
      target.data[index] = Math.round(totals[0] / samples);
      target.data[index + 1] = Math.round(totals[1] / samples);
      target.data[index + 2] = Math.round(totals[2] / samples);
      target.data[index + 3] = Math.round(totals[3] / samples);
    }
  }

  return PNG.sync.write(target);
}

function rgba(hex, alpha) {
  const c = parseColor(hex);
  return { ...c, a: Math.round(alpha * 255) };
}

function parseColor(value) {
  if (typeof value === 'object') {
    return value;
  }
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
