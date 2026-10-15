// =====================================================
// COACH WORKOUT BUILDER CORE HELPERS
// =====================================================
// Small, dependency-light helpers shared by the builder, library, assignment,
// and history modules. Feature-specific rendering and Supabase calls belong in
// their own files so the page controller stays easy to review.

function showWorkoutMessage(message, isError = false) {
  const element = document.getElementById("coach-workouts-message");
  if (!element) return;

  element.textContent = message;
  element.classList.toggle("error-message", isError);
}

function getInputValue(id) {
  const element = document.getElementById(id);
  if (!element) return "";
  return element.value.trim();
}

function getSelectedValues(id) {
  const element = document.getElementById(id);
  if (!element) return [];

  if (element.matches("select")) {
    return Array.from(element.selectedOptions)
      .map(option => option.value)
      .filter(Boolean);
  }

  if (element.matches("[data-checkbox-list], .assignment-checkbox-list")) {
    return Array.from(element.querySelectorAll("input[type='checkbox']:checked"))
      .map(input => input.value)
      .filter(Boolean);
  }

  return [];
}

function getCardInputValue(card, selector) {
  const element = card.querySelector(selector);
  return element ? element.value.trim() : "";
}

function createClientId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  // Fallback for older browsers. Supabase/Postgres still validates this as UUID.
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, char => (
    Number(char) ^ window.crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(char) / 4
  ).toString(16));
}

function formatLocalDate(date) {
  // This preserves the current V1 behavior until facility-time-zone helpers
  // replace browser-local dates in the reviewed V2 migration.
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateKey) {
  if (!dateKey) return "No date";

  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return dateKey;

  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function setTodayAsDefaultDate() {
  const dateInput = document.getElementById("workout-date");
  if (!dateInput) return;

  dateInput.value = formatLocalDate(new Date());
}

function setFieldValue(id, value) {
  const element = document.getElementById(id);
  if (!element) return;

  element.value = value ?? "";
}
