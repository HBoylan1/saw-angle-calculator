// Saw Angle Calculator — geometry engine
//
// Every cut is solved the same way, in 3D:
//   1. Describe one piece of trim in its own "piece frame":
//        X' = along the wall,  Y' = out from the wall into the room,  Z' = up.
//      The wall is the plane Y' = 0.
//   2. Find the plane the joint must lie on (for a symmetric corner, the vertical
//      plane that bisects the corner in plan view).
//   3. Rotate that plane into the "saw frame" for the way the board sits on the saw:
//        X = operator's right,  Y = toward the fence,  Z = up.
//   4. Read the saw settings off the plane's normal vector n:
//        blade normal = (cos M · cos B,  sin M · cos B,  sin B)
//        M > 0  → swing the handle to the RIGHT,   B > 0 → tilt the blade to the LEFT.
//
// Because steps 3–4 are pure geometry, left/right directions and which side of the
// blade to keep fall out of the math instead of being copied from a chart.

const D = Math.PI / 180;
export const deg = (r) => r / D;
export const rad = (d) => d * D;

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const add = (...vs) => vs.reduce((s, v) => [s[0] + v[0], s[1] + v[1], s[2] + v[2]], [0, 0, 0]);
const norm = (a) => scale(a, 1 / Math.hypot(a[0], a[1], a[2]));

export const SAW = { X: [1, 0, 0], Y: [0, 1, 0], Z: [0, 0, 1] };
const neg = (a) => scale(a, -1);

/**
 * Plane of the joint, as a unit normal in the piece frame.
 * @param {number} cornerDeg  angle between the two wall surfaces, measured on the side
 *                            that is under 180° (what an angle finder reads)
 * @param {'inside'|'outside'} corner
 * @param {'left'|'right'} side  which piece, as seen standing in the room facing the corner
 */
export function jointNormal(cornerDeg, corner, side) {
  const h = rad(cornerDeg) / 2;
  const s = Math.sin(h);
  const c = Math.cos(h);
  // Right piece: the corner is at the +X' end. Left piece: at the -X' end.
  // Inside corner, right piece → (s, +c, 0); each flip (left or outside) flips the Y' sign.
  const flips = (corner === 'outside' ? 1 : 0) + (side === 'left' ? 1 : 0);
  return [s, flips % 2 === 0 ? c : -c, 0];
}

/** Direction (piece frame) from the body of the board toward the cut end. */
export const cutEndDir = (side) => (side === 'right' ? [1, 0, 0] : [-1, 0, 0]);

/**
 * Board cross-section, tilted `tiltDeg` from plumb, leaning out into the room.
 * width: direction across the board from its lower (wall) edge to its upper edge.
 * face:  outward normal of the show face.
 */
export function boardFrame(tiltDeg) {
  const t = rad(tiltDeg);
  return {
    width: [0, Math.sin(t), Math.cos(t)],
    face: [0, Math.cos(t), -Math.sin(t)],
  };
}

/**
 * Rotate a piece-frame vector into the saw frame. The placement says where two
 * orthonormal piece-frame vectors u, v end up (U, V); u×v goes to U×V.
 */
function toSaw(vec, p) {
  const w = cross(p.u, p.v);
  const W = cross(p.U, p.V);
  return add(scale(p.U, dot(vec, p.u)), scale(p.V, dot(vec, p.v)), scale(W, dot(vec, w)));
}

/** Turn a saw-frame plane normal into miter/bevel settings. */
export function sawSettings(nSaw) {
  let n = norm(nSaw);
  if (n[0] < 0 || (Math.abs(n[0]) < 1e-12 && n[1] < 0)) n = neg(n);
  const bevel = deg(Math.asin(Math.max(-1, Math.min(1, n[2]))));
  const miter = deg(Math.atan2(n[1], n[0]));
  return { miter, bevel };
}

/**
 * Solve one piece for one placement on the saw.
 * Returns signed miter (+ = handle right) / bevel (+ = blade tilts left),
 * and which side of the blade to keep.
 */
export function solvePlacement(jointN, side, placement) {
  const nSaw = toSaw(jointN, placement);
  const { miter, bevel } = sawSettings(nSaw);
  const end = toSaw(cutEndDir(side), placement);
  // The cut end points toward +X → the board's body is on the left of the blade.
  const keep = end[0] > 0 ? 'left' : 'right';
  return { miter: clean(miter), bevel: clean(bevel), keep, placement };
}

const clean = (x) => (Math.abs(x) < 1e-9 ? 0 : x);

// ---------------------------------------------------------------------------
// Placements: how a board can sit on the saw.
// ---------------------------------------------------------------------------

/** Board lying flat (back / face on the table), show face up. */
export function flatPlacement(frame, upperEdgeToFence) {
  return {
    kind: 'flat',
    fenceEdge: upperEdgeToFence ? 'upper' : 'lower',
    u: frame.width, U: upperEdgeToFence ? SAW.Y : neg(SAW.Y),
    v: frame.face, V: SAW.Z,
  };
}

/** Crown "nested": upside down, wall flat against the fence, ceiling flat on the table. */
export function nestedPlacement() {
  return {
    kind: 'nested',
    fenceEdge: 'lower', // the wall edge rides on the fence
    u: [0, 1, 0], U: neg(SAW.Y), // wall normal → points at the operator
    v: [0, 0, 1], V: neg(SAW.Z), // up → down (upside down)
  };
}

/** Flat board standing on its lower edge, show face toward the operator. */
export function onEdgePlacement(frame) {
  return {
    kind: 'edge',
    fenceEdge: 'back',
    u: frame.width, U: SAW.Z,
    v: frame.face, V: neg(SAW.Y),
  };
}

// ---------------------------------------------------------------------------
// Saw capability: pick the placement a given saw can actually cut.
// ---------------------------------------------------------------------------

/**
 * @param {'dual'|'left'|'right'} tilt  directions the blade can bevel
 * Candidates are tried in order of preference; the first one the saw can make wins.
 */
function pickPlacement(jointN, side, candidates, tilt) {
  const results = candidates.map((p) => solvePlacement(jointN, side, p));
  const ok = (r) =>
    tilt === 'dual' || Math.abs(r.bevel) < 1e-9 ||
    (tilt === 'left' ? r.bevel > 0 : r.bevel < 0);
  return results.find(ok) ?? results[0];
}

/** Settings for both pieces (left and right, facing the corner). */
function bothPieces(cornerDeg, corner, solveOne) {
  return {
    left: solveOne(jointNormal(cornerDeg, corner, 'left'), 'left'),
    right: solveOne(jointNormal(cornerDeg, corner, 'right'), 'right'),
  };
}

// ---------------------------------------------------------------------------
// Public calculators
// ---------------------------------------------------------------------------

/**
 * Crown molding at a wall corner.
 * @param {object} o
 * @param {number} o.cornerDeg   full corner angle (angle finder reading)
 * @param {'inside'|'outside'} o.corner
 * @param {number} o.springDeg   spring angle: back of the crown measured from the wall (plumb)
 * @param {'dual'|'left'|'right'} o.tilt
 */
export function crown({ cornerDeg, corner, springDeg, tilt = 'left' }) {
  const frame = boardFrame(springDeg);
  const flat = bothPieces(cornerDeg, corner, (n, side) =>
    pickPlacement(n, side, [flatPlacement(frame, true), flatPlacement(frame, false)], tilt),
  );
  const nested = bothPieces(cornerDeg, corner, (n, side) =>
    solvePlacement(n, side, nestedPlacement()),
  );
  return { flat, nested };
}

/**
 * Flat board tilted out of plumb meeting another at a corner
 * (splayed box / hopper sides, tilted trim, baseboard when tilt = 0).
 * @param {number} o.tiltDeg  lean from plumb; positive = top leans out into the room
 *                            (for a box: out away from its center)
 */
export function compoundBoard({ cornerDeg, corner, tiltDeg, tilt = 'left' }) {
  const frame = boardFrame(tiltDeg);
  const flat = bothPieces(cornerDeg, corner, (n, side) =>
    pickPlacement(n, side, [flatPlacement(frame, true), flatPlacement(frame, false)], tilt),
  );
  const edge = bothPieces(cornerDeg, corner, (n, side) =>
    solvePlacement(n, side, onEdgePlacement(frame)),
  );
  return { flat, edge };
}

/**
 * Picture frame / door casing: boards lie flat in one plane, possibly different widths.
 *
 * Seen face-on, the joint must run from the point where the two inner (opening-side)
 * edges meet, I, to the point where the two outer edges meet, O. Each board's cut angle
 * is how far that line leans from square across that board:
 *     tan(m_left)  = (wL·cos W + wR) / (wL·sin W)
 *     tan(m_right) = (wR·cos W + wL) / (wR·sin W)
 * and m_left + m_right = 180° − W. Equal widths give the familiar 90° − W/2.
 *
 * m > 0: the long point is on the outer edge. m < 0: it is on the opening edge.
 *
 * @param {number} cornerDeg  angle between the inner edges, measured across the opening
 *                            (0–360; under 180 = inside corner, over 180 = outside corner)
 * @param {number} wLeft, wRight  board widths (any unit, same for both). Left and right
 *                            are as seen from inside the opening, facing the corner.
 *
 * Saw setup for both pieces: face up, outer edge against the fence. Signed miter uses the
 * same convention as everything else (+ = handle right).
 */
export function frame({ cornerDeg, wLeft = 1, wRight = 1 }) {
  const W = rad(cornerDeg);
  const mL = deg(Math.atan2(wLeft * Math.cos(W) + wRight, wLeft * Math.sin(W)));
  const mR = deg(Math.atan2(wRight * Math.cos(W) + wLeft, wRight * Math.sin(W)));
  // atan2 keeps the right quadrant when sin W < 0; fold into (-90, 90].
  const fold = (m) => (m > 90 ? m - 180 : m <= -90 ? m + 180 : m);
  const left = fold(mL), right = fold(mR);
  const piece = (m, side) => ({
    cut: m, // + = long point on the outer edge
    miter: clean(side === 'left' ? -m : m),
    bevel: 0,
    keep: side,
    longPoint: Math.abs(m) < 1e-9 ? 'none' : m > 0 ? 'outer' : 'opening',
    placement: { kind: 'frame', fenceEdge: 'outer' },
  });
  return {
    corner: cornerDeg < 180 ? 'inside' : 'outside',
    left: piece(left, 'left'),
    right: piece(right, 'right'),
  };
}

/** Where the outer edges meet, in the left board's frame (inner edge on +x, outer at y = -wL). */
export function frameOuterPoint(cornerDeg, wLeft, wRight) {
  const W = rad(cornerDeg);
  return [-(wLeft * Math.cos(W) + wRight) / Math.sin(W), -wLeft];
}

/** Parse a width like "3 1/2", "3-1/2", "3.5", "7/8" or "89". Returns NaN if unreadable. */
export function parseWidth(text) {
  const s = String(text).trim().replace(/["”″]|in(ches)?$/i, '').trim();
  let m = s.match(/^(\d+(?:\.\d+)?)?(?:[\s-]+)?(?:(\d+)\s*\/\s*(\d+))?$/);
  if (!m || (!m[1] && !m[2])) return NaN;
  const whole = m[1] ? parseFloat(m[1]) : 0;
  const frac = m[2] ? parseFloat(m[2]) / parseFloat(m[3]) : 0;
  if (m[2] && !(parseFloat(m[3]) > 0)) return NaN;
  return whole + frac;
}

/** Corner angle of a regular polygon with n sides (a box with n equal sides). */
export const polygonCorner = (n) => 180 - 360 / n;

/** Angle to rip the top/bottom edges of a tilted board so they sit level. */
export const edgeRip = (tiltDeg) => Math.abs(tiltDeg);

/** Common miter/bevel detents. */
export const DETENTS = [0, 15, 22.5, 30, 31.6, 33.9, 35.3, 45];
export function nearestDetent(x) {
  const a = Math.abs(x);
  let best = DETENTS[0];
  for (const d of DETENTS) if (Math.abs(d - a) < Math.abs(best - a)) best = d;
  return { detent: best, off: a - best };
}
