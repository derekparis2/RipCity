(function (root) {
  function numberOrNull(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function getGoalValues(goal, checkins = []) {
    const orderedCheckins = checkins.slice().sort((a, b) => {
      const dateComparison = String(a.recorded_date || "").localeCompare(String(b.recorded_date || ""));
      if (dateComparison !== 0) return dateComparison;
      return String(a.created_at || "").localeCompare(String(b.created_at || ""));
    });
    const latestCheckin = orderedCheckins[orderedCheckins.length - 1] || null;
    const startValue = numberOrNull(goal.current_value);
    const latestValue = numberOrNull(latestCheckin?.value);

    return {
      startValue,
      currentValue: latestValue ?? startValue,
      targetValue: numberOrNull(goal.target_value),
      currentLabel: goal.status === "completed" ? "Finish" : "Current",
      latestCheckin,
      hasCheckins: Boolean(latestCheckin)
    };
  }

  function formatGoalValueSummary(goal, checkins = []) {
    const values = getGoalValues(goal, checkins);
    const display = value => value === null ? "—" : value;
    const parts = [
      `Start ${display(values.startValue)}`,
      `${values.currentLabel} ${display(values.currentValue)}`
    ];

    if (values.targetValue !== null) parts.push(`Target ${values.targetValue}`);
    return `${parts.join(" · ")}${goal.unit ? ` ${goal.unit}` : ""}`;
  }

  root.RipCityGoalProgress = {
    getGoalValues,
    formatGoalValueSummary
  };
})(typeof window === "undefined" ? globalThis : window);
