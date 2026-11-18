(async function () {
  const message = document.getElementById('facility-choice-message');
  const list = document.getElementById('facility-choice-list');
  document.getElementById('facility-choice-logout').addEventListener('click', async () => {
    await db.auth.signOut();
    window.location.href = 'login.html';
  });
  try {
    const session = await window.RipCityAccess.getSession();
    if (!session) { window.location.replace('login.html'); return; }
    const legal = await window.RipCityAccess.getCurrentLegalAcceptance();
    if (!legal.accepted) { window.location.replace('legal-consent.html?next=facility-select.html'); return; }
    const profile = await window.RipCityAccess.getProfileWithMemberships(session.user.id);
    const memberships = profile.facility_members || [];
    const approved = memberships.filter(row => row.status === 'approved');
    for (const membership of approved) {
      const config = await window.RipCityAccess.getFacilityConfiguration(membership.facility_id);
      if (config.status !== 'active') continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'outline-btn full-btn';
      button.textContent = config.name;
      button.addEventListener('click', () => {
        window.RipCityAccess.selectFacility(membership.facility_id);
        window.location.href = window.RipCityAccess.isCoachRole(membership.role) ? 'coach-dashboard.html' : 'member-dashboard.html';
      });
      list.append(button);
    }
    if (await window.RipCityAccess.getCurrentUserIsPlatformOwner()) {
      const link = document.createElement('a');
      link.href = 'platform.html'; link.className = 'outline-btn full-btn'; link.textContent = 'Platform Management'; list.append(link);
    }
    message.textContent = list.children.length ? '' : 'No active facility access is available. Contact your facility administrator.';
  } catch (error) {
    message.textContent = error.message || 'Could not load your facilities.';
    message.classList.add('error-message');
  }
})();
