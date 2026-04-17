// navbar.js — BFL Fantasy IPL 2026  v6
// Desktop: collapsible sidebar. Mobile: bottom tab bar.
'use strict';

var NAV_LINKS = [
  { href:'dashboard.html',    label:'Dashboard',     page:'dashboard',      bnav:true, bnavLabel:'Home',
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>' },
  { href:'predictions.html',  label:'Predictions',  page:'predictions',    bnav:true, bnavLabel:'Preds',
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>' },
  { href:'squad.html',        label:'My Squad',     page:'squad',          bnav:true, bnavLabel:'Squad',
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/><path d="M16 3.13a4 4 0 010 7.75"/><path d="M21 21v-2a4 4 0 00-3-3.85"/></svg>' },
  { href:'match-center.html', label:'Match Center',  page:'match-center',   bnav:true, bnavLabel:'Match',
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>' },
  { href:'leaderboard.html',  label:'Standings',    page:'leaderboard',    bnav:true, bnavLabel:'Rank',
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>' },
  
  // Analytics sub-links (all point to analytics.html with ?tab)
  { href:'analytics.html?tab=overview', label:'Team Analytics', page:'analytics',     bnav:false,
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>' },
  { href:'analytics.html?tab=pred-summary', label:'Predictions Summary', page:'pred-summary', bnav:false,
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>' },
  { href:'analytics.html?tab=accuracy', label:'Prediction Accuracy', page:'accuracy', bnav:false,
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' },
  { href:'analytics.html?tab=match-preds',  label:'Match Predictions', page:'match-preds', bnav:false,
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' },
  { href:'analytics.html?tab=fantasy-players',  label:'Fantasy Players', page:'fantasy-players', bnav:false,
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15l-2 5-3-1-3 1-2-5"/><circle cx="12" cy="8" r="5"/></svg>' },
  { href:'analytics.html?tab=user-teams',  label:'User Teams', page:'user-teams', bnav:false,
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>' },
  { href:'analytics.html?tab=power-rankings',  label:'Power Rankings', page:'power-rankings', bnav:false,
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' },

  { href:'instructions.html', label:'Guide',         page:'instructions',   bnav:false,
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="12" x2="12.01" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' },
];

// Sidebar state — persisted in localStorage
var _sidebarOpen = false; // Default to closed
try {
  var _saved = localStorage.getItem('bfl_sidebar');
  if (_saved !== null) {
    // Only restore open state on desktop (>900px), otherwise default to closed
    _sidebarOpen = (_saved === '1' && window.innerWidth > 900);
  } else {
    // First visit: default to closed on mobile, open on desktop
    _sidebarOpen = window.innerWidth > 900;
    localStorage.setItem('bfl_sidebar', _sidebarOpen ? '1' : '0');
  }
} catch(e) {}

function buildNavbar(activePage, isAdmin) {
  var navbarEl = document.getElementById('navbar');
  if (!navbarEl) return;

  var links = NAV_LINKS;

  var navItemsHtml = links.map(function(l) {
    var isActive = activePage === l.page;
    return '<a href="' + l.href + '" class="sb-link' + (isActive ? ' active' : '') + '" data-page="' + l.page + '">' +
      '<span class="sb-icon">' + l.icon + '</span>' +
      '<span class="sb-label">' + l.label + '</span>' +
    '</a>';
  }).join('');

  navbarEl.innerHTML =
    '<div class="topbar">' +
      '<button class="sb-toggle" id="sb-toggle" onclick="toggleSidebar()" aria-label="Toggle menu">' +
        '<svg id="sb-toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>' +
      '</button>' +
      '<a href="dashboard.html" class="nav-logo">' +
        '<img src="images/bfl/bfl-logo.png" alt="BFL" style="height:36px;width:36px;object-fit:contain;" onerror="this.style.display=\'none\'">' +
        '<span class="nav-logo-text">BFL</span>' +
      '</a>' +
      '<div class="topbar-right">' +
        '<button class="btn btn-ghost btn-sm theme-toggle" onclick="UI.toggleTheme()" title="Toggle theme" style="padding:5px 7px;min-width:32px;"></button>' +
        '<div class="nav-user" id="nav-user">' +
          '<div class="nav-avatar" id="nav-avatar">?</div>' +
          '<span id="nav-team-name">—</span>' +
        '</div>' +
    '</div>';

  // Build sidebar
  var sbWrap = document.getElementById('sb-wrap');
  if (!sbWrap) {
    sbWrap = document.createElement('div');
    sbWrap.id = 'sb-wrap';
    document.body.prepend(sbWrap);
  }
  sbWrap.innerHTML =
    '<aside class="sidebar" id="sidebar">' +
      '<div class="sb-logo-wrap">' +
        '<a href="dashboard.html" class="sb-logo">' +
          '<img src="images/bfl/bfl-logo.png" alt="BFL" style="height:36px;width:36px;object-fit:contain;" onerror="this.style.display=\'none\'">' +
          '<span>IPL26 - BFL</span>' +
        '</a>' +
      '</div>' +
      '<nav class="sb-nav">' +
        '<span class="sb-section-lbl">Play</span>' +
        buildSbLinks(['dashboard','predictions','squad','match-center'], links, activePage) +
        '<span class="sb-section-lbl">Rankings</span>' +
        buildSbLinks(['leaderboard'], links, activePage) +
        '<span class="sb-section-lbl">Insights</span>' +
        buildSbLinks(['analytics','pred-summary','accuracy','match-preds','fantasy-players','user-teams','power-rankings'], links, activePage) +
        '<span class="sb-section-lbl">Resources</span>' +
        buildSbLinks(['instructions'], links, activePage) +
      '</nav>' +
      '<div class="sb-footer">' +
        '<div class="sb-user-chip" id="sb-user-chip">' +
          '<div class="sb-avatar" id="sb-avatar">?</div>' +
          '<div class="sb-user-info">' +
            '<div class="sb-user-name" id="sb-user-name">—</div>' +
            '<div class="sb-user-role">' + (isAdmin ? 'Admin' : 'Team') + '</div>' +
          '</div>' +
        '</div>' +
        '<button class="btn btn-danger btn-sm btn-full" onclick="doLogout()" style="margin-top:8px;">Sign Out</button>' +
      '</div>' +
    '</aside>' +
    '<div class="sb-overlay" id="sb-overlay" onclick="closeSidebar()"></div>';

  applySidebarState(false);

  // Mobile bottom nav — show 5 most important
  var bnavEl = document.getElementById('bottom-nav-inner');
  if (bnavEl) {
    var bnavLinks = links.filter(function(l){ return l.bnav; }).slice(0,5);
    bnavEl.innerHTML = bnavLinks.map(function(l) {
      var bl = l.bnavLabel || l.label;
      return '<a href="' + l.href + '" class="bnav-link' + (activePage === l.page ? ' active' : '') + '">' +
        l.icon + '<span>' + bl + '</span></a>';
    }).join('');
  }

  UI.initTheme();
}

function buildSbLinks(pages, allLinks, activePage) {
  return pages.map(function(pg) {
    var l = allLinks.find(function(x){ return x.page===pg; });
    if (!l) return '';
    var isActive = activePage === l.page;
    return '<a href="' + l.href + '" class="sb-link' + (isActive ? ' active' : '') + '">' +
      '<span class="sb-icon">' + l.icon + '</span>' +
      '<span class="sb-label">' + l.label + '</span>' +
    '</a>';
  }).join('');
}

function toggleSidebar() {
  // On mobile (<900px), toggle always closes sidebar
  // On desktop, toggles between open/closed and persists
  if (window.innerWidth < 900) {
    _sidebarOpen = false;
  } else {
    _sidebarOpen = !_sidebarOpen;
    try { localStorage.setItem('bfl_sidebar', _sidebarOpen ? '1' : '0'); } catch(e) {}
  }
  applySidebarState(true);
}
function closeSidebar() {
  _sidebarOpen = false;
  applySidebarState(true);
}

// Handle resize to keep sidebar state consistent
window.addEventListener('resize', function() {
  applySidebarState(false);
});

function initOverlay() {
  var overlay = document.getElementById('sb-overlay');
  if (overlay && !overlay._bflInit) {
    overlay._bflInit = true;
    overlay.addEventListener('click', closeSidebar);
    overlay.addEventListener('touchstart', closeSidebar, {passive: true});
  }
}

function applySidebarState(animate) {
  var sidebar  = document.getElementById('sidebar');
  var overlay  = document.getElementById('sb-overlay');
  var wrap     = document.getElementById('page-content-wrap');
  var icon     = document.getElementById('sb-toggle-icon');
  if (!sidebar) return;

  // On mobile (<900px), sidebar should always be closed
  var isMobile = window.innerWidth < 900;
  var shouldBeOpen = !isMobile && _sidebarOpen;

  if (shouldBeOpen) {
    sidebar.classList.add('open');
    if (overlay) overlay.classList.add('visible');
    if (wrap) wrap.classList.add('sidebar-open');
  } else {
    sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('visible');
    if (wrap) wrap.classList.remove('sidebar-open');
  }

  if (icon) {
    // Toggle between hamburger and X
    icon.innerHTML = (shouldBeOpen)
      ? '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'
      : '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>';
  }
}

async function initNavbar(page, customLinks) {
  try {
    var sess = await Auth.getSession();
    var isAdmin = sess ? Auth.isAdmin(sess.user) : false;
    buildNavbar(page, isAdmin);
    initOverlay();

    if (!sess) return;
    var name = '', initials = '?';

    if (isAdmin) {
      name = 'Admin'; initials = 'A';
      setNavUser(name, initials, 'linear-gradient(135deg,#ff4d6d,#a78bfa)', null);
    } else {
      var team = await Auth.fetchTeam(sess.user.id);
      if (team && team.team_name) {
        name     = team.team_name;
        initials = name.split(' ').map(function(w){ return w[0]; }).join('').substring(0,2).toUpperCase();
        var codes = {CHENNAISUPERKINGS:'CSK',DELHICAPITALS:'DC',GUJARATTITANS:'GT',KOLKATAKNIGHTRIDERS:'KKR',LUCKNOWSUPERGIANTS:'LSG',MUMBAIINDIANS:'MI',PUNJABKINGS:'PBKS',RAJASTHANROYALS:'RR',ROYALCHALLENGERSBENGALURU:'RCB',SUNRISERSHYDERABAD:'SRH',SUPREMERAJAS:'SURA'};
        var cleanName = name.toUpperCase().replace(/\s+/g,'');
        var logo = UI.getTeamLogo(name);
        setNavUser(name, initials, null, logo);
      }
    }
    // Auto-close sidebar after link click (for all users)
    var sb = document.getElementById('sidebar');
    if (sb && !sb._bflClickBound) {
      sb._bflClickBound = true;
      sb.addEventListener('click', function(e) {
        var link = e.target.closest ? e.target.closest('.sb-link') : null;
        var btn = e.target.closest ? e.target.closest('button[onclick*="doLogout"]') : null;
        if (link || btn) {
          closeSidebar();
        }
      });
    }
  } catch(e) { console.warn('[navbar]', e.message); }
}

function setNavUser(name, initials, bg, logoUrl) {
  ['nav-avatar','sb-avatar'].forEach(function(id) {
    var el = document.getElementById(id); if (!el) return;
    if (logoUrl) {
      el.innerHTML = '<img src="' + logoUrl + '" style="width:100%;height:100%;object-fit:contain;padding:2px;" onerror="this.outerHTML=\'' + initials + '\'">';
      el.style.background = 'var(--bg3)';
      el.style.border = '1px solid var(--border)';
    } else {
      el.textContent = initials;
      if (bg) el.style.background = bg;
    }
  });
  ['nav-team-name','sb-user-name'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = UI.championName(name);
  });
}

/* .sb-section-lbl style is defined in css/styles.css — no JS injection needed */

async function doLogout() { await Auth.signOut(); }