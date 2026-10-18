// =====================================================
// MEMBER ANNOUNCEMENTS
// =====================================================
// RLS returns only active announcements addressed to this member's facility,
// groups, or individual member profile.

(function () {
  const ui = () => window.RipCityUI;

  function normalizeRelation(value) {
    return Array.isArray(value) ? value[0] || null : value || null;
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(new Date(value));
  }

  function renderAnnouncements(rows) {
    const panel = document.getElementById("member-announcements-panel");
    const list = document.getElementById("member-announcement-list");
    if (!panel || !list) return;

    if (!rows.length) {
      panel.classList.add("hidden");
      list.innerHTML = "";
      return;
    }

    const sorted = [...rows].sort((a, b) => {
      if (a.importance !== b.importance) return a.importance === "important" ? -1 : 1;
      return new Date(b.publish_at).getTime() - new Date(a.publish_at).getTime();
    });

    list.innerHTML = sorted.map(announcement => {
      const creator = normalizeRelation(announcement.creator);
      return `
        <article class="member-announcement-card ${announcement.importance === "important" ? "is-important" : ""}">
          <div class="announcement-card-heading">
            <div>
              ${announcement.importance === "important" ? '<span class="announcement-importance-label">Important</span>' : ""}
              <h4>${ui().text(announcement.title)}</h4>
            </div>
            <time datetime="${ui().attr(announcement.publish_at)}">${ui().text(formatDate(announcement.publish_at))}</time>
          </div>
          <p>${ui().text(announcement.body)}</p>
          <span class="member-announcement-sender">From ${ui().text(creator?.full_name || "Rip City Coach")}</span>
        </article>
      `;
    }).join("");
    panel.classList.remove("hidden");
  }

  async function initialize() {
    const panel = document.getElementById("member-announcements-panel");
    if (!panel) return;

    try {
      const access = await window.RipCityAccess.requireApprovedAccess();
      if (!access) return;

      const { data, error } = await db
        .from("coach_announcements")
        .select(`
          id,
          title,
          body,
          importance,
          publish_at,
          creator:profiles!coach_announcements_created_by_fkey (full_name)
        `)
        .order("publish_at", { ascending: false });

      if (error) throw error;
      renderAnnouncements(data || []);
    } catch (error) {
      // Keep the dashboard usable before staging receives the migration.
      console.error("Could not load member announcements:", error);
      panel.classList.add("hidden");
    }
  }

  document.addEventListener("DOMContentLoaded", initialize);
})();
