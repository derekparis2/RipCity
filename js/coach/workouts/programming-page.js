async function logoutCoachProgramming() {
  await db.auth.signOut();
  window.location.href = "login.html";
}

async function initCoachProgrammingPage() {
  showWorkoutMessage("Checking access...");

  try {
    workoutCoachAccess = await requireCoachOrAdmin();
    if (!workoutCoachAccess) return;

    availableGroups = await loadGroups(workoutCoachAccess.membership.facility_id);
    availableMembers = await loadAssignableMembers(workoutCoachAccess.membership.facility_id);
    availableGroupMemberships = await loadAssignableGroupMemberships(
      availableMembers.map(member => member.memberProfileId)
    );

    const preferences = getProgrammingPreferences();
    const scopeType = document.getElementById("programming-scope-type");
    if (scopeType && ["group", "member"].includes(preferences.scopeType)) scopeType.value = preferences.scopeType;
    renderProgrammingScopeOptions(preferences.scopeId);
    await loadRecentWorkouts();
    await loadWorkoutPrograms();
    showWorkoutMessage("");
  } catch (error) {
    console.error(error);
    showWorkoutMessage(error.message || "Could not load programming.", true);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initProgrammingCalendar();
  initWorkoutPrograms();
  initCoachProgrammingPage();

  document.getElementById("recent-workout-search")?.addEventListener("input", renderRecentWorkouts);
  document.getElementById("recent-workout-date-filter")?.addEventListener("change", renderRecentWorkouts);
  document.getElementById("recent-workout-assigner-filter")?.addEventListener("change", renderRecentWorkouts);
  document.getElementById("recent-workout-target-filter")?.addEventListener("change", renderRecentWorkouts);
  document.getElementById("refresh-workouts-btn")?.addEventListener("click", loadRecentWorkouts);
  document.getElementById("coach-programming-logout-btn")?.addEventListener("click", logoutCoachProgramming);
});
