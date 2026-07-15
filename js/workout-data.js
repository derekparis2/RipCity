// =====================================================
// SHARED WORKOUT DATA HELPERS
// =====================================================
// These helpers keep assignment visibility, local date handling, and workout
// completion math consistent across member dashboard, workout session, and
// coach review screens.

(function () {
  function formatLocalDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function getTodayString() {
    return formatLocalDate(new Date());
  }

  function normalizeJoinedOne(rowOrRows) {
    return Array.isArray(rowOrRows) ? rowOrRows[0] : rowOrRows;
  }

  function getAssignmentTargetPriority(assignment) {
    const priorities = {
      member: 3,
      group: 2,
      facility: 1
    };

    return priorities[assignment?.target_type] || 0;
  }

  function buildMemberAssignmentOrFilter({ facilityId, memberProfileId, groupIds = [] }) {
    const filters = [
      `target_facility_id.eq.${facilityId}`,
      `target_member_profile_id.eq.${memberProfileId}`
    ];

    if (groupIds.length) {
      filters.push(`target_group_id.in.(${groupIds.join(",")})`);
    }

    return filters.join(",");
  }

  function getWorkoutBlocks(workout) {
    return [...(workout?.workout_blocks || [])]
      .sort((a, b) => Number(a.block_order || 0) - Number(b.block_order || 0));
  }

  function getBlockExercises(block) {
    return [...(block?.workout_exercises || [])]
      .sort((a, b) => Number(a.exercise_order || 0) - Number(b.exercise_order || 0));
  }

  function getWorkoutExercises(workout) {
    return getWorkoutBlocks(workout).flatMap(block => getBlockExercises(block));
  }

  function getWorkoutTotalSets(workout) {
    return getWorkoutExercises(workout).reduce((total, exercise) => {
      return total + Number(exercise.sets || 1);
    }, 0);
  }

  function summarizeSetLogs(logs, workout) {
    const completedSetKeys = new Set();
    let lastLoggedAt = null;

    logs.forEach(log => {
      if (log.completed) {
        completedSetKeys.add(`${log.exercise_id}:${log.set_number}`);
      }

      if (log.logged_at && (!lastLoggedAt || new Date(log.logged_at) > new Date(lastLoggedAt))) {
        lastLoggedAt = log.logged_at;
      }
    });

    const totalSets = getWorkoutTotalSets(workout);
    const completedSets = completedSetKeys.size;
    const completionPercent = totalSets
      ? Math.min(100, Math.round((completedSets / totalSets) * 100))
      : 0;

    return {
      completedSets,
      totalSets,
      completionPercent,
      lastLoggedAt,
      isComplete: totalSets > 0 && completedSets >= totalSets
    };
  }

  function isAssignmentInFacility(assignment, facilityId) {
    return assignment?.workout?.facility_id === facilityId;
  }

  function isAssignmentVisibleToMember(assignment, { facilityId, memberProfileId, groupIds = [] }) {
    if (!isAssignmentInFacility(assignment, facilityId)) return false;

    if (assignment.target_type === "facility") {
      return assignment.target_facility_id === facilityId;
    }

    if (assignment.target_type === "member") {
      return assignment.target_member_profile_id === memberProfileId;
    }

    if (assignment.target_type === "group") {
      return groupIds.includes(assignment.target_group_id);
    }

    return false;
  }

  function dedupeAssignmentsByWorkoutDate(assignments) {
    const byWorkoutDate = new Map();

    assignments.forEach(assignment => {
      const key = `${assignment.workout?.id || assignment.workout_id}:${assignment.assigned_date}`;
      const current = byWorkoutDate.get(key);

      if (!current) {
        byWorkoutDate.set(key, assignment);
        return;
      }

      const currentPriority = getAssignmentTargetPriority(current);
      const nextPriority = getAssignmentTargetPriority(assignment);

      if (nextPriority > currentPriority) {
        byWorkoutDate.set(key, assignment);
      }
    });

    return Array.from(byWorkoutDate.values());
  }

  async function loadMemberGroupIds(memberProfileId) {
    const { data, error } = await db
      .from("group_members")
      .select("group_id")
      .eq("member_profile_id", memberProfileId);

    if (error) throw error;

    return (data || []).map(row => row.group_id);
  }

  async function loadSetLogsForAssignments(assignmentIds, memberProfileId = null) {
    if (!assignmentIds.length) return [];

    let query = db
      .from("exercise_set_logs")
      .select("*")
      .in("workout_assignment_id", assignmentIds);

    if (memberProfileId) {
      query = query.eq("member_profile_id", memberProfileId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data || [];
  }

  function formatDateLabel(dateString) {
    if (!dateString) return "No date";

    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(year, month - 1, day);

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }

  function formatDateTimeLabel(value) {
    if (!value) return "Not logged";

    return new Date(value).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  window.RipCityWorkoutData = {
    buildMemberAssignmentOrFilter,
    dedupeAssignmentsByWorkoutDate,
    formatDateLabel,
    formatDateTimeLabel,
    formatLocalDate,
    getAssignmentTargetPriority,
    getBlockExercises,
    getTodayString,
    getWorkoutBlocks,
    getWorkoutExercises,
    getWorkoutTotalSets,
    isAssignmentVisibleToMember,
    loadMemberGroupIds,
    loadSetLogsForAssignments,
    normalizeJoinedOne,
    summarizeSetLogs
  };
})();
