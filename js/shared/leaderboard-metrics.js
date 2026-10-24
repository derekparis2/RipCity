// =====================================================
// SHARED LEADERBOARD + MEMBER METRICS
// =====================================================
// Pure date and score calculations used by both coach leaderboards and member
// dashboard cards. Keeping these rules here prevents the two views from
// reporting different streaks or rolling averages.

(function () {
  const DAY_MS = 24 * 60 * 60 * 1000;

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

  function getMonday(dateKey) {
    const date = parseDateKey(dateKey);
    const day = date.getUTCDay();
    const distance = day === 0 ? 6 : day - 1;
    date.setUTCDate(date.getUTCDate() - distance);
    return formatDateKey(date);
  }

  function buildWeekRange(startKey) {
    return {
      startKey,
      endKey: addDays(startKey, 6)
    };
  }

  function buildPreviousCompletedWeeks(todayKey, count = 4) {
    const currentMonday = getMonday(todayKey);
    return Array.from({ length: count }, (_, index) => {
      return buildWeekRange(addDays(currentMonday, -7 * (index + 1)));
    });
  }

  function isWithinRange(dateKey, range) {
    return dateKey >= range.startKey && dateKey <= range.endKey;
  }

  function roundOne(value) {
    return Math.round((Number(value) + Number.EPSILON) * 10) / 10;
  }

  function formatDayCount(value, label = "day") {
    return `${value} ${label}${value === 1 ? "" : "s"}`;
  }

  function getHabitLeaderboardMetricDefinitions() {
    return [
      {
        key: "fourWeekAverage",
        label: "4-Week Average",
        score: row => row.metrics.hasScore ? row.metrics.fourWeekAverage : null,
        display: row => ({
          primary: row.metrics.fourWeekAverage === null
            ? "No score"
            : `${row.metrics.fourWeekAverage} / ${row.metrics.fourWeekMax}`,
          secondary: "Previous 4 weeks"
        })
      },
      {
        key: "currentWeekScore",
        label: "Current Week",
        score: row => row.metrics.currentWeekScore,
        display: row => ({
          primary: `${row.metrics.currentWeekScore} / ${row.metrics.currentWeekMax}`,
          secondary: `${row.metrics.currentWeekQualifiedDays} qualified days`
        })
      },
      {
        key: "currentStreak",
        label: "Current Streak",
        score: row => row.metrics.currentStreak,
        display: row => ({
          primary: formatDayCount(row.metrics.currentStreak),
          secondary: "Current streak"
        })
      },
      {
        key: "longestStreak",
        label: "Longest Streak",
        score: row => row.metrics.longestStreak,
        display: row => ({
          primary: formatDayCount(row.metrics.longestStreak),
          secondary: "Longest streak"
        })
      }
    ];
  }

  function getHabitDayMap(logs) {
    const byDate = new Map();

    (logs || []).forEach(log => {
      if (!log?.completed || !log.log_date) return;

      if (!byDate.has(log.log_date)) {
        byDate.set(log.log_date, {
          habitIds: new Set(),
          points: 0
        });
      }

      const day = byDate.get(log.log_date);
      if (log.habit_id) day.habitIds.add(log.habit_id);
      day.points += Number(log.points_earned || 0);
    });

    return byDate;
  }

  function calculateCalendarStreak(qualifiedDates, todayKey) {
    const qualified = new Set(qualifiedDates || []);
    const yesterdayKey = addDays(todayKey, -1);
    let cursor = qualified.has(todayKey) ? todayKey : yesterdayKey;
    let current = 0;

    while (qualified.has(cursor)) {
      current += 1;
      cursor = addDays(cursor, -1);
    }

    let longest = 0;
    let run = 0;
    let previousTime = null;

    [...qualified]
      .sort()
      .forEach(dateKey => {
        const time = parseDateKey(dateKey).getTime();
        run = previousTime !== null && time - previousTime === DAY_MS ? run + 1 : 1;
        longest = Math.max(longest, run);
        previousTime = time;
      });

    return { current, longest };
  }

  function calculateH2KMetrics({
    logs = [],
    habitCount = 6,
    todayKey,
    qualifyingHabitCount = 4,
    completedWeekCount = 4
  }) {
    const dayMap = getHabitDayMap(logs);
    const currentWeek = buildWeekRange(getMonday(todayKey));
    const completedWeeks = buildPreviousCompletedWeeks(todayKey, completedWeekCount);
    const today = dayMap.get(todayKey);
    const currentWeekDays = [...dayMap.entries()].filter(([dateKey]) => {
      return isWithinRange(dateKey, currentWeek) && dateKey <= todayKey;
    });
    const completedWeekScores = completedWeeks.map(range => {
      return [...dayMap.entries()]
        .filter(([dateKey]) => isWithinRange(dateKey, range))
        .reduce((total, [, day]) => total + day.points, 0);
    });
    const completedWeekPointTotal = completedWeekScores.reduce((total, score) => total + score, 0);
    const qualifiedDates = [...dayMap.entries()]
      .filter(([, day]) => day.habitIds.size >= qualifyingHabitCount)
      .map(([dateKey]) => dateKey);
    const streak = calculateCalendarStreak(qualifiedDates, todayKey);
    const weeklyMax = habitCount * 7;

    return {
      todayScore: today?.habitIds.size || 0,
      currentWeekScore: currentWeekDays.reduce((total, [, day]) => total + day.points, 0),
      currentWeekMax: weeklyMax,
      currentWeekQualifiedDays: currentWeekDays.filter(([, day]) => {
        return day.habitIds.size >= qualifyingHabitCount;
      }).length,
      fourWeekAverage: completedWeekScores.length && completedWeekPointTotal > 0
        ? roundOne(completedWeekPointTotal / completedWeekScores.length)
        : null,
      fourWeekMax: weeklyMax,
      currentStreak: streak.current,
      longestStreak: streak.longest,
      hasScore: completedWeekPointTotal > 0
    };
  }

  function groupAssignmentsByDate(assignments) {
    const byDate = new Map();

    (assignments || []).forEach(assignment => {
      if (!assignment?.assigned_date) return;
      if (!byDate.has(assignment.assigned_date)) byDate.set(assignment.assigned_date, []);
      byDate.get(assignment.assigned_date).push(assignment);
    });

    return byDate;
  }

  function summarizeAssignmentRange(assignments, range, todayKey) {
    const rows = assignments.filter(assignment => {
      return assignment.assigned_date <= todayKey && isWithinRange(assignment.assigned_date, range);
    });
    const completed = rows.filter(assignment => assignment.isComplete).length;

    return {
      assigned: rows.length,
      completed,
      percent: rows.length ? Math.round((completed / rows.length) * 100) : null
    };
  }

  function calculateAssignedDateStreak(assignments, todayKey) {
    const byDate = groupAssignmentsByDate(assignments.filter(row => row.assigned_date <= todayKey));
    const dates = [...byDate.keys()].sort();
    const completedDates = dates.filter(dateKey => byDate.get(dateKey).every(row => row.isComplete));
    let current = 0;

    for (let index = dates.length - 1; index >= 0; index -= 1) {
      const dateKey = dates[index];
      const complete = byDate.get(dateKey).every(row => row.isComplete);

      if (dateKey === todayKey && !complete) continue;
      if (!complete) break;
      current += 1;
    }

    let longest = 0;
    let run = 0;
    dates.forEach(dateKey => {
      if (completedDates.includes(dateKey)) {
        run += 1;
        longest = Math.max(longest, run);
      } else {
        run = 0;
      }
    });

    return { current, longest };
  }

  function calculateAthleteMetrics({ assignments = [], todayKey, completedWeekCount = 4 }) {
    const pastAndCurrent = assignments.filter(row => row.assigned_date <= todayKey);
    const currentWeek = summarizeAssignmentRange(
      pastAndCurrent,
      buildWeekRange(getMonday(todayKey)),
      todayKey
    );
    const completedWeeks = buildPreviousCompletedWeeks(todayKey, completedWeekCount);
    const completedWeekAssignments = pastAndCurrent.filter(row => {
      return completedWeeks.some(range => isWithinRange(row.assigned_date, range));
    });
    const completed = completedWeekAssignments.filter(row => row.isComplete).length;
    const streak = calculateAssignedDateStreak(pastAndCurrent, todayKey);

    return {
      currentWeek,
      fourWeek: {
        assigned: completedWeekAssignments.length,
        completed,
        percent: completedWeekAssignments.length
          ? Math.round((completed / completedWeekAssignments.length) * 100)
          : null
      },
      currentStreak: streak.current,
      longestStreak: streak.longest,
      hasAssignments: pastAndCurrent.length > 0
    };
  }

  function assignCompetitionRanks(rows, getScore) {
    const sorted = [...rows].sort((a, b) => {
      const aScore = getScore(a);
      const bScore = getScore(b);
      if ((aScore === null || aScore === undefined) && (bScore === null || bScore === undefined)) return 0;
      if (aScore === null || aScore === undefined) return 1;
      if (bScore === null || bScore === undefined) return -1;
      return bScore - aScore;
    });
    let previousScore = null;
    let previousRank = null;

    return sorted.map((row, index) => {
      const score = getScore(row);
      let rank = null;

      if (score !== null && score !== undefined) {
        rank = previousScore === score ? previousRank : index + 1;
        previousScore = score;
        previousRank = rank;
      }

      return { ...row, rank };
    });
  }

  window.RipCityMetrics = {
    addDays,
    assignCompetitionRanks,
    buildPreviousCompletedWeeks,
    calculateAthleteMetrics,
    calculateH2KMetrics,
    formatDayCount,
    formatDateKey,
    getHabitLeaderboardMetricDefinitions,
    getMonday,
    parseDateKey
  };
})();
