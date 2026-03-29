// navbar.js — BFL Fantasy IPL 2026  v6
// Desktop: collapsible sidebar. Mobile: bottom tab bar.
'use strict';

var NAV_LINKS = [
  { href:'dashboard.html',    label:'Dashboard',   page:'dashboard',      bnav:true,
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>' },
  { href:'squad.html',        label:'My Squad',    page:'squad',          bnav:true,
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/><path d="M16 3.13a4 4 0 010 7.75"/><path d="M21 21v-2a4 4 0 00-3-3.85"/></svg>' },
  { href:'predictions.html',  label:'Predictions', page:'predictions',    bnav:true,
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>' },
  { href:'match-center.html', label:'Matches',     page:'match-center',   bnav:true,
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>' },
  { href:'leaderboard.html',  label:'Standings',   page:'leaderboard',    bnav:true,
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>' },
  { href:'analytics.html',    label:'Analytics',   page:'analytics',      bnav:false,
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>' },
  { href:'blogs.html',        label:'Blogs',       page:'blogs',          bnav:false,
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>' },
  { href:'instructions.html', label:'Guide',       page:'instructions',   bnav:false,
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' },
  { href:'admin.html',        label:'Admin',       page:'admin',          bnav:false, adminOnly:true,
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>' },
];

// Sidebar state — persisted in localStorage
var _sidebarOpen = true;
try {
  var _saved = localStorage.getItem('bfl_sidebar');
  if (_saved !== null) {
    _sidebarOpen = _saved === '1';
  } else {
    _sidebarOpen = window.innerWidth > 900;
    localStorage.setItem('bfl_sidebar', _sidebarOpen ? '1' : '0');
  }
} catch(e) {}

function buildNavbar(activePage, isAdmin) {
  var navbarEl = document.getElementById('navbar');
  if (!navbarEl) return;

  var links = NAV_LINKS.filter(function(l) { return !l.adminOnly || isAdmin; });

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
        '<span class="nav-logo-text">BISHOPIANS FANTASY LEAGUE</span>' +
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
        buildSbLinks(['dashboard','squad','predictions','match-center','leaderboard'], links, activePage) +
        '<span class="sb-section-lbl">Insights</span>' +
        buildSbLinks(['analytics','blogs'], links, activePage) +
        '<span class="sb-section-lbl">Help</span>' +
        buildSbLinks(['instructions'], links, activePage) +
        (isAdmin ? '<span class="sb-section-lbl">System</span>' + buildSbLinks(['admin'], links, activePage) : '') +
      '</nav>' +
      '<div class="sb-footer">' +
        '<div class="sb-user-chip" id="sb-user-chip">' +
          '<div class="sb-avatar" id="sb-avatar">?</div>' +
          '<div class="sb-user-info">' +
            '<div class="sb-user-name" id="sb-user-name">—</div>' +
            '<div class="sb-user-role">' + (isAdmin ? 'Admin' : 'Team') + '</div>' +
          '</div>' +
        '</div>' +
        '<button class="btn btn-ghost btn-sm btn-full" onclick="doLogout()" style="margin-top:8px;">Logout</button>' +
      '</div>' +
    '</aside>' +
    '<div class="sb-overlay" id="sb-overlay" onclick="closeSidebar()"></div>';

  applySidebarState(false);

  // Mobile bottom nav — show 5 most important
  var bnavEl = document.getElementById('bottom-nav-inner');
  if (bnavEl) {
    var bnavLinks = links.filter(function(l){ return l.bnav; }).slice(0,5);
    bnavEl.innerHTML = bnavLinks.map(function(l) {
      return '<a href="' + l.href + '" class="bnav-link' + (activePage === l.page ? ' active' : '') + '">' +
        l.icon + '<span>' + l.label + '</span></a>';
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
  _sidebarOpen = !_sidebarOpen;
  try { localStorage.setItem('bfl_sidebar', _sidebarOpen ? '1' : '0'); } catch(e) {}
  applySidebarState(true);
}
function closeSidebar() {
  _sidebarOpen = false;
  applySidebarState(true);
}

function applySidebarState(animate) {
  var sidebar  = document.getElementById('sidebar');
  var overlay  = document.getElementById('sb-overlay');
  var wrap     = document.getElementById('page-content-wrap');
  var icon     = document.getElementById('sb-toggle-icon');
  if (!sidebar) return;

  if (_sidebarOpen) {
    sidebar.classList.add('open');
    if (overlay) overlay.classList.add('visible');
    if (wrap && window.innerWidth >= 900) wrap.classList.add('sidebar-open');
  } else {
    sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('visible');
    if (wrap) wrap.classList.remove('sidebar-open');
  }

  if (icon) {
    // Toggle between hamburger and X
    icon.innerHTML = (_sidebarOpen && window.innerWidth >= 900)
      ? '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'
      : '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>';
  }
}

async function initNavbar(page, customLinks) {
  try {
    var sess = await Auth.getSession();
    var isAdmin = sess ? Auth.isAdmin(sess.user) : false;
    buildNavbar(page, isAdmin);

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
      // Auto-close sidebar on mobile after link click
      var sb = document.getElementById('sidebar');
      if (sb && !sb._bflClickBound) {
        sb._bflClickBound = true;
        sb.addEventListener('click', function(e) {
          if (e.target && e.target.closest && e.target.closest('.sb-link')) {
            if (window.innerWidth < 900) closeSidebar();
          }
        });
      }
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
    if (el) el.textContent = name;
  });
}

// Sidebar section label (not in styles.css so defined here)
document.addEventListener('DOMContentLoaded', function() {
  if (!document.querySelector('.sb-section-lbl-style')) {
    var s = document.createElement('style');
    s.className = 'sb-section-lbl-style';
    s.textContent = '.sb-section-lbl{display:block;font-family:var(--f-ui);font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1.8px;color:var(--text3);padding:14px 18px 4px;}';
    document.head.appendChild(s);
  }
});

async function doLogout() { await Auth.signOut(); }