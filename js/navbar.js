// navbar.js — BFL Fantasy IPL 2026  v5
// Desktop: collapsible sidebar. Mobile: bottom tab bar.
'use strict';

var NAV_LINKS = [
  { href:'dashboard.html',    label:'Dashboard',   page:'dashboard',    bnav:true,
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>' },
  { href:'squad.html',        label:'My Squad',    page:'squad',        bnav:true,
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/><path d="M16 3.13a4 4 0 010 7.75"/><path d="M21 21v-2a4 4 0 00-3-3.85"/></svg>' },
  { href:'predictions.html',  label:'Predictions', page:'predictions',  bnav:true,
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>' },
  { href:'leaderboard.html',  label:'Standings',   page:'leaderboard',  bnav:true,
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>' },
  { href:'analytics.html',    label:'Analytics',   page:'analytics',    bnav:true,
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>' },
  { href:'match-center.html', label:'Matches',     page:'match-center', bnav:false,
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>' },
  { href:'blogs.html',        label:'Blogs',       page:'blogs',        bnav:false,
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>' },
  { href:'admin.html',        label:'Admin',       page:'admin',        bnav:false, adminOnly:true,
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>' },
];

// Sidebar state — persisted in localStorage
var _sidebarOpen = true;
var _customSidebarLinks = null; 
try {
  var _saved = localStorage.getItem('bfl_sidebar');
  if (_saved !== null) {
    _sidebarOpen = _saved === '1';
  } else {
    // If no saved state, default to open
    _sidebarOpen = true;
    localStorage.setItem('bfl_sidebar', '1');
  }
} catch(e) {}

function buildNavbar(activePage, isAdmin) {
  var navbarEl = document.getElementById('navbar');
  if (navbarEl) {
    var links = _customSidebarLinks || NAV_LINKS;
    var navItemsHtml = links.filter(function(l) { return !l.adminOnly || isAdmin; }).map(function(l) {
      var isActive = activePage === l.page;
      var oc = l.onclick ? ' onclick="' + l.onclick + '; if(window.innerWidth<1024) toggleSidebar();"' : '';
      return '<a href="' + l.href + '" class="sb-link' + (isActive ? ' active' : '') + '"' + oc + ' title="' + l.label + '">' +
        '<span class="sb-icon">' + l.icon + '</span>' +
        '<span class="sb-label">' + l.label + '</span>' +
      '</a>';
    }).join('');

    // Split into Topbar (in #navbar) and Sidebar (at body top)
    navbarEl.innerHTML =
      '<div class="topbar">' +
        '<button class="sb-toggle" id="sb-toggle" onclick="toggleSidebar()" aria-label="Toggle menu">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>' +
        '</button>' +
        '<a href="dashboard.html" class="nav-logo">' +
          '<span class="nav-logo-dot"></span>' +
          '<span class="nav-logo-text">BFL Fantasy</span>' +
        '</a>' +
        '<div class="topbar-right">' +
          '<button class="btn btn-ghost btn-sm theme-toggle" onclick="UI.toggleTheme()" title="Toggle theme" style="padding:5px 7px;min-width:32px;"></button>' +
          '<div class="nav-user" id="nav-user">' +
            '<div class="nav-avatar" id="nav-avatar">?</div>' +
            '<span id="nav-team-name">—</span>' +
          '</div>' +
          '<button class="btn btn-ghost btn-sm" onclick="doLogout()">Logout</button>' +
        '</div>' +
      '</div>';

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
            '<span class="nav-logo-dot"></span>' +
            '<span>BFL Fantasy</span>' +
          '</a>' +
        '</div>' +
        '<nav class="sb-nav">' + navItemsHtml + '</nav>' +
        '<div class="sb-footer">' +
          '<div class="sb-user-chip" id="sb-user-chip">' +
            '<div class="nav-avatar sb-avatar" id="sb-avatar">?</div>' +
            '<div class="sb-user-info">' +
              '<div class="sb-user-name" id="sb-user-name">—</div>' +
              '<div class="sb-user-role">Team</div>' +
            '</div>' +
          '</div>' +
          '<button class="btn btn-ghost btn-sm btn-full" onclick="doLogout()" style="margin-top:8px;">Logout</button>' +
        '</div>' +
      '</aside>' +
      '<div class="sb-overlay" id="sb-overlay" onclick="closeSidebar()"></div>';

    // Apply initial state
    applySidebarState(false);
  }

  // Mobile bottom nav
  var bnavEl = document.getElementById('bottom-nav-inner');
  if (bnavEl) {
    var links = _customSidebarLinks || NAV_LINKS;
    bnavEl.innerHTML = links.filter(function(l){ return l.bnav && (!l.adminOnly || isAdmin); }).map(function(l) {
      return '<a href="' + l.href + '" class="bnav-link' + (activePage === l.page ? ' active' : '') + '">' +
        l.icon + '<span>' + l.label + '</span></a>';
    }).join('');
  }

  UI.initTheme();
}

function toggleSidebar() {
  _sidebarOpen = !_sidebarOpen;
  try { localStorage.setItem('bfl_sidebar', _sidebarOpen ? '1' : '0'); } catch(e) {}
  applySidebarState(true);
}
function closeSidebar() {
  _sidebarOpen = false;
  applySidebarState(true);
}
function applySidebarState(animate) {
  var sidebar = document.getElementById('sidebar');
  var overlay = document.getElementById('sb-overlay');
  var wrap    = document.getElementById('page-content-wrap');
  if (!sidebar) return;
  if (_sidebarOpen) {
    sidebar.classList.add('open');
    if (overlay) overlay.classList.add('visible');
    if (wrap)    wrap.classList.add('sidebar-open');
  } else {
    sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('visible');
    if (wrap)    wrap.classList.remove('sidebar-open');
  }
}

async function initNavbar(page, customLinks) {
  try {
    if (customLinks) _customSidebarLinks = customLinks;
    var sess = await Auth.getSession();
    var isAdmin = sess ? Auth.isAdmin(sess.user) : false;
    buildNavbar(page, isAdmin);

    if (!sess) return;
    var name = '', initials = '?', adminMode = isAdmin;

    if (adminMode) {
      name = 'Admin'; initials = 'A';
      setNavUser(name, initials, 'linear-gradient(135deg,#ff4d6d,#a78bfa)', 'images/bfl/bfl-logo.png');
    } else {
      var team = await Auth.fetchTeam(sess.user.id);
      if (team && team.team_name) {
        name     = team.team_name;
        initials = name.split(' ').map(function(w){ return w[0]; }).join('').substring(0,2).toUpperCase();
        
        // Map team name to logo
        var codes = {CHENNAISUPERKINGS:'CSK',DELHICAPITALS:'DC',GUJARATTITANS:'GT',KOLKATAKNIGHTRIDERS:'KKR',LUCKNOWSUPERGIANTS:'LSG',MUMBAIINDIANS:'MI',PUNJABKINGS:'PBKS',RAJASTHANROYALS:'RR',ROYALCHALLENGERSBENGALURU:'RCB',SUNRISERSHYDERABAD:'SRH',SUPREMERAJAS:'SURA'};
        var cleanName = name.toUpperCase().replace(/\s+/g,'');
        var code = codes[cleanName] || null;
        var logo = code ? 'images/teams/' + code + 'outline.png' : null;
        
        setNavUser(name, initials, null, logo);
      } else {
        setNavUser('Team', 'T', null, null);
      }
    }
  } catch(e) { console.warn('navbar:', e.message); }
}

function setNavUser(name, initials, bg, logoUrl) {
  var avatarIds = ['nav-avatar','sb-avatar'];
  avatarIds.forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    if (logoUrl) {
      el.innerHTML = '<img src="' + logoUrl + '" style="width:100%;height:100%;object-fit:contain;padding:2px;" onerror="this.outerHTML=\'' + initials + '\'">';
      el.style.background = 'var(--bg3)';
      el.style.border = '1px solid var(--border)';
    } else {
      el.textContent = initials;
      if (bg) el.style.background = bg;
    }
  });
  var nameIds = ['nav-team-name','sb-user-name'];
  if (Array.isArray(nameIds)) {
    nameIds.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.textContent = name;
    });
  }
}

async function doLogout() { await Auth.signOut(); }
