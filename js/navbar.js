// ─────────────────────────────────────────────────────────────
//  navbar.js — BFL Fantasy IPL 2026 v2
//  Shared navbar with theme toggle + all new pages
// ─────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { href:'dashboard.html',   label:'Dashboard',   page:'dashboard',
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>' },
  { href:'squad.html',       label:'Squad',       page:'squad',
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/><path d="M16 3.13a4 4 0 010 7.75"/><path d="M21 21v-2a4 4 0 00-3-3.85"/></svg>' },
  { href:'predictions.html', label:'Predictions', page:'predictions',
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>' },
  { href:'leaderboard.html', label:'Leaderboard', page:'leaderboard',
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>' },
  { href:'analytics.html',   label:'Analytics',   page:'analytics',
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>' },
  { href:'blogs.html',       label:'Blogs',       page:'blogs',
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>' },
];

function buildNavbar(activePage) {
  const navbarEl = document.getElementById('navbar');
  if (navbarEl) {
    navbarEl.innerHTML =
      '<div class="container" style="display:flex;align-items:center;gap:14px;">' +
        '<a href="dashboard.html" class="nav-logo">' +
          '<span class="nav-logo-dot"></span>BFL Fantasy' +
        '</a>' +
        '<nav class="nav-links">' +
          NAV_LINKS.map(l =>
            `<a href="${l.href}" class="nav-link${activePage===l.page?' active':''}">${l.icon} ${l.label}</a>`
          ).join('') +
        '</nav>' +
        '<div class="nav-right">' +
          '<button class="btn btn-ghost btn-sm theme-toggle" onclick="UI.toggleTheme()" title="Toggle theme" style="padding:6px 8px;min-width:34px;"></button>' +
          '<div class="nav-user" id="nav-user">' +
            '<div class="nav-avatar" id="nav-avatar">?</div>' +
            '<span id="nav-team-name" style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">—</span>' +
          '</div>' +
          '<button class="btn btn-ghost btn-sm" onclick="doLogout()">Logout</button>' +
        '</div>' +
      '</div>';
  }

  const bnavEl = document.getElementById('bottom-nav-inner');
  if (bnavEl) {
    bnavEl.innerHTML = NAV_LINKS.map(l =>
      `<a href="${l.href}" class="bnav-link${activePage===l.page?' active':''}">${l.icon}<span>${l.label}</span></a>`
    ).join('');
  }

  UI.initTheme();
}

async function initNavbar(page) {
  buildNavbar(page);
  try {
    const sess = await Auth.getSession();
    if (!sess) return;
    if (Auth.isAdmin(sess.user)) {
      const el = document.getElementById('nav-team-name');
      const av = document.getElementById('nav-avatar');
      if (el) el.textContent = 'Admin';
      if (av) { av.textContent = 'A'; av.style.background = 'linear-gradient(135deg,#ff4d6d,#a78bfa)'; }
      return;
    }
    const team = await Auth.fetchTeam(sess.user.id);
    if (team) {
      const short = (team.team_name||'').split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
      const el = document.getElementById('nav-team-name');
      const av = document.getElementById('nav-avatar');
      if (el) el.textContent = team.team_name;
      if (av) av.textContent = short;
    }
  } catch(e) { console.warn('navbar:', e.message); }
}

async function doLogout() { await Auth.signOut(); }