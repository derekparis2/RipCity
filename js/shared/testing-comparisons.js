(function initializeTestingComparisons(global) {
  function normalizeRelation(value) {
    return Array.isArray(value) ? value[0] : value;
  }

  function normalizeMetricPart(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function getMetricKey(test) {
    return [
      normalizeMetricPart(test?.name),
      normalizeMetricPart(test?.unit),
      normalizeMetricPart(test?.ranking_direction)
    ].join("::");
  }

  function getResultForParticipant(test, participantId) {
    return (test?.testing_results || []).find(result => (
      result.testing_day_participant_id === participantId
    ));
  }

  function improvementBetween(currentValue, comparisonValue, direction) {
    if (!Number.isFinite(currentValue) || !Number.isFinite(comparisonValue)) return null;
    return direction === "lower"
      ? comparisonValue - currentValue
      : currentValue - comparisonValue;
  }

  function percentImprovement(currentValue, comparisonValue, direction) {
    const improvement = improvementBetween(currentValue, comparisonValue, direction);
    if (improvement === null || comparisonValue === 0) return null;
    return (improvement / Math.abs(comparisonValue)) * 100;
  }

  function chooseBest(observations, direction) {
    return observations.reduce((best, observation) => {
      if (!best) return observation;
      if (direction === "lower") return observation.value < best.value ? observation : best;
      return observation.value > best.value ? observation : best;
    }, null);
  }

  function build(participations) {
    const grouped = new Map();

    (participations || []).forEach(participation => {
      const day = normalizeRelation(participation.testing_day);
      if (!day || day.status !== "completed" || participation.participation_status === "did_not_participate") return;

      (day.testing_day_tests || []).forEach(test => {
        if (!["higher", "lower"].includes(test.ranking_direction) || test.input_type === "text") return;
        const result = getResultForParticipant(test, participation.id);
        if (
          result?.result_status !== "recorded"
          || result.numeric_value === null
          || result.numeric_value === ""
        ) return;
        const value = Number(result.numeric_value);
        if (!Number.isFinite(value)) return;

        const observation = {
          dayId: day.id,
          dayName: day.name,
          date: day.testing_date,
          direction: test.ranking_direction,
          resultId: result.id,
          recordedAt: result.recorded_at || "",
          testId: test.id,
          testName: test.name,
          unit: test.unit || "",
          value
        };
        const key = getMetricKey(test);
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(observation);
      });
    });

    return [...grouped.entries()].map(([key, observations]) => {
      observations.sort((a, b) => (
        a.date.localeCompare(b.date)
        || a.recordedAt.localeCompare(b.recordedAt)
        || String(a.resultId).localeCompare(String(b.resultId))
      ));
      const baseline = observations[0];
      const latest = observations[observations.length - 1];
      const previous = observations.length > 1 ? observations[observations.length - 2] : null;
      const best = chooseBest(observations, latest.direction);

      return {
        key,
        testName: latest.testName,
        unit: latest.unit,
        direction: latest.direction,
        observations,
        resultCount: observations.length,
        baseline,
        previous,
        latest,
        best,
        isPersonalRecord: best?.value === latest.value,
        improvementFromBaseline: observations.length > 1
          ? improvementBetween(latest.value, baseline.value, latest.direction)
          : null,
        percentFromBaseline: observations.length > 1
          ? percentImprovement(latest.value, baseline.value, latest.direction)
          : null,
        improvementFromPrevious: previous
          ? improvementBetween(latest.value, previous.value, latest.direction)
          : null,
        percentFromPrevious: previous
          ? percentImprovement(latest.value, previous.value, latest.direction)
          : null
      };
    }).sort((a, b) => a.testName.localeCompare(b.testName));
  }

  function formatValue(value, unit = "") {
    if (!Number.isFinite(Number(value))) return "—";
    const number = Number(value);
    const formatted = Number.isInteger(number)
      ? String(number)
      : number.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return `${formatted}${unit ? ` ${unit}` : ""}`;
  }

  function formatImprovement(value, unit = "") {
    if (!Number.isFinite(value)) return "—";
    const sign = value > 0 ? "+" : value < 0 ? "−" : "";
    return `${sign}${formatValue(Math.abs(value), unit)}`;
  }

  function formatPercent(value) {
    if (!Number.isFinite(value)) return "—";
    const sign = value > 0 ? "+" : value < 0 ? "−" : "";
    return `${sign}${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
  }

  function getSparklinePoints(observations, width = 260, height = 72, padding = 8) {
    if (!observations?.length) return "";
    const values = observations.map(item => item.value);
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const range = maximum - minimum || 1;
    const usableWidth = width - (padding * 2);
    const usableHeight = height - (padding * 2);
    return observations.map((item, index) => {
      const x = observations.length === 1
        ? width / 2
        : padding + ((index / (observations.length - 1)) * usableWidth);
      const y = padding + (((maximum - item.value) / range) * usableHeight);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  }

  global.RipCityTestingComparisons = {
    build,
    formatImprovement,
    formatPercent,
    formatValue,
    getSparklinePoints,
    getMetricKey,
    improvementBetween,
    percentImprovement
  };
})(typeof window !== "undefined" ? window : globalThis);
