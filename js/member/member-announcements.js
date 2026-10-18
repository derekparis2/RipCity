// =====================================================
// MEMBER ANNOUNCEMENTS
// =====================================================
// RLS returns only active announcements addressed to this member's facility,
// all-athlete audience, groups, or individual member profile.

(function () {
  let memberProfile = null;
  let announcements = [];
  let dismissals = [];
  let showAll = false;
  let dismissalInProgress = false;

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

  function localDayKey(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function visibleAnnouncements() {
    const dismissedToday = new Set(
      dismissals
        .filter(row => localDayKey(row.dismissed_at) === localDayKey())
        .map(row => row.announcement_id)
    );

    return [...announcements]
      .filter(row => !dismissedToday.has(row.id))
      .sort((a, b) => {
        if (a.importance !== b.importance) return a.importance === "important" ? -1 : 1;
        return new Date(b.publish_at).getTime() - new Date(a.publish_at).getTime();
      });
  }

  function announcementMarkup(announcement) {
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
        <div class="member-announcement-footer">
          <span class="member-announcement-sender">From ${ui().text(creator?.full_name || "Rip City Coach")}</span>
          <button class="announcement-dismiss-button" type="button" data-dismiss-announcement="${ui().attr(announcement.id)}">Hide for today</button>
        </div>
      </article>
    `;
  }

  function renderAnnouncements() {
    const panel = document.getElementById("member-announcements-panel");
    const list = document.getElementById("member-announcement-list");
    if (!panel || !list) return;

    const visible = visibleAnnouncements();
    if (!visible.length) {
      panel.classList.add("hidden");
      list.innerHTML = "";
      return;
    }

    const rendered = showAll ? visible : visible.slice(0, 1);
    const remaining = visible.length - rendered.length;
    list.innerHTML = `
      ${rendered.map(announcementMarkup).join("")}
      ${visible.length > 1 ? `
        <button class="outline-btn member-announcement-toggle" type="button" id="member-announcement-toggle">
          ${showAll ? "Show less" : `View ${remaining} more`}
        </button>
      ` : ""}
    `;
    panel.classList.remove("hidden");
  }

  async function dismissForToday(announcementId) {
    if (dismissalInProgress || !memberProfile) return;
    dismissalInProgress = true;

    try {
      const dismissedAt = new Date().toISOString();
      const { error } = await db
        .from("coach_announcement_dismissals")
        .upsert({
          announcement_id: announcementId,
          member_profile_id: memberProfile.id,
          dismissed_at: dismissedAt
        }, { onConflict: "announcement_id,member_profile_id" });

      if (error) throw error;
      dismissals = dismissals.filter(row => row.announcement_id !== announcementId);
      dismissals.push({ announcement_id: announcementId, dismissed_at: dismissedAt });
      renderAnnouncements();
    } catch (error) {
      console.error("Could not dismiss announcement:", error);
    } finally {
      dismissalInProgress = false;
    }
  }

  async function initialize() {
    const panel = document.getElementById("member-announcements-panel");
    const list = document.getElementById("member-announcement-list");
    if (!panel || !list) return;

    list.addEventListener("click", event => {
      const dismissButton = event.target.closest("[data-dismiss-announcement]");
      if (dismissButton) {
        dismissForToday(dismissButton.dataset.dismissAnnouncement);
        return;
      }

      if (event.target.closest("#member-announcement-toggle")) {
        showAll = !showAll;
        renderAnnouncements();
      }
    });

    try {
      const access = await window.RipCityAccess.requireApprovedAccess();
      if (!access) return;
      memberProfile = await window.RipCityAccess.getMemberProfileForMembership(access.membership.id);

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
      announcements = data || [];

      if (announcements.length) {
        const { data: dismissalRows, error: dismissalError } = await db
          .from("coach_announcement_dismissals")
          .select("announcement_id,dismissed_at")
          .eq("member_profile_id", memberProfile.id)
          .in("announcement_id", announcements.map(row => row.id));

        if (dismissalError) throw dismissalError;
        dismissals = dismissalRows || [];
      }

      renderAnnouncements();
    } catch (error) {
      // Keep the dashboard usable before staging receives the migration.
      console.error("Could not load member announcements:", error);
      panel.classList.add("hidden");
    }
  }

  document.addEventListener("DOMContentLoaded", initialize);
})();
