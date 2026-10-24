// =====================================================
// COACH ANNOUNCEMENTS
// =====================================================
// Coaches can publish one facility announcement or target selected groups and
// members. The database RPC validates facility ownership and saves the message
// and its recipients in one transaction.

(function () {
  let access = null;
  let groups = [];
  let members = [];
  let announcements = [];
  let saveInProgress = false;

  const ui = () => window.RipCityUI;

  function normalizeRelation(value) {
    return Array.isArray(value) ? value[0] || null : value || null;
  }

  function showMessage(message, isError = false) {
    const element = document.getElementById("coach-announcement-message");
    if (!element) return;

    element.textContent = message;
    element.classList.toggle("error-message", isError);
  }

  function formatAnnouncementDate(value) {
    if (!value) return "";

    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(value));
  }

  function formatLocalDateTimeInput(date) {
    const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60_000));
    return localDate.toISOString().slice(0, 16);
  }

  function setDefaultExpiration() {
    const input = document.getElementById("coach-announcement-expires");
    if (!input) return;

    const tomorrow = new Date(Date.now() + (24 * 60 * 60 * 1000));
    input.value = formatLocalDateTimeInput(tomorrow);
    input.min = formatLocalDateTimeInput(new Date(Date.now() + 60_000));
  }

  function renderTargetOptions() {
    const groupList = document.getElementById("coach-announcement-groups");
    const memberList = document.getElementById("coach-announcement-members");
    if (!groupList || !memberList) return;

    groupList.innerHTML = groups.length
      ? groups.map(group => `
          <label class="announcement-checkbox-option" data-announcement-group-option>
            <input type="checkbox" value="${ui().attr(group.id)}" data-announcement-group />
            <span class="announcement-option-copy">
              <strong>${ui().text(group.name)}</strong>
              <small>${group.memberCount} member${group.memberCount === 1 ? "" : "s"}</small>
            </span>
          </label>
        `).join("")
      : '<p class="announcement-option-empty">No groups available.</p>';

    memberList.innerHTML = members.length
      ? members.map(member => `
          <label class="announcement-checkbox-option" data-announcement-member-option data-member-name="${ui().attr(`${member.name} ${member.email}`.toLowerCase())}">
            <input type="checkbox" value="${ui().attr(member.id)}" data-announcement-member />
            <span class="announcement-member-identity">
              <span class="announcement-member-initials" aria-hidden="true">${ui().text(member.initials)}</span>
              <span class="announcement-option-copy">
                <strong>${ui().text(member.name)}</strong>
                <small>${ui().text(member.email)}</small>
              </span>
            </span>
            <span class="announcement-member-type">${ui().text(member.type === "h2k" ? "H2K" : "Athlete")}</span>
          </label>
        `).join("")
      : '<p class="announcement-option-empty">No approved members available.</p>';

    updateRecipientSelectionState();
  }

  function updateRecipientSelectionState() {
    const selectedGroups = document.querySelectorAll("[data-announcement-group]:checked").length;
    const selectedMembers = document.querySelectorAll("[data-announcement-member]:checked").length;
    const visibleOptions = Array.from(document.querySelectorAll("[data-announcement-member-option]"))
      .filter(option => !option.classList.contains("hidden"));
    const visibleCount = visibleOptions.length;
    const allVisibleSelected = visibleCount > 0 && visibleOptions.every(option => option.querySelector("input")?.checked);
    const count = document.getElementById("coach-announcement-member-count");
    if (count) count.textContent = `${visibleCount} shown`;

    document.querySelectorAll(".announcement-checkbox-option").forEach(option => {
      option.classList.toggle("is-selected", Boolean(option.querySelector("input")?.checked));
    });

    const groupTabCount = document.getElementById("coach-announcement-group-tab-count");
    const memberTabCount = document.getElementById("coach-announcement-member-tab-count");
    if (groupTabCount) groupTabCount.textContent = String(selectedGroups);
    if (memberTabCount) memberTabCount.textContent = String(selectedMembers);

    const summary = document.getElementById("coach-announcement-recipient-summary");
    if (summary) {
      const parts = [];
      if (selectedGroups) parts.push(`${selectedGroups} group${selectedGroups === 1 ? "" : "s"}`);
      if (selectedMembers) parts.push(`${selectedMembers} individual${selectedMembers === 1 ? "" : "s"}`);
      summary.textContent = parts.length ? `Sending to ${parts.join(" and ")}` : "No recipients selected";
    }

    const selectVisible = document.getElementById("coach-announcement-select-visible");
    if (selectVisible) selectVisible.textContent = allVisibleSelected ? "Clear shown" : "Select shown";
  }

  function filterMemberOptions() {
    const search = document.getElementById("coach-announcement-member-search")?.value.trim().toLowerCase() || "";
    document.querySelectorAll("[data-announcement-member-option]").forEach(option => {
      option.classList.toggle("hidden", search && !option.dataset.memberName.includes(search));
    });
    updateRecipientSelectionState();
  }

  function setRecipientTab(tabName) {
    document.querySelectorAll("[data-recipient-tab]").forEach(button => {
      const active = button.dataset.recipientTab === tabName;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll("[data-recipient-pane]").forEach(pane => {
      pane.classList.toggle("hidden", pane.dataset.recipientPane !== tabName);
    });
  }

  function toggleVisibleMembers() {
    const visibleInputs = Array.from(document.querySelectorAll("[data-announcement-member-option]:not(.hidden) input"));
    const shouldSelect = visibleInputs.some(input => !input.checked);
    visibleInputs.forEach(input => { input.checked = shouldSelect; });
    updateRecipientSelectionState();
  }

  function clearRecipients() {
    document.querySelectorAll("[data-announcement-group], [data-announcement-member]").forEach(input => {
      input.checked = false;
    });
    updateRecipientSelectionState();
  }

  function toggleTargetOptions() {
    const audience = document.getElementById("coach-announcement-audience")?.value;
    document.getElementById("coach-announcement-targets")?.classList.toggle("hidden", audience !== "targeted");
  }

  function selectedValues(selector) {
    return Array.from(document.querySelectorAll(`${selector}:checked`)).map(input => input.value);
  }

  function audienceLabel(announcement) {
    if (announcement.audience_type === "facility") return "Entire facility";
    if (announcement.audience_type === "athletes") return "All athletes";
    if (announcement.audience_type === "h2k") return "All H2K members";

    const groupNames = (announcement.groupIds || [])
      .map(id => groups.find(group => group.id === id)?.name)
      .filter(Boolean);
    const memberNames = (announcement.memberIds || [])
      .map(id => members.find(member => member.id === id)?.name)
      .filter(Boolean);

    return [...groupNames, ...memberNames].join(", ") || "Selected members";
  }

  function renderAnnouncements() {
    const list = document.getElementById("coach-announcement-list");
    if (!list) return;

    if (!announcements.length) {
      list.innerHTML = '<div class="empty-state">No announcements have been published yet.</div>';
      return;
    }

    const now = Date.now();
    const sorted = [...announcements].sort((a, b) => {
      const aExpired = a.expires_at && new Date(a.expires_at).getTime() <= now;
      const bExpired = b.expires_at && new Date(b.expires_at).getTime() <= now;
      if (aExpired !== bExpired) return aExpired ? 1 : -1;
      if (a.importance !== b.importance) return a.importance === "important" ? -1 : 1;
      return new Date(b.publish_at).getTime() - new Date(a.publish_at).getTime();
    });
    const active = sorted.filter(row => !row.expires_at || new Date(row.expires_at).getTime() > now);
    const expired = sorted.filter(row => row.expires_at && new Date(row.expires_at).getTime() <= now);

    const cardMarkup = announcement => {
      const creator = normalizeRelation(announcement.creator);
      const isExpired = announcement.expires_at && new Date(announcement.expires_at).getTime() <= now;
      const canDelete = access?.isAdmin || announcement.created_by === access?.session?.user?.id;

      return `
        <article class="coach-announcement-card ${announcement.importance === "important" ? "is-important" : ""} ${isExpired ? "is-expired" : ""}">
          <div class="announcement-card-heading">
            <div>
              <span class="announcement-audience-label">${announcement.importance === "important" ? "Important · " : ""}${ui().text(audienceLabel(announcement))}</span>
              <h5>${ui().text(announcement.title)}</h5>
            </div>
            ${isExpired ? '<span class="announcement-status">Expired</span>' : ""}
          </div>
          <p class="announcement-message-copy">${ui().text(announcement.body)}</p>
          <div class="announcement-card-meta">
            <span>Posted by ${ui().text(creator?.full_name || "Coach")} · ${ui().text(formatAnnouncementDate(announcement.publish_at))}</span>
            ${announcement.expires_at ? `<span>Expires ${ui().text(formatAnnouncementDate(announcement.expires_at))}</span>` : ""}
          </div>
          ${canDelete ? `<button class="text-button announcement-delete-button" type="button" data-delete-announcement="${ui().attr(announcement.id)}">Delete</button>` : ""}
        </article>
      `;
    };

    const activeMarkup = active.length
      ? active.map(cardMarkup).join("")
      : '<div class="empty-state">No active announcements.</div>';
    const clearLabel = access?.isAdmin ? "Clear Expired" : "Clear My Expired";
    const expiredMarkup = expired.length
      ? `
          <details class="expired-announcement-section">
            <summary>
              <span>Expired announcements</span>
              <span>${expired.length}</span>
            </summary>
            <div class="expired-announcement-actions">
              <button class="outline-btn" id="clear-expired-announcements" type="button">${clearLabel}</button>
            </div>
            <div class="expired-announcement-list">${expired.map(cardMarkup).join("")}</div>
          </details>
        `
      : "";

    list.innerHTML = activeMarkup + expiredMarkup;
  }

  async function loadAudienceOptions() {
    const [groupResult, memberResult, groupMemberResult] = await Promise.all([
      db
        .from("groups")
        .select("id,name,member_type")
        .eq("facility_id", access.facilityId)
        .order("name", { ascending: true }),
      db
        .from("facility_members")
        .select(`
          id,
          role,
          profile:profiles!facility_members_profile_id_fkey (id, full_name, email),
          member_profile:member_profiles (id, member_type)
        `)
        .eq("facility_id", access.facilityId)
        .eq("status", "approved")
        .in("role", ["athlete", "h2k_member"]),
      db
        .from("group_members")
        .select("group_id")
    ]);

    if (groupResult.error) throw groupResult.error;
    if (memberResult.error) throw memberResult.error;
    if (groupMemberResult.error) throw groupMemberResult.error;

    const groupMemberCounts = (groupMemberResult.data || []).reduce((counts, row) => {
      counts[row.group_id] = (counts[row.group_id] || 0) + 1;
      return counts;
    }, {});
    groups = (groupResult.data || []).map(group => ({
      ...group,
      memberCount: groupMemberCounts[group.id] || 0
    }));
    members = (memberResult.data || []).map(row => {
      const profile = normalizeRelation(row.profile);
      const memberProfile = normalizeRelation(row.member_profile);
      return {
        id: memberProfile?.id,
        name: profile?.full_name || profile?.email || "Unnamed Member",
        email: profile?.email || "No email",
        initials: (profile?.full_name || profile?.email || "Member")
          .split(/\s+/)
          .map(part => part[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
        type: memberProfile?.member_type || (row.role === "h2k_member" ? "h2k" : "athlete")
      };
    }).filter(member => member.id).sort((a, b) => a.name.localeCompare(b.name));

    renderTargetOptions();
  }

  async function loadAnnouncements() {
    const { data, error } = await db
      .from("coach_announcements")
      .select(`
        id,
        title,
        body,
        importance,
        audience_type,
        publish_at,
        expires_at,
        created_by,
        creator:profiles!coach_announcements_created_by_fkey (full_name)
      `)
      .eq("facility_id", access.facilityId)
      .order("publish_at", { ascending: false });

    if (error) throw error;

    const rows = data || [];
    const ids = rows.map(row => row.id);
    let groupTargets = [];
    let memberTargets = [];

    if (ids.length) {
      const [groupResult, memberResult] = await Promise.all([
        db.from("coach_announcement_groups").select("announcement_id,group_id").in("announcement_id", ids),
        db.from("coach_announcement_members").select("announcement_id,member_profile_id").in("announcement_id", ids)
      ]);

      if (groupResult.error) throw groupResult.error;
      if (memberResult.error) throw memberResult.error;
      groupTargets = groupResult.data || [];
      memberTargets = memberResult.data || [];
    }

    announcements = rows.map(row => ({
      ...row,
      groupIds: groupTargets.filter(target => target.announcement_id === row.id).map(target => target.group_id),
      memberIds: memberTargets.filter(target => target.announcement_id === row.id).map(target => target.member_profile_id)
    }));
    renderAnnouncements();
  }

  async function publishAnnouncement(event) {
    event.preventDefault();
    if (saveInProgress) return;

    const title = document.getElementById("coach-announcement-title")?.value.trim();
    const body = document.getElementById("coach-announcement-body")?.value.trim();
    const audienceType = document.getElementById("coach-announcement-audience")?.value || "facility";
    const importance = document.getElementById("coach-announcement-importance")?.value || "standard";
    const expiresValue = document.getElementById("coach-announcement-expires")?.value || "";
    const groupIds = audienceType === "targeted" ? selectedValues("[data-announcement-group]") : [];
    const memberIds = audienceType === "targeted" ? selectedValues("[data-announcement-member]") : [];

    if (!title || !body) {
      showMessage("Add a title and message before publishing.", true);
      return;
    }

    if (audienceType === "targeted" && !groupIds.length && !memberIds.length) {
      showMessage("Choose at least one group or member.", true);
      return;
    }

    let expiresAt = null;
    if (expiresValue) {
      const expiration = new Date(expiresValue);
      if (!Number.isFinite(expiration.getTime()) || expiration.getTime() <= Date.now()) {
        showMessage("Expiration must be in the future.", true);
        return;
      }
      expiresAt = expiration.toISOString();
    }

    saveInProgress = true;
    const button = document.getElementById("coach-announcement-submit");
    if (button) {
      button.disabled = true;
      button.textContent = "Publishing...";
    }
    showMessage("");

    try {
      const { error } = await db.rpc("create_coach_announcement", {
        announcement_facility_id: access.facilityId,
        announcement_title: title,
        announcement_body: body,
        announcement_importance: importance,
        announcement_audience_type: audienceType,
        target_group_ids: groupIds,
        target_member_profile_ids: memberIds,
        announcement_expires_at: expiresAt
      });

      if (error) throw error;

      document.getElementById("coach-announcement-form")?.reset();
      const memberSearch = document.getElementById("coach-announcement-member-search");
      if (memberSearch) memberSearch.value = "";
      setDefaultExpiration();
      toggleTargetOptions();
      renderTargetOptions();
      await loadAnnouncements();
      showMessage("Announcement published.");
    } catch (error) {
      console.error(error);
      showMessage(error.message || "Could not publish the announcement.", true);
    } finally {
      saveInProgress = false;
      if (button) {
        button.disabled = false;
        button.textContent = "Publish Announcement";
      }
    }
  }

  async function deleteAnnouncement(announcementId) {
    const announcement = announcements.find(row => row.id === announcementId);
    if (!announcement || !window.confirm(`Delete “${announcement.title}”?`)) return;

    try {
      const { error } = await db.from("coach_announcements").delete().eq("id", announcementId);
      if (error) throw error;
      await loadAnnouncements();
      showMessage("Announcement deleted.");
    } catch (error) {
      console.error(error);
      showMessage(error.message || "Could not delete the announcement.", true);
    }
  }

  async function clearExpiredAnnouncements() {
    const label = access?.isAdmin ? "all expired facility announcements" : "your expired announcements";
    if (!window.confirm(`Permanently delete ${label}?`)) return;

    try {
      let query = db
        .from("coach_announcements")
        .delete()
        .lte("expires_at", new Date().toISOString());

      if (!access?.isAdmin) {
        query = query.eq("created_by", access.session.user.id);
      }

      const { error } = await query;
      if (error) throw error;
      await loadAnnouncements();
      showMessage("Expired announcements cleared.");
    } catch (error) {
      console.error(error);
      showMessage(error.message || "Could not clear expired announcements.", true);
    }
  }

  async function initialize() {
    const form = document.getElementById("coach-announcement-form");
    if (!form) return;

    form.addEventListener("submit", publishAnnouncement);
    document.getElementById("coach-announcement-audience")?.addEventListener("change", toggleTargetOptions);
    document.getElementById("coach-announcement-member-search")?.addEventListener("input", filterMemberOptions);
    document.getElementById("coach-announcement-targets")?.addEventListener("change", updateRecipientSelectionState);
    document.getElementById("coach-announcement-targets")?.addEventListener("click", event => {
      const tab = event.target.closest("[data-recipient-tab]");
      if (tab) setRecipientTab(tab.dataset.recipientTab);
    });
    document.getElementById("coach-announcement-select-visible")?.addEventListener("click", toggleVisibleMembers);
    document.getElementById("coach-announcement-clear-recipients")?.addEventListener("click", clearRecipients);
    document.getElementById("coach-announcement-list")?.addEventListener("click", event => {
      if (event.target.closest("#clear-expired-announcements")) {
        clearExpiredAnnouncements();
        return;
      }
      const button = event.target.closest("[data-delete-announcement]");
      if (button) deleteAnnouncement(button.dataset.deleteAnnouncement);
    });

    try {
      setDefaultExpiration();
      access = await window.RipCityAccess.requireCoachAccess({ onDeniedMessage: showMessage });
      if (!access) return;
      await Promise.all([loadAudienceOptions(), loadAnnouncements()]);
    } catch (error) {
      console.error(error);
      showMessage(
        /coach_announcements|create_coach_announcement/i.test(error.message || "")
          ? "Run the targeted-announcements migration in staging to enable this section."
          : (error.message || "Could not load announcements."),
        true
      );
    }
  }

  document.addEventListener("DOMContentLoaded", initialize);
})();
