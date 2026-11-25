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
  // A board square to the fence (end along ±Y) keeps the piece toward the operator.
  const keep = Math.abs(end[0]) < 1e-6 ? 'front' : end[0] > 0 ? 'left' : 'right';
  return { miter: clean(miter), bevel: clean(bevel), keep, placement, jointN, side, body: neg(end) };
}

/** Rotate a placement about the saw's vertical axis (the board turned on the table). */
function rotatePlacement(p, thetaDeg) {
  const t = rad(thetaDeg), c = Math.cos(t), s = Math.sin(t);
  const rz = (v) => [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]];
  return { ...p, U: rz(p.U), V: rz(p.V) };
}

const SWAP_EDGE = { upper: 'lower', lower: 'upper', outer: 'opening', opening: 'outer' };

/**
 * A miter too steep for the saw, made by turning the board on the table and clamping it:
 *   alpha = 45 (or another block angle): board held against an angled block on the fence;
 *           the saw only needs |miter| - alpha.
 *   alpha = 90: board clamped square to the fence; the saw needs 90 - |miter|.
 * Turning the board leaves the bevel unchanged except when the board must also be
 * turned end for end (so its long part runs toward the operator, not into the fence),
 * which flips the bevel's direction.
 * Returns null when no clamped setup works for this saw.
 */
export function clampedVariant(r, alpha, tilt = 'dual') {
  if (!r?.placement || Math.abs(r.miter) < 1e-9) return null;
  const base = -Math.sign(r.miter) * alpha;
  // Turning end for end only makes sense when either edge can face the fence.
  const flippable = r.placement.kind === 'flat' || r.placement.kind === 'frame';
  const tries = flippable ? [[base, false], [base + 180, true]] : [[base, false]];
  for (const [theta, flip] of tries) {
    const p = rotatePlacement(r.placement, theta);
    if (flip) p.fenceEdge = SWAP_EDGE[p.fenceEdge] ?? p.fenceEdge;
    const v = solvePlacement(r.jointN, r.side, p);
    if (v.body[1] > -1e-6) continue; // long part would run into the fence
    const tiltOk = tilt === 'dual' || Math.abs(v.bevel) < 1e-9 || (tilt === 'left' ? v.bevel > 0 : v.bevel < 0);
    if (!tiltOk) continue;
    v.clamped = { method: alpha >= 89.9 ? 'square' : 'block', angle: alpha, theta, flip };
    for (const k of ['cut', 'longPoint']) if (k in r) v[k] = r[k];
    return v;
  }
  return null;
}

/**
 * Clamped setup using the preferred method, falling back to the other method
 * (angled block <-> square to fence) when the preferred one can't work on this saw.
 */
export function clampedSetup(r, preferredAlpha, tilt = 'dual') {
  const first = clampedVariant(r, preferredAlpha, tilt);
  if (first) return first;
  const other = clampedVariant(r, preferredAlpha >= 89.9 ? 45 : 90, tilt);
  if (other) other.clamped.fallback = true;
  return other;
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
 * Crown on a sloped (raked) ceiling: two pieces on the SAME wall that meet at an angle
 * in the plane of the wall, such as level crown turning up a gable or stair wall, the
 * top of a rake, or two rakes meeting at a peak.
 *
 * Where a ceiling slopes along a wall (a gable or stair wall), the ceiling is still
 * square to the wall in the crown's own cross-section, so the crown sits at its normal
 * spring angle and only its run tilts. The joint plane then lies square to the wall and
 * bisects the two runs, so the profiles match exactly.
 *
 * @param {number} o.leftSlope   left piece: degrees above level, going AWAY from the joint
 * @param {number} o.rightSlope  right piece: same, going away from the joint
 *                               (left/right as seen facing the wall from the room)
 */
export function rakeJoint(leftSlope, rightSlope) {
  // Wall coordinates seen from the room: u = right, v = up.
  const a = rad(leftSlope), b = rad(rightSlope);
  const bA = [-Math.cos(a), Math.sin(a)]; // left piece body, from the joint
  const bB = [Math.cos(b), Math.sin(b)]; // right piece body, from the joint
  const mx = bA[0] - bB[0], my = bA[1] - bB[1];
  const len = Math.hypot(mx, my);
  if (len < 1e-6) return null; // pieces overlap
  const m = [mx / len, my / len];
  // Piece frame: X' along the piece toward the viewer's left, Z' square to the run,
  // up toward the ceiling, Y' out of the wall.
  const inFrame = (X) => {
    const Z = [X[1], -X[0]];
    return [m[0] * X[0] + m[1] * X[1], 0, m[0] * Z[0] + m[1] * Z[1]];
  };
  return {
    left: inFrame(bA), // joint at the left piece's -X' end
    right: inFrame([-bB[0], -bB[1]]), // joint at the right piece's +X' end
    bodies: { left: bA, right: bB },
    jointLine: [-m[1], m[0]],
  };
}

export function crownRake({ leftSlope, rightSlope, springDeg, tilt = 'left' }) {
  const j = rakeJoint(leftSlope, rightSlope);
  if (!j) return null;
  const frame = boardFrame(springDeg);
  const flat = {
    left: pickPlacement(j.left, 'left', [flatPlacement(frame, true), flatPlacement(frame, false)], tilt),
    right: pickPlacement(j.right, 'right', [flatPlacement(frame, true), flatPlacement(frame, false)], tilt),
  };
  // Nested crown has only one way to sit on the saw, so the bevel direction is fixed;
  // `canTilt` tells the app whether this saw can make it.
  const nested = (n, side) => {
    const r = solvePlacement(n, side, nestedPlacement());
    r.canTilt = tilt === 'dual' || Math.abs(r.bevel) < 1e-9 || (tilt === 'left' ? r.bevel > 0 : r.bevel < 0);
    return r;
  };
  return {
    flat,
    nested: { left: nested(j.left, 'left'), right: nested(j.right, 'right') },
    joint: j,
  };
}

/** Convert a roof-style pitch (rise per 12 run) to degrees and back. */
export const riseToDeg = (rise) => deg(Math.atan(rise / 12));
export const degToRise = (d) => 12 * Math.tan(rad(d));

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
  // Solve each piece with the same 3D engine as everything else, so clamped variants work.
  // Local frame of each board: body along -x (right board) or +x (left board) from the
  // corner, inner edge on y = 0, outer edge at y = -width, face up (+z). The joint's normal
  // is square to the in-plane line at `m` from square across the board.
  const boardFrame2 = { width: [0, -1, 0], face: [0, 0, 1] }; // "upper" edge = outer edge
  const piece = (m, side) => {
    const t = rad(m);
    const n = side === 'left' ? [Math.cos(t), -Math.sin(t), 0] : [-Math.cos(t), -Math.sin(t), 0];
    const pl = { ...flatPlacement(boardFrame2, true), kind: 'frame', fenceEdge: 'outer' };
    const r = solvePlacement(n, side, pl);
    r.cut = m; // + = long point on the outer edge
    r.longPoint = Math.abs(m) < 1e-9 ? 'none' : m > 0 ? 'outer' : 'opening';
    return r;
  };
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
