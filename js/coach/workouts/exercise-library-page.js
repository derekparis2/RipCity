// =====================================================
// COACH EXERCISE LIBRARY PAGE
// =====================================================

async function initCoachExerciseLibraryPage() {
  showWorkoutMessage("Checking access...");

  try {
    workoutCoachAccess = await requireCoachOrAdmin();
    if (!workoutCoachAccess) return;

    await refreshExerciseLibrary();
    showWorkoutMessage("");
  } catch (error) {
    console.error(error);
    showWorkoutMessage(error.message || "Could not load exercise library.", true);
  }
}

async function logoutCoachExerciseLibrary() {
  await db.auth.signOut();
  window.location.href = "login.html";
}

document.addEventListener("DOMContentLoaded", () => {
  initCoachExerciseLibraryPage();

  document.getElementById("exercise-library-form")?.addEventListener("submit", saveExerciseTemplate);
  const resetAndRenderLibrary = () => {
    exerciseLibraryVisibleLimit = 24;
    renderExerciseLibraryList();
  };
  document.getElementById("exercise-library-search")?.addEventListener("input", resetAndRenderLibrary);
  document.getElementById("exercise-library-category-filter")?.addEventListener("change", resetAndRenderLibrary);
  document.getElementById("exercise-library-input-filter")?.addEventListener("change", resetAndRenderLibrary);
  document.getElementById("coach-exercises-logout-btn")?.addEventListener("click", logoutCoachExerciseLibrary);
});
