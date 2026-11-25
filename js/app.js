import * as G from './geometry.js';
import { roomDiagram, crownSection, tiltSection, sawDiagram, frameDiagram, wallDiagram, sawClampDiagram } from './diagrams.js';
import { VERSION } from './version.js';

// ---------------------------------------------------------------------------
// State (remembered on this phone between visits)
// ---------------------------------------------------------------------------
const DEFAULTS = {
  mode: 'crown',
  corner: 'inside',
  W: 90,
  spring: 38, // crown: back of the crown measured from plumb (the wall)
  crownRef: 'plumb',
  crownMethod: 'flat',
  tilt: 15, // compound: lean from plumb (always positive; direction in `lean`)
  tiltRef: 'plumb',
  lean: 'out',
  compoundBy: 'sides',
  sides: 4,
  compoundHow: 'flat',
  baseHow: 'edge',
  frameW: 90,
  frameWL: '3 1/2',
  frameWR: '3 1/2',
  crownWhere: 'corner',
  rakeJoint: 'bottom',
  rakeDir: 'right',
  pitch: 30, // degrees; shown as degrees or rise-per-12
  pitchUnit: 'deg',
  slopeL: 0,
  slopeR: 30,
};
const SETTINGS_DEFAULTS = { tilt: 'left', maxMiter: 50, maxBevel: 45, clampMethod: 'block', blockAngle: 45 };

const load = (k, d) => {
  try { return { ...d, ...JSON.parse(localStorage.getItem(k) || '{}') }; } catch { return { ...d }; }
};
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };

const state = load('sawangles.state', DEFAULTS);
const settings = load('sawangles.settings', SETTINGS_DEFAULTS);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const $ = (s, el = document) => el.querySelector(s);
const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
const fd = (x) => f1(x).replace(/\.0$/, '');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function seg(key, options, value) {
  return `<div class="seg" data-key="${key}">${options
    .map(([v, label]) => `<button data-v="${v}" aria-pressed="${v === value}">${label}</button>`)
    .join('')}</div>`;
}
function numField(key, label, value, { step = 0.5, min = 0, max = 180, unit = '°' } = {}) {
  return `<div class="field"><span class="label">${label}</span>
    <div class="num">
      <button class="step" data-step="${-step}" data-for="${key}" aria-label="Decrease">−</button>
      <input type="number" inputmode="decimal" data-key="${key}" value="${fd(value)}" min="${min}" max="${max}" step="any">
      <i>${unit}</i>
      <button class="step" data-step="${step}" data-for="${key}" aria-label="Increase">+</button>
    </div></div>`;
}
function widthField(key, label) {
  return `<label class="field"><span class="label">${label}</span>
    <span class="num"><input type="text" inputmode="text" autocomplete="off" autocorrect="off" spellcheck="false"
      data-width="${key}" value="${esc(state[key])}"></span></label>`;
}
function chips(key, list, current) {
  return `<div class="chips" data-key="${key}">${list
    .map(([v, label]) => `<button class="chip" data-v="${v}" aria-pressed="${Number(v) === Number(current)}">${label}</button>`)
    .join('')}</div>`;
}

// Displayed values can be in a different reference than what's stored.
const VIEWS = {
  W: { get: () => state.W, set: (v) => (state.W = v), min: 1, max: 179 },
  frameW: { get: () => state.frameW, set: (v) => (state.frameW = v), min: 1, max: 359 },
  spring: {
    get: () => (state.crownRef === 'plumb' ? state.spring : 90 - state.spring),
    set: (v) => (state.spring = state.crownRef === 'plumb' ? v : 90 - v),
    min: 0, max: 89,
  },
  tilt: {
    get: () => (state.tiltRef === 'plumb' ? state.tilt : 90 - state.tilt),
    set: (v) => (state.tilt = state.tiltRef === 'plumb' ? v : 90 - v),
    min: 0, max: 80,
  },
  pitch: {
    get: () => (state.pitchUnit === 'deg' ? state.pitch : G.degToRise(state.pitch)),
    set: (v) => (state.pitch = Math.min(80, state.pitchUnit === 'deg' ? v : G.riseToDeg(v))),
    min: 0, max: 80,
  },
  slopeL: { get: () => state.slopeL, set: (v) => (state.slopeL = v), min: -80, max: 80 },
  slopeR: { get: () => state.slopeR, set: (v) => (state.slopeR = v), min: -80, max: 80 },
  sides: { get: () => state.sides, set: (v) => (state.sides = Math.round(v)), min: 3, max: 24 },
};

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------
function cornerInputs() {
  const chipList = state.corner === 'inside'
    ? [[90, '90°'], [135, '135°'], [120, '120°'], [45, '45°']]
    : [[90, '90°'], [135, '135°'], [120, '120°']];
  return `
    <div class="field"><span class="label">Corner</span>
      ${seg('corner', [['inside', 'Inside'], ['outside', 'Outside']], state.corner)}</div>
    ${numField('W', 'Corner angle (what the angle finder reads)', state.W)}
    ${chips('W', chipList, state.W)}
    <p class="hint">${state.corner === 'inside'
      ? 'Measure inside the corner, from wall to wall.'
      : 'Measure across the outside of the corner. A normal square corner reads 90°.'}</p>`;
}

/** Left/right slopes (degrees, going away from the joint) for the chosen rake joint. */
function rakeSlopes() {
  const P = state.pitch, right = state.rakeDir === 'right';
  switch (state.rakeJoint) {
    case 'bottom': return right ? [0, P] : [P, 0];
    case 'top': return right ? [-P, 0] : [0, -P];
    case 'peak': return [-P, -P];
    default: return [state.slopeL, state.slopeR];
  }
}

function rakeInputs() {
  const j = state.rakeJoint;
  const dir = j === 'bottom' || j === 'top'
    ? `<div class="field"><span class="label">Looking at the wall, the ceiling slopes up to the</span>
        ${seg('rakeDir', [['left', 'Left'], ['right', 'Right']], state.rakeDir)}</div>` : '';
  const pitch = j === 'custom'
    ? `<div class="row2">
        ${numField('slopeL', 'Left piece slope', state.slopeL, { min: -80, max: 80 })}
        ${numField('slopeR', 'Right piece slope', state.slopeR, { min: -80, max: 80 })}
      </div>
      <p class="hint">Degrees above level, measured going away from the joint. Use a negative number when the piece runs downhill away from the joint. Left and right are as you face the wall.</p>`
    : `<div class="field"><span class="label">Ceiling slope</span>
        ${seg('pitchUnit', [['deg', 'Degrees'], ['rise', 'Rise per 12″']], state.pitchUnit)}</div>
      ${numField('pitch', state.pitchUnit === 'deg' ? 'Slope from level' : 'Rise in 12″ of run', VIEWS.pitch.get(), { step: state.pitchUnit === 'deg' ? 0.5 : 1, max: 80, unit: state.pitchUnit === 'deg' ? '°' : '/12' })}
      ${state.pitchUnit === 'rise' ? `<p class="hint">${fd(VIEWS.pitch.get())}-in-12 = ${f1(state.pitch)}°</p>` : ''}`;
  return `
    <div class="field"><span class="label">Joint</span>
      ${seg('rakeJoint', [['bottom', 'Bottom'], ['top', 'Top'], ['peak', 'Peak'], ['custom', 'Custom']], j)}</div>
    <p class="hint">${{
      bottom: 'Level crown turning up the slope, at the low end of a gable or stair wall.',
      top: 'Crown coming up the slope and turning level at the high end.',
      peak: 'Two sloped runs meeting at the ridge of a gable wall.',
      custom: 'Any two runs on the same wall, each at its own slope.',
    }[j]}</p>
    ${dir}
    ${pitch}`;
}

function renderInputs() {
  const el = $('#inputs');
  let html = '';
  if (state.mode === 'crown') {
    html = `
      <div class="field"><span class="label">Where is the joint?</span>
        ${seg('crownWhere', [['corner', 'Wall corner'], ['rake', 'Sloped ceiling']], state.crownWhere)}</div>
      ${state.crownWhere === 'corner' ? cornerInputs() : rakeInputs()}
      <hr class="sep">
      <div class="field"><span class="label">Measure the crown angle from</span>
        ${seg('crownRef', [['plumb', 'Wall (plumb)'], ['level', 'Ceiling (level)']], state.crownRef)}</div>
      <div class="trimfig">
        <div>${numField('spring', state.crownRef === 'plumb' ? 'Spring angle, from the wall' : 'Angle from the ceiling', VIEWS.spring.get(), { step: 0.5 })}
        ${chips('springPreset', [[38, '52/38 crown'], [45, '45/45 crown']], state.spring)}</div>
        <div id="trimFig">${crownSection(state.spring, state.crownRef)}</div>
      </div>
      <p class="hint">The angle between the flat back of the crown and the ${state.crownRef === 'plumb' ? 'wall' : 'ceiling'}. Most crown is 52/38 (38° from the wall) or 45/45.</p>
      <hr class="sep">
      <div class="field"><span class="label">How the crown sits on the saw</span>
        ${seg('crownMethod', [['flat', 'Flat on table'], ['nested', 'Nested (upside down)']], state.crownMethod)}</div>`;
  } else if (state.mode === 'base') {
    html = `
      ${cornerInputs()}
      <hr class="sep">
      <div class="field"><span class="label">How the board sits on the saw</span>
        ${seg('baseHow', [['edge', 'Standing against fence'], ['flat', 'Flat on table']], state.baseHow)}</div>`;
  } else if (state.mode === 'compound') {
    html = `
      <div class="field"><span class="label">What are you building?</span>
        ${seg('compoundBy', [['sides', 'Box / hopper'], ['angle', 'Trim at a corner']], state.compoundBy)}</div>
      ${state.compoundBy === 'sides'
        ? `${numField('sides', 'Number of equal sides', state.sides, { step: 1, min: 3, max: 24, unit: '' })}
           ${chips('sides', [[3, '3'], [4, '4'], [5, '5'], [6, '6'], [8, '8']], state.sides)}
           <p class="hint">Each corner is ${fd(G.polygonCorner(state.sides))}° seen from above.</p>`
        : cornerInputs()}
      <hr class="sep">
      <div class="field"><span class="label">Board tilt measured from</span>
        ${seg('tiltRef', [['plumb', 'Plumb'], ['level', 'Level']], state.tiltRef)}</div>
      <div class="trimfig">
        <div>${numField('tilt', state.tiltRef === 'plumb' ? 'Tilt from plumb (0 = straight up)' : 'Angle from level (90 = straight up)', VIEWS.tilt.get(), { step: 0.5 })}
        ${seg('lean', [['out', 'Leans out'], ['in', 'Leans in']], state.lean)}</div>
        <div id="trimFig">${tiltSection(state.lean === 'out' ? state.tilt : -state.tilt, state.tiltRef)}</div>
      </div>
      <p class="hint">${state.compoundBy === 'sides' ? '“Out” means the top is wider than the bottom, like a hopper or planter.' : '“Out” means the top of the board leans away from the wall, into the room.'}</p>
      <hr class="sep">
      <div class="field"><span class="label">How the board sits on the saw</span>
        ${seg('compoundHow', [['flat', 'Flat on table'], ['edge', 'Standing against fence']], state.compoundHow)}</div>`;
  } else {
    html = `
      ${numField('frameW', 'Corner angle, measured across the opening', state.frameW, { max: 359 })}
      ${chips('frameW', [[90, '90°'], [120, '120°'], [135, '135°'], [60, '60°'], [270, '270°']], state.frameW)}
      <p class="hint">The angle between the two inner edges, on the opening side. A normal frame corner is 90°. A corner that points into the opening (like the inside of an L) is over 180°.</p>
      <hr class="sep">
      <div class="row2">
        ${widthField('frameWL', 'Left board width')}
        ${widthField('frameWR', 'Right board width')}
      </div>
      <p class="hint">Any unit, as long as both match: 3 1/2, 3-1/2, 3.5 or 89. Left and right are as you face the corner from inside the opening.</p>`;
  }
  el.innerHTML = html;
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------
function dirWord(x, pos, negWord) { return Math.abs(x) < 0.05 ? '' : x > 0 ? pos : negWord; }

function detentNote(x) {
  const { detent, off } = G.nearestDetent(x);
  if (Math.abs(off) < 0.05 || Math.abs(off) > 0.3) return '';
  return `<div class="det">≈ ${detent}° detent (${off > 0 ? '+' : ''}${f1(off)})</div>`;
}

function bigNumbers(r, miterDir) {
  const m = Math.abs(r.miter), b = Math.abs(r.bevel);
  return `<div class="nums">
    <div class="big"><div class="k">Miter</div><div class="v">${f1(m)}°</div>
      <div class="d">${miterDir ?? (m < 0.05 ? 'square' : `handle ${dirWord(r.miter, 'right', 'left')}`)}</div>${detentNote(m)}</div>
    <div class="big"><div class="k">Bevel</div><div class="v">${f1(b)}°</div>
      <div class="d">${b < 0.05 ? 'blade straight' : `tilt ${dirWord(r.bevel, 'left', 'right')}`}</div>${detentNote(b)}</div>
  </div>`;
}

/** Words for the edges of the board in each setup. */
function edgeLabels(kind, mode) {
  if (kind === 'nested') return { fence: 'wall edge up the fence', front: 'ceiling edge flat on table' };
  if (kind === 'edge') return { fence: 'back against fence', front: 'show face toward you' };
  if (mode === 'crown') return null; // depends on which edge, filled in below
  return null;
}

function placementSteps(r, mode) {
  const p = r.placement;
  const edgeName = (which) => {
    if (mode === 'crown') return which === 'upper' ? 'ceiling edge' : 'wall edge';
    return which === 'upper' ? 'top edge' : 'bottom edge';
  };
  if (p.kind === 'nested') {
    return {
      steps: ['Turn the crown upside down: ceiling edge flat on the table, wall edge up against the fence, leaning at its spring angle.'],
      labels: edgeLabels('nested'),
    };
  }
  if (p.kind === 'frame') {
    return {
      steps: ['Lay the board face up, with its <b>outer edge</b> (the edge away from the opening) against the fence.'],
      labels: { fence: 'outer edge at fence', front: 'opening edge' },
    };
  }
  if (p.kind === 'edge') {
    return {
      steps: ['Stand the board on its bottom edge, back flat against the fence, show face toward you.'],
      labels: edgeLabels('edge'),
    };
  }
  const fenceEdge = edgeName(p.fenceEdge);
  const frontEdge = edgeName(p.fenceEdge === 'upper' ? 'lower' : 'upper');
  return {
    steps: [
      mode === 'crown' ? 'Lay the crown flat, back down, decorative face up.' : 'Lay the board flat, show face up.',
      `Put the <b>${fenceEdge}</b> against the fence.`,
    ],
    labels: { fence: `${fenceEdge} at fence`, front: frontEdge },
  };
}

function fits(r) { return Math.abs(r.miter) <= settings.maxMiter + 0.05 && Math.abs(r.bevel) <= settings.maxBevel + 0.05; }
function tiltOk(r) {
  return settings.tilt === 'dual' || Math.abs(r.bevel) < 0.05 || (settings.tilt === 'left' ? r.bevel > 0 : r.bevel < 0);
}
const usable = (r) => r && fits(r) && tiltOk(r);
function whyNot(r) {
  const parts = [];
  if (Math.abs(r.miter) > settings.maxMiter + 0.05) parts.push(`${f1(Math.abs(r.miter))}° miter is past your saw's ${fd(settings.maxMiter)}°`);
  if (Math.abs(r.bevel) > settings.maxBevel + 0.05) parts.push(`${f1(Math.abs(r.bevel))}° bevel is past your saw's ${fd(settings.maxBevel)}°`);
  if (!tiltOk(r)) parts.push(`it needs the blade tilted ${r.bevel > 0 ? 'left' : 'right'}`);
  return parts.join(' and ');
}

/**
 * Pick the setup this saw can actually make: the chosen one, else the other normal fence
 * setup, else a clamped setup (angled block or square to the fence).
 */
function resolvePiece(primary, alt, altName) {
  if (usable(primary)) return { r: primary };
  const why = whyNot(primary);
  if (alt && usable(alt)) return { r: alt, reason: `The usual setup won't work here: the ${why}. This piece is cut ${altName} instead.` };
  const alpha = settings.clampMethod === 'square' ? 90 : Number(settings.blockAngle) || 45;
  for (const c of [primary, alt]) {
    if (!c) continue;
    const v = G.clampedSetup(c, alpha, settings.tilt);
    if (usable(v)) {
      const how = v.clamped.method === 'block' ? `held against a ${fd(v.clamped.angle)}° block` : 'clamped square to the fence';
      const fb = v.clamped.fallback ? ` (a ${v.clamped.method === 'block' ? 'square setup' : 'block'} can't work for this piece on your saw)` : '';
      return { r: v, reason: `The usual setup won't work here: the ${why}. This piece is ${how}${c === alt ? `, cut ${altName}` : ''}${fb}.` };
    }
  }
  return { r: primary, fail: `This cut won't work on your saw: the ${why}, and no clamped setup fixes it. Check the saw settings under the gear icon.` };
}

const SAFETY = 'Clamp both the block and the board so neither can shift. Cutting without the board tight to the fence is more dangerous: keep hands well clear of the blade, and let it stop before you lift it or reach for the offcut.';

function pieceCard(side, res, mode, where = `${side} wall, facing the corner`) {
  const r = res.r;
  let { steps, labels } = placementSteps(r, mode);
  if (r.clamped) {
    const block = r.clamped.method === 'block';
    steps = steps.map((t) => t.replace(/against the fence/g, block ? 'against the angled block' : 'against the square block')
      .replace(/up against the fence/g, 'up against the block'));
    steps.unshift(block
      ? `Clamp a <b>${fd(r.clamped.angle)}° block</b> of scrap to the fence (the blade may cut into it). The board rests against the block, not the fence, with its long end angled toward you.`
      : 'Clamp a <b>square block</b> of scrap to the fence (the blade may cut into it). Set the board <b>at 90° to the fence</b> against the block, with its long end toward you.');
    if (r.placement.kind === 'nested') steps.splice(1, 0, 'Make the block at least as tall as the crown so the crown’s back rests on it at its spring angle.');
    steps.push('<b>Clamp the board</b> before cutting.');
    labels = { ...labels, fence: labels.fence.replace(/(at|against) fence|up the fence/, 'on the block') };
  }
  const keep = r.keep === 'front'
    ? 'Keep the long piece <b>toward you</b>; the offcut is by the fence.'
    : `Keep the piece on the <b>${r.keep.toUpperCase()}</b> of the blade.`;
  return `<section class="card piece">
    <h3>${side === 'left' ? 'Left' : 'Right'} piece <small>${where}</small></h3>
    ${res.reason ? `<p class="why">${res.reason}</p>` : ''}
    ${bigNumbers(r)}
    <ol class="steps">${steps.map((s) => `<li>${s}</li>`).join('')}<li>${keep}</li>${r.longPoint && r.longPoint !== 'none'
      ? `<li>The long point ends up on the <b>${r.longPoint === 'outer' ? 'outer' : 'opening'}</b> edge.</li>` : ''}</ol>
    <div class="sawfig">${r.clamped ? sawClampDiagram(r, labels) : sawDiagram(r, labels)}</div>
    ${r.clamped ? `<div class="safety"><b>Safety:</b> ${SAFETY}</div>` : ''}
    ${res.fail ? `<div class="warn">${res.fail}</div>` : ''}
  </section>`;
}

function renderResults() {
  const out = [];
  const tilt = settings.tilt;
  if (state.mode === 'frame') {
    const wL = G.parseWidth(state.frameWL), wR = G.parseWidth(state.frameWR);
    if (!(wL > 0 && wR > 0)) {
      $('#results').innerHTML = '<p class="note">Enter both board widths to see the cuts.</p>';
      return;
    }
    const W = state.frameW;
    if (Math.abs(W - 180) < 0.05) {
      $('#results').innerHTML = '<p class="note">At 180° the boards run in a straight line: butt them with square cuts.</p>';
      return;
    }
    const r = G.frame({ cornerDeg: W, wLeft: wL, wRight: wR });
    out.push(`<p class="badge">${r.corner === 'inside' ? 'Inside' : 'Outside'} corner · ${fd(W)}° · left ${esc(state.frameWL)} / right ${esc(state.frameWR)}</p>`);
    out.push(`<div class="framefig">${frameDiagram(W, wL, wR)}</div>`);
    out.push(pieceCard('left', resolvePiece(r.left), 'frame', 'left board, seen from the opening'));
    out.push(pieceCard('right', resolvePiece(r.right), 'frame', 'right board, seen from the opening'));
    if (wL !== wR) out.push(`<p class="note">The two angles are different because the boards are different widths. Together they add up to ${fd(180 - W)}°, which is 180° minus the corner angle.</p>`);
    $('#results').innerHTML = out.join('');
    return;
  }

  if (state.mode === 'crown' && state.crownWhere === 'rake') return renderRake(out, tilt);

  let corner = state.corner, W = state.W;
  if (state.mode === 'compound' && state.compoundBy === 'sides') { corner = 'outside'; W = G.polygonCorner(state.sides); }

  out.push(`<div class="roomfig">${roomDiagram(corner, W)}</div>`);

  let pieces, others, altName, mode = state.mode;
  if (state.mode === 'crown') {
    const res = G.crown({ cornerDeg: W, corner, springDeg: state.spring, tilt });
    pieces = state.crownMethod === 'flat' ? res.flat : res.nested;
    others = state.crownMethod === 'flat' ? res.nested : res.flat;
    altName = state.crownMethod === 'flat' ? 'nested (upside down against the fence)' : 'flat on the table';
    if (state.crownMethod === 'nested') {
      out.push(`<p class="note">Nested cuts need the saw's fence tall enough to hold the crown at its spring angle. Use crown stops or a jig so it can't slip.</p>`);
    }
  } else {
    const tiltDeg = state.mode === 'base' ? 0 : (state.lean === 'out' ? state.tilt : -state.tilt);
    const res = G.compoundBoard({ cornerDeg: W, corner, tiltDeg, tilt });
    const how = state.mode === 'base' ? state.baseHow : state.compoundHow;
    pieces = how === 'flat' ? res.flat : res.edge;
    others = how === 'flat' ? res.edge : res.flat;
    altName = how === 'flat' ? 'standing against the fence' : 'flat on the table';
    if (state.mode === 'compound' && state.tilt > 0) {
      out.push(`<p class="note">To make the top and bottom edges sit level, rip them at ${fd(G.edgeRip(state.tilt))}° first.${state.compoundBy === 'sides' ? ' Every side gets the left-piece cut on one end and the right-piece cut on the other.' : ''}</p>`);
    } else if (state.mode === 'compound' && state.compoundBy === 'sides') {
      out.push(`<p class="note">Every side gets the left-piece cut on one end and the right-piece cut on the other.</p>`);
    }
  }
  out.push(pieceCard('left', resolvePiece(pieces.left, others.left, altName), mode));
  out.push(pieceCard('right', resolvePiece(pieces.right, others.right, altName), mode));
  if (tilt !== 'dual' && pieces.left.placement.kind === 'flat') {
    out.push(`<p class="note">Your saw only tilts ${tilt}, so the two pieces use opposite edges against the fence. Change this under the gear icon.</p>`);
  }
  $('#results').innerHTML = out.join('');
}

function renderRake(out, tilt) {
  const [sl, sr] = rakeSlopes();
  const res = G.crownRake({ leftSlope: sl, rightSlope: sr, springDeg: state.spring, tilt });
  if (!res || Math.abs(Math.abs(sl + sr) - 180) < 10 || Math.abs(sl) > 80 || Math.abs(sr) > 80) {
    $('#results').innerHTML = '<p class="note">Those two runs overlap. Check the slopes.</p>';
    return;
  }
  out.push(`<div class="framefig">${wallDiagram(res.joint, sl, sr)}</div>`);
  const nested = state.crownMethod === 'nested';
  const pieces = nested ? res.nested : res.flat;
  const others = nested ? res.flat : res.nested;
  const altName = nested ? 'flat on the table' : 'nested (upside down against the fence)';
  for (const side of ['left', 'right']) {
    out.push(pieceCard(side, resolvePiece(pieces[side], others[side], altName), 'crown', `${side} of the joint, facing the wall`));
  }
  out.push(`<p class="note">Where a level wall meets the sloped wall, turn the corner with a normal wall-corner cut. Then run a short level piece on the sloped wall and use the Bottom joint from that piece up the slope. The profiles line up exactly that way.</p>`);
  out.push(`<p class="note">On walls where the ceiling slopes up away from the wall, the crown runs level. Use the wall-corner calculator, but the ceiling edge won't sit flat, so you may need to rip or shim it.</p>`);
  $('#results').innerHTML = out.join('');
}

function renderAll() {
  document.querySelectorAll('#modes button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === state.mode));
  renderInputs();
  renderResults();
}

function refreshFigure() {
  const fig = $('#trimFig');
  if (!fig) return;
  if (state.mode === 'crown') fig.innerHTML = crownSection(state.spring, state.crownRef);
  if (state.mode === 'compound') fig.innerHTML = tiltSection(state.lean === 'out' ? state.tilt : -state.tilt, state.tiltRef);
}

function syncChips() {
  document.querySelectorAll('#inputs .chips').forEach((c) => {
    const key = c.dataset.key;
    const cur = key === 'springPreset' ? state.spring : VIEWS[key]?.get();
    c.querySelectorAll('.chip').forEach((b) => b.setAttribute('aria-pressed', Number(b.dataset.v) === Number(cur)));
  });
}

function commit({ inputs = false } = {}) {
  save('sawangles.state', state);
  if (inputs) renderInputs(); else { refreshFigure(); syncChips(); }
  renderResults();
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
$('#modes').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  state.mode = b.dataset.v;
  save('sawangles.state', state);
  renderAll();
});

$('#inputs').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const segEl = b.closest('.seg');
  if (segEl) {
    state[segEl.dataset.key] = b.dataset.v;
    return commit({ inputs: true });
  }
  const chipsEl = b.closest('.chips');
  if (chipsEl) {
    const key = chipsEl.dataset.key;
    const v = Number(b.dataset.v);
    if (key === 'springPreset') state.spring = v; else VIEWS[key].set(v);
    return commit({ inputs: true });
  }
  if (b.dataset.step) {
    const key = b.dataset.for, view = VIEWS[key];
    const v = Math.min(view.max, Math.max(view.min, view.get() + Number(b.dataset.step)));
    view.set(v);
    const input = $(`input[data-key="${key}"]`);
    if (input) input.value = fd(view.get());
    if (key === 'sides' || key === 'pitch') return commit({ inputs: true });
    return commit();
  }
});

$('#inputs').addEventListener('input', (e) => {
  const wk = e.target.dataset.width;
  if (wk) {
    const v = G.parseWidth(e.target.value);
    if (v > 0) { state[wk] = e.target.value.trim(); commit(); }
    return;
  }
  const key = e.target.dataset.key;
  const view = VIEWS[key];
  if (!view) return;
  const v = parseFloat(e.target.value);
  if (!Number.isFinite(v) || v < view.min || v > view.max) return;
  view.set(v);
  commit();
});
$('#inputs').addEventListener('change', (e) => {
  if (e.target.dataset.width) { e.target.value = state[e.target.dataset.width]; return; }
  const key = e.target.dataset.key;
  if (VIEWS[key]) {
    e.target.value = fd(VIEWS[key].get());
    if (key === 'sides' || key === 'pitch') commit({ inputs: true });
  }
});

// Saw settings panel
const settingsEl = $('#settings');
$('#settingsBtn').addEventListener('click', (e) => {
  settingsEl.hidden = !settingsEl.hidden;
  e.currentTarget.setAttribute('aria-expanded', String(!settingsEl.hidden));
});
function renderSettings() {
  settingsEl.querySelectorAll('.seg[data-setting]').forEach((g) => g.querySelectorAll('button')
    .forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === settings[g.dataset.setting])));
  const blk = settingsEl.querySelector('#blockAngleField');
  if (blk) blk.hidden = settings.clampMethod !== 'block';
  settingsEl.querySelectorAll('input[data-setting]').forEach((i) => { i.value = settings[i.dataset.setting]; });
}
settingsEl.addEventListener('click', (e) => {
  const b = e.target.closest('.seg[data-setting] button');
  if (!b) return;
  settings[b.closest('.seg').dataset.setting] = b.dataset.v;
  save('sawangles.settings', settings);
  renderSettings();
  renderResults();
});
settingsEl.addEventListener('input', (e) => {
  const k = e.target.dataset.setting;
  const v = parseFloat(e.target.value);
  if (!k || !Number.isFinite(v)) return;
  settings[k] = v;
  save('sawangles.settings', settings);
  renderResults();
});

$('#version').textContent = `v${VERSION}`;
renderSettings();
renderAll();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js');
}
