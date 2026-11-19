// =====================================================
// LIFT MAXES AND PERCENT-OF-MAX HELPERS
// =====================================================
// Pure helpers shared by the member workout session and tests. A member's max
// for an exercise is the best estimated 1RM from sets they flagged as max
// effort; sets that are not flagged never count.

(function (root) {
  const MAX_ESTIMATE_REP_LIMIT = 10;
  const LOAD_ROUNDING_INCREMENT = 5;

  function normalizeExerciseName(name) {
    return String(name || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  // Epley formula; a single rep is the weight itself.
  function estimateOneRepMax(weight, reps) {
    const w = Number(weight);
    const r = Number(reps);

    if (!Number.isFinite(w) || w <= 0) return null;
    if (!Number.isFinite(r) || r < 1 || r > MAX_ESTIMATE_REP_LIMIT) return null;
    if (r === 1) return w;

    return w * (1 + r / 30);
  }

  function isMaxEffortLog(log) {
    return Boolean(log?.is_max_effort) && log.completed !== false;
  }

  // Returns a Map of normalized exercise name -> best estimated 1RM.
  function computeMaxesByExercise(logs) {
    const maxes = new Map();

    (logs || []).forEach(log => {
      if (!isMaxEffortLog(log)) return;

      const name = normalizeExerciseName(log.exercise_name);
      const estimate = estimateOneRepMax(log.weight, log.reps_completed);
      if (!name || estimate === null) return;

      if (!maxes.has(name) || estimate > maxes.get(name)) {
        maxes.set(name, estimate);
      }
    });

    return maxes;
  }

  // "70", "70%", or "70, 75, 80" -> [70, 75, 80]. Anything unparseable is dropped.
  function parsePercentTargets(value) {
    return String(value ?? "")
      .split(",")
      .map(part => Number(part.trim().replace(/%$/, "").trim()))
      .filter(number => Number.isFinite(number) && number > 0);
  }

  function getPercentForSet(percentValue, setNumber) {
    const targets = parsePercentTargets(percentValue);
    if (!targets.length) return null;

    return targets[Math.max(0, Number(setNumber) - 1)] ?? targets[targets.length - 1];
  }

  function calculateLoad(maxValue, percent, increment = LOAD_ROUNDING_INCREMENT) {
    const max = Number(maxValue);
    const pct = Number(percent);

    if (!Number.isFinite(max) || max <= 0 || !Number.isFinite(pct) || pct <= 0) return null;

    const raw = max * pct / 100;
    return increment > 0 ? Math.round(raw / increment) * increment : raw;
  }

  function formatWeight(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "";
    return String(Math.round(number * 10) / 10);
  }

  // Share of max a logged weight represents, e.g. 0.7 * max -> 70.
  function calculatePercentOfMax(weight, maxValue) {
    const w = Number(weight);
    const max = Number(maxValue);
    if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(max) || max <= 0) return null;
    return Math.round((w / max) * 100);
  }

  const api = {
    calculateLoad,
    calculatePercentOfMax,
    computeMaxesByExercise,
    estimateOneRepMax,
    formatWeight,
    getPercentForSet,
    normalizeExerciseName,
    parsePercentTargets
  };

  root.RipCityLiftMaxes = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
