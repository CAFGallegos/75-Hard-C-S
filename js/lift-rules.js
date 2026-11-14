// Lift calculations only: no DOM, storage, network, or challenge rules.
export const LB_PER_KG = 2.2046226218487757;
export const clean = (n) => Math.round(n * 1e6) / 1e6;
export function convertWeight(value, from, to) {
  if (!['lb', 'kg'].includes(from) || !['lb', 'kg'].includes(to)) throw new Error('bad_units');
  return clean(from === to ? value : from === 'lb' ? value / LB_PER_KG : value * LB_PER_KG);
}
export function roundIncrement(value, increment, mode = 'nearest') {
  if (!Number.isFinite(value) || value < 0 || !Number.isFinite(increment) || increment <= 0) throw new Error('bad_weight');
  const ratio = value / increment;
  return clean((mode === 'down' ? Math.floor(ratio + 1e-8) : Math.round(ratio)) * increment);
}
export function e1RM(weight, reps, rir = 0) {
  return Number.isFinite(weight) && weight > 0 && Number.isFinite(reps) && reps > 0 && Number.isFinite(rir) && rir >= 0
    ? clean(weight * (1 + (reps + rir) / 30)) : 0;
}
export const workingSets = (sets) => (sets ?? []).filter((s) => !s.is_warmup && s.completed !== false);
export const volume = (sets) => clean(workingSets(sets).reduce((n, s) => n + s.weight * s.reps, 0));
export function sessionMetrics(sets) {
  const work = workingSets(sets);
  return { volume: volume(work), top: Math.max(0, ...work.map((s) => s.weight)), e1rm: Math.max(0, ...work.map((s) => e1RM(s.weight, s.reps, s.rir))) };
}

/** History is newest first. Missing/incomplete sessions never trigger an increase. */
export function suggest(exercise, history = [], units = 'lb') {
  const sessions = history.slice(0, 2).map((h) => workingSets(h.sets).map((s) => ({ ...s, weight: convertWeight(s.weight, h.units ?? units, units) })));
  const last = sessions[0] ?? [];
  const previous = sessions[1] ?? [];
  const count = exercise.sets, min = exercise.rep_min, max = exercise.rep_max;
  const below = (s) => s.some((x) => x.reps < min);
  let reason = 'First session — choose a working weight.';
  let branch = 'first';
  if (last.length) {
    branch = 'hold'; reason = 'Keep the weight and build consistency.';
    if (below(last) && below(previous)) { branch = 'deload'; reason = 'Two sessions below range: try a 10% deload.'; }
    else if (below(last)) reason = 'Below your rep range: hold the weight.';
    else if (last.length === count && last.every((s) => s.reps >= max && s.rir >= exercise.target_rir)) {
      branch = 'increase'; reason = 'Top of the range with enough RIR: add one increment.';
    } else if (last.length === count && last.every((s) => s.reps >= min && s.reps <= max)) {
      branch = 'reps'; reason = 'Same weight; add a rep to the lowest sets where possible.';
    }
  }
  const lowest = Math.min(...last.map((s) => s.reps));
  const sets = Array.from({ length: count }, (_, i) => {
    const old = last[i] ?? last[last.length - 1];
    let weight = old?.weight ?? 0, reps = old?.reps ?? min;
    if (branch === 'increase') { weight = clean(weight + exercise.increment); reps = min; }
    if (branch === 'deload') { weight = roundIncrement(weight * 0.9, exercise.increment, 'down'); reps = min; }
    if (branch === 'reps' && reps === lowest) reps = Math.min(max, reps + 1);
    return { weight, reps: branch === 'hold' ? Math.max(min, Math.min(max, reps)) : reps, rir: exercise.target_rir };
  });
  return { branch, reason, sets, last };
}

/** Unlimited pairs of the configured denominations. Find the closest load at or below target.
 * Integer thousandths avoid float drift; dynamic programming handles noncanonical plate sets. */
export function plateMath(target, bar, plates) {
  if (![target, bar].every((v) => Number.isFinite(v) && v >= 0 && v <= 5000) || !Array.isArray(plates) || !plates.length || plates.some((p) => !Number.isFinite(p) || p < 0.001 || p > 500)) throw new Error('bad_plates');
  if (target < bar) return { plates: [], actual: bar, leftover: clean(target - bar), belowBar: true };
  const denominations = [...new Set(plates.map((p) => Math.round(p * 1000)))].sort((a, b) => b - a);
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  const unit = denominations.reduce(gcd);
  const budget = Math.floor(((target - bar) * 500 + 1e-6) / unit);
  // Bound memory even for imported fractional increments.
  if (budget > 2500000) throw new Error('plate_precision');
  const counts = new Int32Array(budget + 1).fill(1000000), chosen = new Int32Array(budget + 1).fill(-1);
  counts[0] = 0;
  denominations.forEach((d, index) => {
    const step = d / unit;
    for (let n = step; n <= budget; n++) if (counts[n - step] + 1 < counts[n]) { counts[n] = counts[n - step] + 1; chosen[n] = index; }
  });
  let load = budget;
  while (load > 0 && chosen[load] < 0) load--;
  const actual = clean(bar + load * unit / 500), perSide = [];
  for (let n = load; n > 0;) { const d = denominations[chosen[n]]; perSide.push(d / 1000); n -= d / unit; }
  return { plates: perSide.sort((a, b) => b - a), actual, leftover: clean(target - actual), belowBar: false };
}
export function warmups(weight, exercise, plan) {
  return [[0.5, 8], [0.7, 5], [0.85, 2]].map(([factor, reps]) => {
    const target = weight * factor;
    const load = exercise.equipment === 'barbell'
      ? plateMath(target, plan.bar_weight, plan.plates).actual
      : roundIncrement(target, exercise.increment, 'down');
    return { weight: load, reps, rir: 0, is_warmup: true, completed: false };
  }).filter((s) => s.weight > 0 && s.weight < weight);
}
