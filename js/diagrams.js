// SVG diagrams. All geometry comes from the solved numbers, so the pictures can't
// disagree with the settings shown next to them.
import { rad } from './geometry.js';

const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1).replace(/\.0$/, '');
const P = (x, y) => `${x.toFixed(1)},${y.toFixed(1)}`;

function arc(cx, cy, r, a0, a1) {
  // angles in degrees, screen coords (0 = +x, 90 = down)
  const x0 = cx + r * Math.cos(rad(a0)), y0 = cy + r * Math.sin(rad(a0));
  const x1 = cx + r * Math.cos(rad(a1)), y1 = cy + r * Math.sin(rad(a1));
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const sweep = a1 > a0 ? 1 : 0;
  return `M${P(x0, y0)} A${r},${r} 0 ${large} ${sweep} ${P(x1, y1)}`;
}

/** Plan view of the corner, viewer standing in the room facing it. */
export function roomDiagram(corner, W) {
  const h = rad(W) / 2;
  const s = Math.sin(h), c = Math.cos(h);
  const inside = corner === 'inside';
  const cx = 120, cy = inside ? 22 : 92;
  const L = 95;
  const dirs = inside ? [[-s, c], [s, c]] : [[-s, -c], [s, -c]];
  const out = [];
  out.push(`<svg viewBox="0 0 240 150" role="img" aria-label="${inside ? 'Inside' : 'Outside'} corner, ${f1(W)} degrees, seen from above">`);
  if (!inside) {
    // wall material between the two walls
    out.push(`<path d="M${P(cx, cy)} L${P(cx + dirs[0][0] * L, cy + dirs[0][1] * L)} L${P(cx + dirs[1][0] * L, cy + dirs[1][1] * L)} Z" fill="var(--line)"/>`);
  }
  dirs.forEach(([dx, dy], i) => {
    out.push(`<line x1="${cx}" y1="${cy}" x2="${(cx + dx * L).toFixed(1)}" y2="${(cy + dy * L).toFixed(1)}" stroke="var(--muted)" stroke-width="5" stroke-linecap="round"/>`);
    // trim offset toward the room
    let nx = -dy, ny = dx; // perpendicular
    const towardCenter = i === 0 ? nx > 0 : nx < 0;
    if (inside !== towardCenter) { nx = -nx; ny = -ny; }
    const o = 8, a = 10, b = L - 6;
    out.push(`<line x1="${(cx + dx * a + nx * o).toFixed(1)}" y1="${(cy + dy * a + ny * o).toFixed(1)}" x2="${(cx + dx * b + nx * o).toFixed(1)}" y2="${(cy + dy * b + ny * o).toFixed(1)}" stroke="var(--accent)" stroke-width="5" stroke-linecap="round"/>`);
    const tx = cx + dx * L * 0.62 + nx * 24, ty = cy + dy * L * 0.62 + ny * 24;
    out.push(`<text x="${tx.toFixed(1)}" y="${(ty + 5).toFixed(1)}" text-anchor="middle" font-size="14" font-weight="700" fill="var(--accent)">${i === 0 ? 'L' : 'R'}</text>`);
  });
  // angle arc on the side that was measured
  const a0 = Math.atan2(dirs[0][1], dirs[0][0]) * 180 / Math.PI;
  const a1 = Math.atan2(dirs[1][1], dirs[1][0]) * 180 / Math.PI;
  out.push(`<path d="${arc(cx, cy, 26, Math.min(a0, a1), Math.max(a0, a1))}" fill="none" stroke="var(--ink)" stroke-width="1.5"/>`);
  out.push(`<text x="${cx}" y="${inside ? cy + 46 : cy - 34}" text-anchor="middle" font-size="13" font-weight="600" fill="var(--ink)">${f1(W)}°</text>`);
  // viewer
  out.push(`<text x="${cx}" y="146" text-anchor="middle" font-size="11" fill="var(--muted)">you, facing the corner</text>`);
  out.push(`<path d="M${cx} 132 l0 -10 m-4 4 l4 -4 l4 4" fill="none" stroke="var(--muted)" stroke-width="1.5"/>`);
  out.push('</svg>');
  return out.join('');
}

/** Crown in section against wall and ceiling, showing which angle is being entered. */
export function crownSection(spring, ref) {
  const wx = 18, cy = 12, L = 74;
  const S = rad(spring);
  const a = L * Math.cos(S), b = L * Math.sin(S);
  const wall = [wx, cy + a], ceil = [wx + b, cy];
  const out = [`<svg viewBox="0 0 110 100" role="img" aria-label="Crown section, ${f1(spring)} degree spring angle">`];
  out.push(`<line x1="${wx}" y1="${cy}" x2="${wx}" y2="98" stroke="var(--muted)" stroke-width="4"/>`);
  out.push(`<line x1="${wx}" y1="${cy}" x2="108" y2="${cy}" stroke="var(--muted)" stroke-width="4"/>`);
  out.push(`<text x="${wx + 4}" y="96" font-size="9" fill="var(--muted)">wall</text>`);
  out.push(`<text x="104" y="${cy + 11}" text-anchor="end" font-size="9" fill="var(--muted)">ceiling</text>`);
  // the back plane of the crown (what lies on the saw table when cut flat)
  out.push(`<line x1="${wall[0]}" y1="${wall[1].toFixed(1)}" x2="${ceil[0].toFixed(1)}" y2="${ceil[1].toFixed(1)}" stroke="var(--accent)" stroke-width="6" stroke-linecap="round"/>`);
  if (ref === 'plumb') {
    // angle between plumb (up the wall) and the crown back, at the wall contact
    out.push(`<path d="${arc(wall[0], wall[1], 20, -90, -90 + spring)}" fill="none" stroke="var(--ink)" stroke-width="1.5"/>`);
    out.push(`<text x="${wall[0] + 6}" y="${wall[1] - 24}" font-size="11" font-weight="700" fill="var(--ink)">${f1(spring)}°</text>`);
  } else {
    out.push(`<path d="${arc(ceil[0], ceil[1], 20, 180 - (90 - spring), 180)}" fill="none" stroke="var(--ink)" stroke-width="1.5"/>`);
    out.push(`<text x="${ceil[0] - 26}" y="${ceil[1] + 22}" text-anchor="end" font-size="11" font-weight="700" fill="var(--ink)">${f1(90 - spring)}°</text>`);
  }
  out.push('</svg>');
  return out.join('');
}

/** A flat board leaning out (or in) from plumb. */
export function tiltSection(tiltDeg, ref) {
  const bx = 55, by = 90, L = 72;
  const T = rad(tiltDeg);
  const tx = bx + L * Math.sin(T), ty = by - L * Math.cos(T);
  const out = [`<svg viewBox="0 0 110 100" role="img" aria-label="Board tilted ${f1(Math.abs(tiltDeg))} degrees from plumb">`];
  out.push(`<line x1="6" y1="${by + 4}" x2="104" y2="${by + 4}" stroke="var(--muted)" stroke-width="2"/>`);
  out.push(`<line x1="${bx}" y1="${by}" x2="${bx}" y2="10" stroke="var(--muted)" stroke-width="1" stroke-dasharray="3 3"/>`);
  out.push(`<line x1="${bx}" y1="${by}" x2="${tx.toFixed(1)}" y2="${ty.toFixed(1)}" stroke="var(--accent)" stroke-width="7" stroke-linecap="round"/>`);
  if (ref === 'plumb') {
    const a0 = -90, a1 = -90 + tiltDeg;
    out.push(`<path d="${arc(bx, by, 30, Math.min(a0, a1), Math.max(a0, a1))}" fill="none" stroke="var(--ink)" stroke-width="1.5"/>`);
    out.push(`<text x="${bx + (tiltDeg >= 0 ? 6 : -6)}" y="${by - 36}" text-anchor="${tiltDeg >= 0 ? 'start' : 'end'}" font-size="11" font-weight="700" fill="var(--ink)">${f1(Math.abs(tiltDeg))}°</text>`);
  } else {
    // angle from the level line on the side the board leans away from
    const lv = tiltDeg >= 0 ? 180 : 0;
    const bd = -90 + tiltDeg;
    const a0 = Math.min(lv === 180 ? -180 : 0, bd), a1 = Math.max(lv === 180 ? -180 : 0, bd);
    out.push(`<path d="${arc(bx, by, 22, a0, a1)}" fill="none" stroke="var(--ink)" stroke-width="1.5"/>`);
    out.push(`<text x="${bx + (tiltDeg >= 0 ? -26 : 26)}" y="${by - 10}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--ink)">${f1(90 - Math.abs(tiltDeg))}°</text>`);
  }
  out.push(`<text x="104" y="22" text-anchor="end" font-size="9" fill="var(--muted)">out →</text>`);
  out.push('</svg>');
  return out.join('');
}

/**
 * Top view of the saw: fence at the top, operator at the bottom.
 * r: solved piece {miter, bevel, keep}; labels: {fence, front}
 */
export function sawDiagram(r, labels) {
  const x0 = 16, x1 = 304, yb = 34, yf = 104, cx = 160, cy = (yb + yf) / 2;
  const t = Math.tan(rad(r.miter));
  const xAt = (y) => cx - (cy - y) * t; // blade line, handle-right = front end moves right
  const xb = xAt(yb), xf = xAt(yf);
  const left = `M${P(x0, yb)} L${P(xb, yb)} L${P(xf, yf)} L${P(x0, yf)} Z`;
  const right = `M${P(xb, yb)} L${P(x1, yb)} L${P(x1, yf)} L${P(xf, yf)} Z`;
  const keepLeft = r.keep === 'left';
  const out = [`<svg viewBox="0 0 320 196" role="img" aria-label="Top view of the board on the saw. Keep the ${r.keep} piece.">`];
  out.push('<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="var(--muted)" stroke-width="1" opacity=".5"/></pattern></defs>');
  out.push(`<rect x="6" y="18" width="308" height="14" rx="3" fill="var(--muted)" opacity=".55"/>`);
  out.push(`<text x="160" y="29" text-anchor="middle" font-size="10" font-weight="700" fill="var(--bg)" letter-spacing="2">FENCE</text>`);
  out.push(`<path d="${keepLeft ? left : right}" fill="var(--keep)" stroke="var(--keep-edge)" stroke-width="1.5"/>`);
  out.push(`<path d="${keepLeft ? right : left}" fill="var(--waste)"/><path d="${keepLeft ? right : left}" fill="url(#hatch)"/>`);
  // labels on the board
  const kx = keepLeft ? (x0 + Math.min(xb, xf)) / 2 : (x1 + Math.max(xb, xf)) / 2;
  const wx = keepLeft ? (x1 + Math.max(xb, xf)) / 2 : (x0 + Math.min(xb, xf)) / 2;
  out.push(`<text x="${kx.toFixed(1)}" y="${cy + 5}" text-anchor="middle" font-size="15" font-weight="800" fill="var(--ink)">KEEP</text>`);
  out.push(`<text x="${wx.toFixed(1)}" y="${cy + 4}" text-anchor="middle" font-size="11" fill="var(--muted)">scrap</text>`);
  out.push(`<text x="${keepLeft ? x0 + 6 : x1 - 6}" y="${yb + 12}" text-anchor="${keepLeft ? 'start' : 'end'}" font-size="10" fill="var(--ink)">▲ ${labels.fence}</text>`);
  out.push(`<text x="${keepLeft ? x0 + 6 : x1 - 6}" y="${yf - 5}" text-anchor="${keepLeft ? 'start' : 'end'}" font-size="10" fill="var(--ink)">▼ ${labels.front}</text>`);
  // blade line + handle
  const ext = 10;
  const xbe = xAt(yb - ext), xfe = xAt(yf + ext);
  out.push(`<line x1="${xbe.toFixed(1)}" y1="${yb - ext}" x2="${xfe.toFixed(1)}" y2="${yf + ext}" stroke="var(--blade)" stroke-width="3" stroke-dasharray="${Math.abs(r.bevel) > 0.05 ? '7 4' : 'none'}"/>`);
  const hx = xAt(yf + 26);
  out.push(`<line x1="${xfe.toFixed(1)}" y1="${yf + ext}" x2="${hx.toFixed(1)}" y2="${yf + 26}" stroke="var(--blade)" stroke-width="3"/>`);
  out.push(`<circle cx="${hx.toFixed(1)}" cy="${yf + 30}" r="7" fill="var(--blade)"/>`);
  const mdir = Math.abs(r.miter) < 0.05 ? 'square (0°)' : `handle ${r.miter > 0 ? 'RIGHT' : 'LEFT'} ${f1(Math.abs(r.miter))}°`;
  // label goes on the side away from the swing so it stays inside the picture
  out.push(`<text x="${(hx + (r.miter > 0 ? -12 : 12)).toFixed(1)}" y="${yf + 34}" text-anchor="${r.miter > 0 ? 'end' : 'start'}" font-size="11" font-weight="700" fill="var(--blade)">${mdir}</text>`);
  // bevel glyph: front view of the blade
  const gx = 40, gy = 186, gl = 34, B = rad(r.bevel);
  out.push(`<line x1="${gx - 26}" y1="${gy}" x2="${gx + 26}" y2="${gy}" stroke="var(--muted)" stroke-width="2"/>`);
  out.push(`<line x1="${gx}" y1="${gy}" x2="${(gx - gl * Math.sin(B)).toFixed(1)}" y2="${(gy - gl * Math.cos(B)).toFixed(1)}" stroke="var(--blade)" stroke-width="4" stroke-linecap="round"/>`);
  const bdir = Math.abs(r.bevel) < 0.05 ? 'blade straight up (0° bevel)' : `blade tilted ${r.bevel > 0 ? 'LEFT' : 'RIGHT'} ${f1(Math.abs(r.bevel))}°`;
  out.push(`<text x="${gx + 34}" y="${gy - 6}" font-size="11" font-weight="700" fill="var(--blade)">${bdir}</text>`);
  out.push(`<text x="${gx + 34}" y="${gy - 20}" font-size="9" fill="var(--muted)">viewed from the front</text>`);
  out.push('</svg>');
  return out.join('');
}
