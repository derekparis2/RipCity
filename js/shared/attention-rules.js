// =====================================================
// COACH ATTENTION RULES
// =====================================================
// Pure activity rules shared by coach surfaces and covered by Node tests.

(function () {
  function parseDateKey(dateKey) {
    const [year, month, day] = String(dateKey || "").split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  function formatDateKey(date) {
    return [
      date.getUTCFullYear(),
      String(date.getUTCMonth() + 1).padStart(2, "0"),
      String(date.getUTCDate()).padStart(2, "0")
    ].join("-");
  }

  function addDays(dateKey, days) {
    const date = parseDateKey(dateKey);
    date.setUTCDate(date.getUTCDate() + days);
    return formatDateKey(date);
  }

  function calculateHabitAttention({ logs = [], todayKey, trackingStartDate = null, threshold = 3 }) {
    const trackedDates = new Set(
      logs
        .filter(log => log?.completed && log.log_date)
        .map(log => log.log_date)
    );

    // Logging today clears the active missed-day run. Otherwise, only count
    // completed calendar days so members are not flagged early in the day.
    if (trackedDates.has(todayKey)) {
      return { needsAttention: false, consecutiveMisses: 0 };
    }

    let consecutiveMisses = 0;
    let cursor = addDays(todayKey, -1);

    while (
      (!trackingStartDate || cursor >= trackingStartDate) &&
      !trackedDates.has(cursor) &&
      consecutiveMisses < threshold
    ) {
      consecutiveMisses += 1;
      cursor = addDays(cursor, -1);
    }

    return {
      needsAttention: consecutiveMisses >= threshold,
      consecutiveMisses
    };
  }

  function calculateWorkoutAttention({ activity = [], todayKey, threshold = 2 }) {
    const byDate = new Map();

    activity.forEach(row => {
      if (!row?.assigned_date || row.assigned_date > todayKey) return;
      if (!byDate.has(row.assigned_date)) byDate.set(row.assigned_date, []);
      byDate.get(row.assigned_date).push(Boolean(row.hasExerciseData));
    });

    const todayActivity = byDate.get(todayKey) || [];
    if (todayActivity.some(Boolean)) {
      return { needsAttention: false, consecutiveMisses: 0, assignedDays: byDate.size };
    }

    const completedAssignedDates = [...byDate.keys()]
      .filter(dateKey => dateKey < todayKey)
      .sort()
      .reverse();
    let consecutiveMisses = 0;

    for (const dateKey of completedAssignedDates) {
      if ((byDate.get(dateKey) || []).some(Boolean)) break;
      consecutiveMisses += 1;
      if (consecutiveMisses >= threshold) break;
    }

    return {
      needsAttention: consecutiveMisses >= threshold,
      consecutiveMisses,
      assignedDays: completedAssignedDates.length
    };
  }

  window.RipCityAttentionRules = {
    addDays,
    calculateHabitAttention,
    calculateWorkoutAttention
  };
})();
