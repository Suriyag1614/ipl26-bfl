'use strict';
// ─────────────────────────────────────────────────────────────
//  admin.js — BFL Fantasy IPL 2026  v3  Full Admin Controller
//  Fixes: sidebar toggle, dropdown population, all panels,
//         interactive audit undo, CSV upload, AI blog gen
// ─────────────────────────────────────────────────────────────

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════ */
var ALL_TEAMS = [
  'CHENNAI SUPER KINGS','DELHI CAPITALS','GUJARAT TITANS',
  'KOLKATA KNIGHT RIDERS','LUCKNOW SUPER GIANTS','MUMBAI INDIANS',
  'PUNJAB KINGS','RAJASTHAN ROYALS','ROYAL CHALLENGERS BENGALURU',
  'SUNRISERS HYDERABAD','SUPREME RAJAS'
];


var TEAM_COLORS = {
  CSK:'#fdb913',MI:'#004ba0',RCB:'#da1818',KKR:'#6a1bac',SRH:'#f26522',
  DC:'#004c93',PBKS:'#ed1b24',RR:'#ea1a85',GT:'#1c2c5b',LSG:'#ff002b',SURA:'#1a3a8a'
};

var ACTION_COLORS = {
  stat_entry:'#60a5fa', match_edit:'#f0b429', adjustment:'#f5c842',
  injury_set:'#f87171', replacement_created:'#38d9f5', blog_published:'#34d399',
  match_abandoned:'#a78bfa', deadline_extended:'#fbbf24', dls_target_set:'#fbbf24',
  squad_roles_updated:'#a78bfa', predictions_locked:'#f87171'
};

/* ══════════════════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════════════════ */
var _matches      = [];
var _players      = [];
var _teams        = [];   // leaderboard rows with team_name
var _fixtures     = [];   // filtered fixture list
var _fixtureQ     = '';
var _statsMatchId = null;
var _statsPlayerId= null;
var _statPlayers  = [];   // players filtered to current match teams
var _ctrlMatchId  = null;
var _blogFilter   = 'all';
var _squadEdits   = {};   // teamId → {captainId,vcId,impactId}
var _sidebarOpen  = true;

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
function tCode(name) { return UI.tCode(name); }
function tShort(name) { return UI.tShort(name); }
function tColor(name) {
  var c = tCode(name);
  return (c && TEAM_COLORS[c]) ? TEAM_COLORS[c] : 'var(--accent)';
}
function safeArr(v) { return Array.isArray(v) ? v : (v ? [v] : []); }
function $id(id)    { return document.getElementById(id); }

function cLog(msg, type) {
  var el = $id('calc-log'); if (!el) return;
  var d = document.createElement('div');
  d.className = 'calc-line ' + (type||'');
  d.textContent = '[' + new Date().toLocaleTimeString('en-IN') + '] ' + msg;
  el.appendChild(d); el.scrollTop = el.scrollHeight;
}

function ctrlMsg(msg, type) {
  var el = $id('ctrl-log'); if (!el) return;
  var col = type==='ok'?'var(--green)':type==='err'?'var(--red)':'var(--text2)';
  el.innerHTML = '<div style="'+col+';font-size:13px;padding:10px 14px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;">'+UI.esc(msg)+'</div>';
}

/* ══════════════════════════════════════════════════════════════
   SIDEBAR TOGGLE  (Fixed — works on all screen sizes)
══════════════════════════════════════════════════════════════ */
function toggleSidebar() {
  _sidebarOpen = !_sidebarOpen;
  applySidebarState();
}
function closeSidebar() {
  _sidebarOpen = false;
  applySidebarState();
}
function applySidebarState() {
  var sb      = $id('admin-sidebar');
  var body    = $id('admin-body');
  var overlay = $id('sb-overlay');
  var icon    = $id('hamburger-icon');

  if (!sb) return;

  var isMobile = window.innerWidth <= 900;

  if (_sidebarOpen) {
    sb.classList.remove('collapsed');
    if (isMobile) {
      sb.classList.add('open');
      if (overlay) overlay.classList.add('visible');
    } else {
      if (body)    body.style.marginLeft = 'var(--sidebar-w)';
      if (overlay) overlay.classList.remove('visible');
    }
  } else {
    if (isMobile) {
      sb.classList.remove('open');
    } else {
      sb.classList.add('collapsed');
      if (body) body.style.marginLeft = '0';
    }
    if (overlay) overlay.classList.remove('visible');
  }

  // Update hamburger icon
  if (icon) {
    icon.innerHTML = _sidebarOpen && !isMobile
      ? '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'
      : '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>';
  }
}

/* ══════════════════════════════════════════════════════════════
   PANEL ROUTER
══════════════════════════════════════════════════════════════ */
function showPanel(id) {
  // Persist current panel to URL hash and sessionStorage for refresh restore
  if (id) {
    location.hash = id;
    try { sessionStorage.setItem('admin-panel', id); } catch(_){}
  }
  // Hide all panels
  document.querySelectorAll('.admin-panel').forEach(function(p) { p.classList.remove('active'); });
  // Deactivate all sidebar links
  document.querySelectorAll('.sb-link').forEach(function(l) { l.classList.remove('active'); });

  var panel = $id('panel-' + id);
  if (panel) panel.classList.add('active');

  var link = document.querySelector('.sb-link[data-panel="' + id + '"]');
  if (link) link.classList.add('active');

  // Lazy-load panel
  var loaders = {
    dashboard:  loadDashboard,
    fixtures:   renderFixtureList,
    results:    loadResultsPanel,
    matchctrl:  loadMatchCtrlPanel,
    stats:      function() {}, // match dropdown already populated
    calculate:  function() {},
    overrides:  function() { loadAdjustments(); },
    injuries:   loadInjuries,
    squads:     function() {},
    blogs:      loadBlogList,
    users:      loadUsers,
    audit:      loadAuditLog,
  };
  if (loaders[id]) loaders[id]();

  // Close sidebar on mobile after navigation
  if (window.innerWidth <= 900) { _sidebarOpen = false; applySidebarState(); }
}

/* ══════════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════════ */
async function init() {
  try {
    UI.initTheme();
    var sess = await Auth.requireAuth();
    if (!sess) return;
    if (!Auth.isAdmin(sess.user)) { window.location.href = 'dashboard.html'; return; }

    // Show admin name in topbar
    var nameEl = $id('topbar-admin-name');
    if (nameEl) nameEl.textContent = sess.user.email === 'admin@bfl.in' ? 'Admin' : sess.user.email;

    // Sidebar initial state (open on desktop, closed on mobile)
    _sidebarOpen = window.innerWidth > 900;
    applySidebarState();

    // Resize handler
    window.addEventListener('resize', function() {
      if (window.innerWidth > 900 && !_sidebarOpen) {
        // On desktop, re-open if it was only closed for mobile
      }
      applySidebarState();
    });

    // Load core data
    await Promise.all([loadAllMatches(), loadAllPlayers(), loadAllTeams()]);

    // Populate all dropdowns
    populateAllDropdowns();

    // Restore last active panel from URL hash or sessionStorage, else default to dashboard
    var startPanel = (location.hash || '').replace('#', '') || '';
    if (!startPanel) try { startPanel = sessionStorage.getItem('admin-panel') || ''; } catch(_){}
    if (startPanel && document.getElementById('panel-' + startPanel)) {
      showPanel(startPanel);
    } else {
      await loadDashboard();
    }

  } catch (err) {
    console.error('[admin init]', err);
    UI.toast('Initialisation failed: ' + err.message, 'error');
  }
}

/* ══════════════════════════════════════════════════════════════
   DATA LOADERS
══════════════════════════════════════════════════════════════ */
async function loadAllMatches() {
  try {
    _matches = safeArr(await API.fetchMatches({ limit: 74 }));
    _fixtures = _matches.slice();
  } catch(e) { console.error('[loadAllMatches]', e); _matches = []; _fixtures = []; }
}

async function loadAllPlayers() {
  try { _players = safeArr(await API.fetchAllPlayers()); }
  catch(e) { console.error('[loadAllPlayers]', e); _players = []; }
}

async function loadAllTeams() {
  try {
    var raw = safeArr(await API.fetchTeams());
    // Create an object format that matches what the admin logic expects
    _teams = raw.map(function(t) {
      return {
        fantasy_team_id: t.id,
        team: t
      };
    });
  } catch(e) { console.error('[loadAllTeams]', e); _teams = []; }
}

/* ══════════════════════════════════════════════════════════════
   POPULATE DROPDOWNS  (called once after data loads)
══════════════════════════════════════════════════════════════ */
function populateAllDropdowns() {
  populateTeamOpts();
  populateMatchOpts();
  populateTeamSelects();
  populateInjTeamSelect();
}

function populateInjTeamSelect() {
  var el = $id('inj-team-sel'); if (!el) return;
  el.innerHTML = '<option value="">— Select team —</option>' +
    ALL_TEAMS.map(function(t) { return '<option value="'+t+'">'+t+'</option>'; }).join('');
}

function populateTeamOpts() {
  // For fixture form team selects
  var teamOptHtml = '<option value="">— Select team —</option>' +
    ALL_TEAMS.map(function(t) { return '<option value="'+t+'">'+t+'</option>'; }).join('');
  ['fx-team1','fx-team2'].forEach(function(id) {
    var el = $id(id); if (el) el.innerHTML = teamOptHtml;
  });
}

function populateMatchOpts() {
  var opts = '<option value="">— Select match —</option>' +
    _matches.map(function(m) {
      var lbl = 'M'+(m.match_no||'?')+' · '+tShort(m.team1)+' vs '+tShort(m.team2)+' · '+UI.shortDate(m.match_date);
      var sfx = m.status==='abandoned' ? ' ☔' : (m.is_locked ? ' 🔒' : ' ●');
      return '<option value="'+m.id+'">'+lbl+sfx+'</option>';
    }).join('');

  // Stats, calc, match controls, results
  ['stats-match','calc-match','ctrl-match','res-match'].forEach(function(id) {
    var el = $id(id); if (!el) return;
    var cur = el.value;
    el.innerHTML = opts;
    if (cur) el.value = cur;
  });

  // Override match — with season-wide option
  var ovrEl = $id('ovr-match');
  if (ovrEl) {
    var cur = ovrEl.value;
    ovrEl.innerHTML = '<option value="">— Season-wide adjustment —</option>' +
      _matches.map(function(m) {
        return '<option value="'+m.id+'">M'+(m.match_no||'?')+' · '+tShort(m.team1)+' vs '+tShort(m.team2)+'</option>';
      }).join('');
    if (cur) ovrEl.value = cur;
  }

  // PoM dropdown — will be populated dynamically in loadResultForm based on teams
  var pomEl = $id('res-pom');
  if (pomEl) pomEl.innerHTML = '<option value="">— Select a match first —</option>';
}

function populateTeamSelects() {
  // Leaderboard-based team options (have fantasy_team_id + team.team_name)
  var lb_opts = '<option value="">— Select team —</option>' +
    _teams.map(function(r) {
      var name = r.team ? r.team.team_name : '—';
      return '<option value="'+r.fantasy_team_id+'">'+UI.esc(name)+'</option>';
    }).join('');
  var all_teams_opt = '<option value="">All Teams</option>' +
    _teams.map(function(r) {
      var name = r.team ? r.team.team_name : '—';
      return '<option value="'+r.fantasy_team_id+'">'+UI.esc(name)+'</option>';
    }).join('');

  ['ovr-team','rep-team','squad-team'].forEach(function(id) {
    var el = $id(id); if (!el) return;
    var cur = el.value;
    el.innerHTML = lb_opts;
    if (cur) el.value = cur;
  });
  // Team filter for replacement requests
  var repTeamFilter = $id('rep-team-filter');
  if(repTeamFilter){
    var curTeamFilter = repTeamFilter.value;
    repTeamFilter.innerHTML = all_teams_opt;
    if(curTeamFilter) repTeamFilter.value = curTeamFilter;
  }
}

/* ══════════════════════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════════════════════ */
async function loadDashboard() {
  $id('dash-greeting').textContent =
    new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'}) + ' · BFL Admin';

  try {
    var [lb, matches] = await Promise.all([API.fetchLeaderboard(), API.fetchMatches({limit:74})]);
    _matches = safeArr(matches);
    _fixtures = _matches.slice();
    populateMatchOpts();

    var total     = _matches.length;
    var locked    = _matches.filter(function(m){return m.is_locked;}).length;
    var abandoned = _matches.filter(function(m){return m.status==='abandoned';}).length;
    var upcoming  = _matches.filter(function(m){return !m.is_locked && m.status!=='abandoned';});
    var pendCalc  = _matches.filter(function(m){return m.is_locked && m.winner && m.status!=='processed' && m.status!=='abandoned';}).length;

    // KPI cards
    var kpis = [
      { val:total,      lbl:'Total Matches',     sub:upcoming.length+' upcoming',    c:'var(--accent)' },
      { val:locked,     lbl:'Locked / Completed', sub:abandoned+' abandoned',         c:'var(--cyan)' },
      { val:pendCalc,   lbl:'Pending Calc',        sub:'Need calculation',             c:pendCalc?'var(--red)':'var(--green)' },
      { val:lb.length,  lbl:'Teams',               sub:'Registered',                  c:'var(--gold)' },
      { val:_players.length, lbl:'Players',        sub:'In player pool',               c:'var(--purple)' },
      { val:upcoming.length, lbl:'Open Predictions', sub:'Accepting entries',          c:'var(--green)' },
    ];
    $id('kpi-grid').innerHTML = kpis.map(function(k,i) {
      return '<div class="kpi-card" style="--kc:'+k.c+';animation-delay:'+(i*.07)+'s">'+
        '<div class="kpi-val">'+k.val+'</div>'+
        '<div class="kpi-lbl">'+k.lbl+'</div>'+
        (k.sub?'<div class="kpi-sub">'+k.sub+'</div>':'')+
      '</div>';
    }).join('');

    // Upcoming matches
    $id('dash-upcoming').innerHTML = !upcoming.length
      ? '<div style="color:var(--text3);font-size:13px;padding:8px 0;">No upcoming matches.</div>'
      : upcoming.slice(0,5).map(function(m) {
          return '<div class="fx-row" onclick="showPanel(\'fixtures\')" style="cursor:pointer;">'+
            '<div class="fx-label"><div class="fx-title">M'+(m.match_no||'?')+' · '+UI.esc(tShort(m.team1)+' vs '+tShort(m.team2))+'</div>'+
            '<div class="fx-sub">'+UI.fmtDate(m.match_date)+(m.venue?' · '+UI.esc(m.venue):'')+'</div></div>'+
            '<span class="match-status status-open" style="font-size:10px;">Open</span>'+
          '</div>';
        }).join('');

    // Pending calculation
    var pendMatches = _matches.filter(function(m){return m.is_locked && m.winner && m.status!=='processed' && m.status!=='abandoned';});
    $id('dash-pending').innerHTML = !pendMatches.length
      ? '<div style="color:var(--green);font-size:13px;padding:8px 0;">✓ All matches calculated.</div>'
      : pendMatches.slice(0,5).map(function(m) {
          return '<div class="fx-row" onclick="showPanel(\'calculate\')" style="cursor:pointer;">'+
            '<div class="fx-label"><div class="fx-title">M'+(m.match_no||'?')+' · '+UI.esc(m.team1)+' vs '+UI.esc(m.team2)+'</div>'+
            '<div class="fx-sub">Winner: '+UI.esc(m.winner||'—')+' · Target: '+(m.actual_target||'—')+'</div></div>'+
            '<span class="pending-dot"></span>'+
          '</div>';
        }).join('');

    // Top 5
    var medals = {1:'🥇',2:'🥈',3:'🥉'};
    $id('dash-leaderboard').innerHTML = lb.slice(0,5).map(function(r) {
      return '<div class="user-row">'+
        '<div class="user-avatar" style="font-size:14px;">'+(medals[r.rank]||r.rank)+'</div>'+
        '<div style="flex:1;font-family:var(--f-ui);font-weight:700;font-size:13px;">'+UI.championName(r.team?r.team.team_name:'—')+'</div>'+
        '<div style="font-family:var(--f-display);font-weight:900;font-size:16px;color:var(--accent);">'+r.total_points+'</div>'+
      '</div>';
    }).join('');

    // Recent audit
    var logs = safeArr(await API.fetchActionLog({limit:6}));
    $id('dash-audit').innerHTML = !logs.length
      ? '<div style="color:var(--text3);font-size:13px;padding:8px 0;">No actions yet.</div>'
      : logs.map(function(l) {
          var col = ACTION_COLORS[l.action_type] || 'var(--text2)';
          return '<div class="user-row">'+
            '<span style="background:'+col+'22;color:'+col+';font-size:9px;font-weight:700;padding:2px 7px;border-radius:3px;font-family:var(--f-ui);flex-shrink:0;">'+UI.esc(l.action_type)+'</span>'+
            '<div style="flex:1;font-size:12px;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+UI.esc(l.entity_type)+' '+UI.esc((l.entity_id||'').substring(0,8))+'…</div>'+
            '<div style="font-size:11px;color:var(--text3);flex-shrink:0;">'+UI.shortDate(l.created_at)+'</div>'+
          '</div>';
        }).join('');

  } catch(e) { UI.toast('Dashboard error: '+e.message,'error'); console.error(e); }
}

/* ══════════════════════════════════════════════════════════════
   FIXTURES
══════════════════════════════════════════════════════════════ */
async function renderFixtureList() {
  buildTeamOpts();
  filterFixtures('');
}

function buildTeamOpts() {
  var opts = '<option value="">— Select team —</option>' +
    ALL_TEAMS.map(function(t){return '<option value="'+t+'">'+t+'</option>';}).join('');
  ['fx-team1','fx-team2'].forEach(function(id){
    var el=$id(id); if(el) el.innerHTML=opts;
  });
}

function filterFixtures(q) {
  if (q !== undefined) _fixtureQ = (q||'').toLowerCase();
  var sf = $id('fx-status-filter');
  var status = sf ? sf.value : '';
  var list = _fixtures.filter(function(m) {
    var text = ('M'+(m.match_no||'')+' '+m.team1+' '+m.team2+' '+(m.venue||'')).toLowerCase();
    return (!_fixtureQ || text.includes(_fixtureQ)) && (!status || m.status===status);
  });
  var cont = $id('fixture-list');
  if (!list.length) { cont.innerHTML='<div style="padding:20px;text-align:center;color:var(--text3);">No matches found.</div>'; return; }
  cont.innerHTML = list.map(function(m,i) {
    var sCls = m.status==='completed'||m.status==='processed'?'status-done':m.status==='abandoned'?'status-upcoming':m.is_locked?'status-locked':'status-open';
    var sTxt = m.status==='abandoned'?'☔ Abandoned':m.is_locked?'🔒 Locked':'● Open';
    return '<div class="fx-row" style="animation:row-in .2s ease '+(i*.025)+'s both;" onclick="editFixture(\''+m.id+'\')">'+
      '<span style="font-family:var(--f-mono);font-size:11px;color:var(--text3);min-width:26px;">'+(m.match_no||i+1)+'</span>'+
      '<div class="fx-label">'+
        '<div class="fx-title">'+UI.esc(tShort(m.team1)+' vs '+tShort(m.team2))+'</div>'+
        '<div class="fx-sub">'+UI.shortDate(m.match_date)+(m.venue?' · '+UI.esc(m.venue):'')+'</div>'+
      '</div>'+
      '<span class="match-status '+sCls+'" style="font-size:10px;">'+sTxt+'</span>'+
      '<div class="fx-actions"><button class="btn btn-ghost btn-sm" style="padding:3px 8px;font-size:11px;" onclick="event.stopPropagation();editFixture(\''+m.id+'\')">Edit</button></div>'+
    '</div>';
  }).join('');
}

function clearFixtureForm() {
  $id('fx-id').value=''; $id('fx-no').value=''; $id('fx-date').value='';
  ['fx-team1','fx-team2','fx-venue'].forEach(function(id){var e=$id(id);if(e)e.value='';});
  $id('fx-time').value='19:30'; $id('fx-status').value='upcoming';
  $id('fx-form-title').textContent='New Match'; $id('fx-delete-btn').style.display='none';
}

function editFixture(matchId) {
  var m = _fixtures.find(function(x){return x.id===matchId;});
  if (!m) return;
  $id('fx-id').value=m.id; $id('fx-no').value=m.match_no||'';
  $id('fx-form-title').textContent='Editing M'+(m.match_no||'');
  $id('fx-delete-btn').style.display='';
  $id('fx-team1').value=m.team1||''; $id('fx-team2').value=m.team2||'';
  $id('fx-venue').value=m.venue||''; $id('fx-status').value=m.status||'upcoming';
  if (m.match_date) {
    var dt = new Date(m.match_date);
    $id('fx-date').value = dt.toLocaleDateString('sv',{timeZone:'Asia/Kolkata'});
    $id('fx-time').value = String(dt.getHours()).padStart(2,'0')+':'+String(dt.getMinutes()).padStart(2,'0');
  }
  // Scroll form into view on mobile
  var card = $id('fx-form-title');
  if (card) card.scrollIntoView({behavior:'smooth',block:'nearest'});
}

async function saveFixture() {
  var id=($id('fx-id').value||'').trim();
  var team1=$id('fx-team1').value, team2=$id('fx-team2').value;
  if (!team1||!team2) { UI.toast('Select both teams','warn'); return; }
  var date=$id('fx-date').value, time=$id('fx-time').value||'19:30';
  var no=parseInt($id('fx-no').value||0)||null;
  var venue=$id('fx-venue').value, status=$id('fx-status').value;
  var matchDate = date ? new Date(date+'T'+time+':00+05:30').toISOString() : null;
  var deadline  = matchDate; // Auto-lock is now exact start time
  var lockTime  = deadline;  // Strict locking at start time
  var match = { match_no:no, team1, team2, venue, status, match_date:matchDate,
    deadline_time:deadline, lock_time:lockTime,
    match_title:'Match '+(no||'?')+' · '+tShort(team1)+' vs '+tShort(team2),
    is_locked: status!=='upcoming' && status!=='live' };
  if (id) match.id = id;
  try {
    await API.upsertMatch(match);
    UI.toast('Match saved!','success');
    clearFixtureForm();
    await loadAllMatches();
    populateMatchOpts();
    filterFixtures();
  } catch(e) { UI.toast('Save failed: '+e.message,'error'); }
}

async function deleteFixture() {
  var id = $id('fx-id').value; if (!id) return;
  UI.showConfirm({
    icon:'🗑️', title:'Delete Match?',
    msg:'Permanently removes the fixture.',
    consequence:'Related predictions, stats, and points_log will remain in the DB.',
    okLabel:'Delete', okClass:'btn-danger',
    onOk: async function() {
      try {
        var {error} = await sb.from('matches').delete().eq('id',id);
        if (error) throw error;
        UI.toast('Match deleted','warn');
        clearFixtureForm();
        await loadAllMatches(); populateMatchOpts(); filterFixtures();
      } catch(e) { UI.toast(e.message,'error'); }
    }
  });
}

async function loadIPLFixtures() {
  UI.showConfirm({
    icon:'⚡', title:'Load IPL 2026 Fixtures?',
    msg:'Insert the standard IPL schedule. Existing match numbers are skipped.',
    okLabel:'Load', okClass:'btn-accent',
    onOk: async function() {
      var schedule = [
        {no:1,h:'KOLKATA KNIGHT RIDERS',a:'ROYAL CHALLENGERS BENGALURU',d:'2026-03-22',t:'19:30',v:'Kolkata'},
        {no:2,h:'SUNRISERS HYDERABAD',a:'RAJASTHAN ROYALS',d:'2026-03-23',t:'15:30',v:'Hyderabad'},
        {no:3,h:'DELHI CAPITALS',a:'LUCKNOW SUPER GIANTS',d:'2026-03-23',t:'19:30',v:'Delhi'},
        {no:4,h:'GUJARAT TITANS',a:'PUNJAB KINGS',d:'2026-03-24',t:'19:30',v:'Ahmedabad'},
        {no:5,h:'MUMBAI INDIANS',a:'CHENNAI SUPER KINGS',d:'2026-03-25',t:'19:30',v:'Mumbai'},
        {no:6,h:'RAJASTHAN ROYALS',a:'KOLKATA KNIGHT RIDERS',d:'2026-03-26',t:'19:30',v:'Jaipur'},
        {no:7,h:'LUCKNOW SUPER GIANTS',a:'SUNRISERS HYDERABAD',d:'2026-03-27',t:'19:30',v:'Lucknow'},
        {no:8,h:'ROYAL CHALLENGERS BENGALURU',a:'DELHI CAPITALS',d:'2026-03-28',t:'19:30',v:'Bengaluru'},
      ];
      var loaded=0, skipped=0;
      for (var f of schedule) {
        if (_fixtures.find(function(m){return m.match_no===f.no;})) { skipped++; continue; }
        try {
          await API.upsertMatch({
            match_no:f.no, team1:f.h, team2:f.a, venue:f.v, status:'upcoming',
            match_title:'Match '+f.no+' · '+tShort(f.h)+' vs '+tShort(f.a),
            match_date:new Date(f.d+'T'+f.t+':00+05:30').toISOString(), is_locked:false
          }); loaded++;
        } catch(e){ console.warn(e); }
      }
      UI.toast('Loaded '+loaded+' fixtures'+(skipped?' ('+skipped+' skipped)':''), 'success');
      await loadAllMatches(); populateMatchOpts(); filterFixtures();
    }
  });
}

/* ══════════════════════════════════════════════════════════════
   RESULTS PANEL
══════════════════════════════════════════════════════════════ */
async function loadResultsPanel() {
  // Match dropdown already populated; reload for freshness
  var sel = $id('res-match'); if (!sel) return;
  var cur = sel.value;
  sel.innerHTML = '<option value="">— Select match —</option>' +
    _matches.map(function(m){
      return '<option value="'+m.id+'">M'+(m.match_no||'?')+' · '+UI.esc(tShort(m.team1)+' vs '+tShort(m.team2))+'</option>';
    }).join('');
  if (cur) { sel.value = cur; loadResultForm(); }
}

async function loadResultForm() {
  var matchId = $id('res-match').value;
  var body    = $id('res-form-body');
  var preview = $id('res-preview');
  if (!matchId) { body.style.display='none'; preview.innerHTML='<div style="color:var(--text3);font-size:13px;">Select a match to preview.</div>'; return; }

  var m = _matches.find(function(x){return x.id===matchId;});
  if (!m) return;

  // Winner options
  $id('res-winner').innerHTML = '<option value="">— Select winner —</option>' +
    [m.team1,m.team2].filter(Boolean).map(function(t){
      return '<option value="'+t+'"'+(m.winner===t?' selected':'')+'>'+UI.esc(t)+'</option>';
    }).join('');

  // PoM options - filter from _players using flexible team matching
  var pomEl = $id('res-pom');
  if (pomEl) {
    var matchPlayers = _players.filter(function(p){
      var pt = p.ipl_team || '';
      return pt===m.team1 || pt===m.team2 || pt===tCode(m.team1) || pt===tCode(m.team2) || pt===tShort(m.team1) || pt===tShort(m.team2);
    });
    pomEl.innerHTML = '<option value="">— Select player —</option>' +
      matchPlayers.map(function(p){
        var pt = p.ipl_team || '';
        var ptc = pt === m.team1 ? tShort(m.team1) : pt === m.team2 ? tShort(m.team2)
          : pt === tCode(m.team1) ? tShort(m.team1) : pt === tCode(m.team2) ? tShort(m.team2)
          : tShort(pt);
        return '<option value="'+p.id+'"'+(m.player_of_match===p.id?' selected':'')+'>'+UI.esc(p.name)+' ('+UI.esc(ptc)+')</option>';
      }).join('');
  }

  if (m.actual_target) $id('res-target').value = m.actual_target;
  // Note: res-pom value is already set by the 'selected' attribute in the map above
  $id('res-dls').checked = !!m.is_dls_applied;
  body.style.display = '';

  preview.innerHTML =
    '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;">'+
      '<div style="font-family:var(--f-display);font-size:18px;font-weight:900;margin-bottom:10px;">'+UI.esc(m.team1)+' vs '+UI.esc(m.team2)+'</div>'+
      '<div style="font-size:13px;color:var(--text2);margin-bottom:6px;">'+UI.fmtDate(m.match_date)+(m.venue?' · '+UI.esc(m.venue):'')+'</div>'+
      (m.winner?'<div style="color:var(--gold);margin-bottom:4px;">🏆 Winner: <strong>'+UI.esc(m.winner)+'</strong></div>':'')+
      (m.actual_target?'<div style="color:var(--text2);">🎯 Target: <strong style="color:var(--accent);">'+m.actual_target+'</strong>'+(m.is_dls_applied?' <span class="dls-badge">DLS</span>':'')+'</div>':'')+
      '<div style="margin-top:8px;"><span class="match-status '+(m.is_locked?'status-locked':'status-open')+'" style="font-size:11px;">'+(m.is_locked?'🔒 Locked':'● Open')+'</span></div>'+
    '</div>';
}

async function saveResult() {
  var matchId = $id('res-match').value;
  var target  = parseInt($id('res-target').value||0)||null;
  var winner  = $id('res-winner').value||null;
  var pom     = $id('res-pom').value||null;
  var dls     = $id('res-dls').checked;
  $id('res-error').textContent='';
  if (!matchId) { $id('res-error').textContent='Select a match first.'; return; }
  if (!winner)  { $id('res-error').textContent='Select the winner.'; return; }

  UI.showConfirm({
    icon:'🏆', title:'Save Match Result?',
    msg:'Winner: '+winner+(target?'\nTarget: '+target:''),
    consequence:'This will lock the match and enable point calculation.',
    okLabel:'Save Result', okClass:'btn-accent',
    onOk: async function() {
      try {
        var upd = { winner, actual_target:target, is_locked:true, status:'completed', is_dls_applied:dls };
        if (pom) upd.player_of_match = pom;
        var {error} = await sb.from('matches').update(upd).eq('id',matchId);
        if (error) throw error;
        await API._log('match_edit','match',matchId,null,upd);
        UI.toast('Result saved!','success');
        await loadAllMatches(); populateMatchOpts();
        loadResultForm();
      } catch(e) { $id('res-error').textContent=e.message; UI.toast(e.message,'error'); }
    }
  });
}

/* ══════════════════════════════════════════════════════════════
   MATCH CONTROLS
══════════════════════════════════════════════════════════════ */
async function loadMatchCtrlPanel() {
  var sel = $id('ctrl-match'); if (!sel) return;
  var cur = sel.value;
  sel.innerHTML = '<option value="">— Pick a match —</option>' +
    _matches.map(function(m){
      return '<option value="'+m.id+'">M'+(m.match_no||'?')+' · '+tShort(m.team1)+' vs '+tShort(m.team2)+' · '+UI.shortDate(m.match_date)+'</option>';
    }).join('');
  if (cur) { sel.value = cur; loadCtrlMatch(); }
}

async function loadCtrlMatch() {
  _ctrlMatchId = $id('ctrl-match').value;
  var cards = $id('ctrl-cards');
  if (!_ctrlMatchId) { cards.style.display='none'; $id('ctrl-match-info').innerHTML=''; return; }
  var m = _matches.find(function(x){return x.id===_ctrlMatchId;});
  if (!m) return;
  cards.style.display='';
  var sCls = m.status==='abandoned'?'status-upcoming':m.is_locked?'status-locked':'status-open';
  $id('ctrl-match-info').innerHTML =
    '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px;background:var(--bg2);border-radius:10px;border:1px solid var(--border);">'+
      '<span style="font-family:var(--f-display);font-weight:900;font-size:17px;">'+UI.esc(m.team1)+' vs '+UI.esc(m.team2)+'</span>'+
      '<span class="match-status '+sCls+'">'+UI.esc(m.status||'unknown')+'</span>'+
      (m.is_dls_applied?'<span class="dls-badge">🌧 DLS</span>':'')+
      '<span style="font-size:12px;color:var(--text2);margin-left:auto;">'+UI.fmtDate(m.match_date)+(m.venue?' · '+m.venue:'')+'</span>'+
    '</div>';
  if (m.deadline_time) {
    var d = new Date(m.deadline_time);
    var off = d.getTimezoneOffset()*60000;
    $id('ctrl-deadline').value = new Date(d-off).toISOString().slice(0,16);
  }
}

async function ctrlExtend() {
  if (!_ctrlMatchId) { UI.toast('Select a match first','warn'); return; }
  var val = $id('ctrl-deadline').value;
  if (!val) { UI.toast('Enter a new deadline','warn'); return; }
  var iso = new Date(val+':00+05:30').toISOString();
  UI.showConfirm({ icon:'⏰', title:'Extend Deadline?', msg:'New deadline: '+new Date(iso).toLocaleString('en-IN'),
    consequence:'Lock time auto-set to deadline + 5 min.', okLabel:'Extend', okClass:'btn-accent',
    onOk: async function(){
      try { await API.extendDeadline(_ctrlMatchId, iso); ctrlMsg('✓ Deadline extended.','ok'); UI.toast('Done!','success'); await loadAllMatches(); populateMatchOpts(); loadCtrlMatch(); }
      catch(e){ ctrlMsg('Error: '+e.message,'err'); UI.toast(e.message,'error'); }
    }
  });
}

async function ctrlReopen() {
  if (!_ctrlMatchId) { UI.toast('Select a match first','warn'); return; }
  var val = $id('ctrl-deadline').value;
  var iso = val ? new Date(val+':00+05:30').toISOString() : null;
  UI.showConfirm({ icon:'🔓', title:'Reopen Predictions?', msg:iso?'New deadline: '+new Date(iso).toLocaleString('en-IN'):'Opens for 30 minutes.',
    consequence:'Users can submit or update predictions.', okLabel:'Reopen', okClass:'btn-accent',
    onOk: async function(){
      try { await API.reopenPredictions(_ctrlMatchId, iso); ctrlMsg('✓ Predictions reopened.','ok'); UI.toast('Reopened!','success'); await loadAllMatches(); populateMatchOpts(); loadCtrlMatch(); }
      catch(e){ ctrlMsg('Error: '+e.message,'err'); UI.toast(e.message,'error'); }
    }
  });
}

async function ctrlDLS() {
  if (!_ctrlMatchId) { UI.toast('Select a match first','warn'); return; }
  var t = parseInt($id('ctrl-dls').value||0);
  if (!t||t<50||t>500) { UI.toast('Enter valid revised target (50–500)','warn'); return; }
  UI.showConfirm({ icon:'🌧', title:'Set DLS Target?', msg:'Revised target: '+t+' runs',
    consequence:'All prediction scoring will use this target.', okLabel:'Set DLS', okClass:'btn-gold',
    onOk: async function(){
      try { await API.setDLSTarget(_ctrlMatchId, t); ctrlMsg('✓ DLS target set to '+t+'.','ok'); UI.toast('DLS set!','success'); await loadAllMatches(); loadCtrlMatch(); }
      catch(e){ ctrlMsg('Error: '+e.message,'err'); UI.toast(e.message,'error'); }
    }
  });
}

async function ctrlLock() {
  if (!_ctrlMatchId) { UI.toast('Select a match first','warn'); return; }
  UI.showConfirm({ icon:'🔒', title:'Lock Predictions Now?', msg:'Immediately close predictions for this match.',
    consequence:'No further submissions or edits allowed.', okLabel:'Lock Now', okClass:'btn-danger',
    onOk: async function(){
      try { await API.lockMatch(_ctrlMatchId); ctrlMsg('✓ Match locked.','ok'); UI.toast('Match locked!','warn'); await loadAllMatches(); loadCtrlMatch(); }
      catch(e){ ctrlMsg('Error: '+e.message,'err'); UI.toast(e.message,'error'); }
    }
  });
}

async function ctrlAbandon() {
  if (!_ctrlMatchId) { UI.toast('Select a match first','warn'); return; }
  var m = _matches.find(function(x){return x.id===_ctrlMatchId;});
  UI.showConfirm({ icon:'☔', title:'Abandon Match?', msg:m?tShort(m.team1)+' vs '+tShort(m.team2):'Selected match',
    consequence:'No points awarded. Impact uses refunded automatically.', okLabel:'Mark Abandoned', okClass:'btn-danger',
    onOk: async function(){
      try { await API.markMatchAbandoned(_ctrlMatchId); ctrlMsg('✓ Match abandoned. Impact uses refunded.','ok'); UI.toast('Abandoned.','warn'); await loadAllMatches(); loadCtrlMatch(); }
      catch(e){ ctrlMsg('Error: '+e.message,'err'); UI.toast(e.message,'error'); }
    }
  });
}

async function ctrlMarkLive() {
  if (!_ctrlMatchId) { UI.toast('Select a match first','warn'); return; }
  try {
    var {error} = await sb.from('matches').update({status:'live'}).eq('id',_ctrlMatchId);
    if (error) throw error;
    ctrlMsg('✓ Match marked as Live.','ok'); UI.toast('Live!','success');
    await loadAllMatches(); loadCtrlMatch();
  } catch(e){ ctrlMsg('Error: '+e.message,'err'); }
}

/* ══════════════════════════════════════════════════════════════
   PLAYER STATS
══════════════════════════════════════════════════════════════ */
async function onStatsMatchChange() {
  _statsMatchId = $id('stats-match').value;
  _statsPlayerId = null;
  $id('stats-form-card').style.display='none';
  $id('stats-saved-card').style.display='none';
  var sel = $id('stats-player-select');
  if (sel) sel.value='';
  $id('stats-player-id').value='';
  var chip = $id('stats-player-chip');
  if (chip) chip.style.display='none';
  if (!_statsMatchId) return;

  var m = _matches.find(function(x){return x.id===_statsMatchId;});
  if (!m) return;

  // Populate team filter for this match
  var tf = $id('stats-team-filter');
  tf.innerHTML = '<option value="">Both Teams</option>' +
    [m.team1,m.team2].filter(Boolean).map(function(t){
      return '<option value="'+t+'">'+UI.esc(t)+'</option>';
    }).join('');

  // Filter players to match teams
  _statPlayers = _players.filter(function(p){
    var pt = p.ipl_team || '';
    if (!m.team1 && !m.team2) return true;
    return pt===m.team1 || pt===m.team2 || pt===tCode(m.team1) || pt===tCode(m.team2) || pt===tShort(m.team1) || pt===tShort(m.team2);
  });
  
  // Populate the native select dropdown
  populateStatsPlayerSelect();

  $id('stats-saved-label').textContent = tShort(m.team1)+' vs '+tShort(m.team2);
  await loadSavedStats();
}

function filterStatPlayers() {
  var team = $id('stats-team-filter').value;
  var m = _matches.find(function(x){return x.id===_statsMatchId;});
  _statPlayers = _players.filter(function(p){
    var pt = p.ipl_team || '';
    if (!team) return m ? (pt===m.team1 || pt===m.team2 || pt===tCode(m.team1) || pt===tCode(m.team2) || pt===tShort(m.team1) || pt===tShort(m.team2)) : true;
    return pt===team || pt===tCode(team) || pt===tShort(team);
  });
  populateStatsPlayerSelect();
}

function populateStatsPlayerSelect() {
  var sel = $id('stats-player-select');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Select player to enter stats —</option>' + 
    _statPlayers.map(function(p){
      return '<option value="'+p.id+'">'+UI.esc(p.name)+' ('+UI.esc(p.ipl_team||'')+')</option>';
    }).join('');
}

async function onStatPlayerSelectChange() {
  var id = $id('stats-player-select').value;
  if (!id) {
    clearStatsFields(false);
    $id('stats-form-card').style.display='none';
    var chip = $id('stats-player-chip');
    if (chip) chip.style.display='none';
    return;
  }
  var p = _statPlayers.find(function(x){return x.id===id;});
  if (p) selectStatPlayer(id, p.name, p.role, p.ipl_team);
}

function closePlayerSearch() {
  // deprecated, kept for safety
}

async function selectStatPlayer(id, name, role, team) {
  _statsPlayerId = id;
  $id('stats-player-id').value = id;

  var chip = $id('stats-player-chip');
  if (chip) {
    chip.innerHTML = '<div style="display:inline-flex;align-items:center;gap:8px;background:var(--bg3);border:1px solid var(--border);border-radius:20px;padding:4px 12px;font-size:13px;">'+
      UI.roleBadge(role)+' <strong>'+UI.esc(name)+'</strong> <span style="color:var(--text2);">'+UI.esc(team)+'</span></div>';
    chip.style.display='';
  }

  // Load existing stats if any
  if (_statsMatchId) {
    try {
      var {data} = await sb.from('player_match_stats').select('*').eq('match_id',_statsMatchId).eq('player_id',id).maybeSingle();
      if (data) prefillStats(data); else clearStatsFields(false);
    } catch(e) { clearStatsFields(false); }
  }
  $id('sf-player-name').textContent = name;
  $id('sf-player-sub').textContent  = role + ' · ' + team;
  $id('stats-form-card').style.display = '';
  recalcLive();
}

function prefillStats(s) {
  const setVal = function(id, val, isZeroBlank) { 
    if (isZeroBlank && val === 0) { $id(id).value = ''; return; }
    $id(id).value = (val !== null && val !== undefined) ? val : ''; 
  };
  
  const isDnb = (s.runs === 0 && s.balls_faced === 0 && s.fours === 0 && s.sixes === 0);
  setVal('s-runs', s.runs, isDnb); 
  setVal('s-balls', s.balls_faced, isDnb);
  setVal('s-fours', s.fours, isDnb); 
  setVal('s-sixes', s.sixes, isDnb);
  
  $id('s-notout').value = s.not_out ? 'true' : '';
  
  const isDnbowl = (s.wickets === 0 && s.overs_bowled === 0 && s.runs_conceded === 0 && s.maidens === 0);
  setVal('s-wickets', s.wickets, isDnbowl); 
  setVal('s-overs', s.overs_bowled, isDnbowl);
  setVal('s-runsc', s.runs_conceded, isDnbowl); 
  setVal('s-maidens', s.maidens, isDnbowl);
  
  const isDnf = (s.catches === 0 && s.run_outs === 0 && s.stumpings === 0);
  setVal('s-catches', s.catches, isDnf); 
  setVal('s-runouts', s.run_outs, isDnf);
  setVal('s-stumpings', s.stumpings, isDnf);
  
  recalcLive();
}

function clearStatsFields(hide) {
  ['s-runs','s-balls','s-fours','s-sixes','s-wickets','s-overs','s-runsc','s-maidens','s-catches','s-runouts','s-stumpings'].forEach(function(id){var e=$id(id);if(e)e.value='';});
  $id('s-notout').value='';
  if (hide !== false) { $id('stats-form-card').style.display='none'; _statsPlayerId=null; }
  recalcLive();
}

function clearStatsForm() { clearStatsFields(true); $id('stats-player-input').value=''; $id('stats-player-chip').style.display='none'; }

function getStatsObj() {
  const getNum = function(id) { var v = $id(id).value; return v === '' ? null : parseInt(v, 10); };
  const getFlt = function(id) { var v = $id(id).value; return v === '' ? null : parseFloat(v); };
  return {
    runs: getNum('s-runs'),
    balls_faced: getNum('s-balls'),
    fours: getNum('s-fours'),
    sixes: getNum('s-sixes'),
    not_out: $id('s-notout').value === 'true',
    wickets: getNum('s-wickets'),
    overs_bowled: getFlt('s-overs'),
    runs_conceded: getNum('s-runsc'),
    maidens: getNum('s-maidens'),
    catches: getNum('s-catches'),
    run_outs: getNum('s-runouts'),
    stumpings: getNum('s-stumpings'),
  };
}

function recalcLive() {
  var s   = getStatsObj();
  var pts = (API.calcBattingPoints(s)||0) + (API.calcBowlingPoints(s)||0) + (API.calcFieldingPoints(s)||0);
  var ring = $id('pts-ring'); if (!ring) return;
  ring.textContent = Math.round(pts);
  ring.style.borderColor = pts>150?'var(--gold)':pts>75?'var(--accent)':'var(--border)';
  ring.style.color       = pts>150?'var(--gold)':pts>75?'var(--accent)':'var(--text2)';
  ring.style.background  = pts>150?'rgba(245,200,66,.12)':pts>75?'var(--accent-dim)':'var(--bg3)';
}

async function saveStats() {
  if (!_statsMatchId)  { UI.toast('Select a match first','warn'); return; }
  if (!_statsPlayerId) { UI.toast('Select a player first','warn'); return; }
  var s = getStatsObj();
  s.match_id = _statsMatchId; s.player_id = _statsPlayerId;
  var est = Math.round((API.calcBattingPoints(s)||0)+(API.calcBowlingPoints(s)||0)+(API.calcFieldingPoints(s)||0));
  UI.showConfirm({ icon:'📊', title:'Save Player Stats?', msg:'Est. points: '+est,
    consequence:'Overwrites any existing stats for this player+match.', okLabel:'Save', okClass:'btn-accent',
    onOk: async function(){
      try { await API.upsertPlayerStats(s); UI.toast('Stats saved!','success'); await loadSavedStats(); }
      catch(e){ UI.toast('Save failed: '+e.message,'error'); }
    }
  });
}

async function loadSavedStats() {
  if (!_statsMatchId) return;
  var card=$id('stats-saved-card'), list=$id('stats-saved-list');
  card.style.display=''; list.innerHTML='<div class="skel skel-row"></div>';
  try {
    var stats = safeArr(await API.fetchPlayerStats(_statsMatchId));
    if (!stats.length) { list.innerHTML='<div style="color:var(--text3);font-size:13px;padding:12px;">No stats entered yet.</div>'; return; }
    list.innerHTML = stats.map(function(s){
      var p=s.player||{};
      var bat=Math.round(API.calcBattingPoints(s)||0), bowl=Math.round(API.calcBowlingPoints(s)||0), fld=Math.round(API.calcFieldingPoints(s)||0);
      var tot=bat+bowl+fld; var col=tColor(p.ipl_team||'');
      return '<div class="stat-saved-card">'+
        '<div class="stat-bar" style="background:'+col+'"></div>'+
        '<div style="flex:1;min-width:0;">'+
          '<div style="font-family:var(--f-ui);font-weight:700;font-size:14px;">'+UI.esc(p.name||'—')+'</div>'+
          '<div style="font-size:11px;color:var(--text2);">'+UI.esc(p.ipl_team||'')+'</div>'+
          '<div class="stat-breakdown">R:'+s.runs+' B:'+s.balls_faced+' W:'+s.wickets+' C:'+s.catches+' | Bat:'+bat+' Bowl:'+bowl+' Fld:'+fld+'</div>'+
        '</div>'+
        '<div class="stat-pts">'+tot+'</div>'+
        '<button class="btn btn-ghost btn-sm" style="padding:3px 8px;font-size:11px;" onclick="editSavedStat(\''+p.id+'\',\''+UI.esc(p.name||'')+'\')">Edit</button>'+
      '</div>';
    }).join('');
  } catch(e) { list.innerHTML='<div style="color:var(--red);font-size:13px;padding:12px;">'+UI.esc(e.message)+'</div>'; }
}

async function editSavedStat(playerId, playerName) {
  try {
    var {data} = await sb.from('player_match_stats').select('*,player:players(id,name,role,ipl_team)').eq('match_id',_statsMatchId).eq('player_id',playerId).maybeSingle();
    if (!data) return;
    _statsPlayerId = playerId;
    $id('stats-player-id').value = playerId;
    var sel = $id('stats-player-select');
    if (sel) sel.value = playerId;
    $id('sf-player-name').textContent = playerName;
    var p = data.player||{};
    $id('sf-player-sub').textContent = (p.role||'')+(p.ipl_team?' · '+p.ipl_team:'');
    $id('stats-form-card').style.display='';
    prefillStats(data);
    $id('pts-ring').scrollIntoView({behavior:'smooth',block:'nearest'});
  } catch(e){ UI.toast(e.message,'error'); }
}

/* ══════════════════════════════════════════════════════════════
   CSV UPLOAD
══════════════════════════════════════════════════════════════ */
function openCSVModal()  { $id('csv-modal').style.display='flex'; }
function closeCSVModal() { $id('csv-modal').style.display='none'; $id('csv-preview').style.display='none'; }
function onCSVDrop(e)    { e.preventDefault(); e.currentTarget.classList.remove('drag-over'); var f=e.dataTransfer.files[0]; if(f) processCSV(f); }
function onCSVFile(e)    { var f=e.target.files[0]; if(f) processCSV(f); }

async function processCSV(file) {
  if (!_statsMatchId) { UI.toast('Select a match in Stats panel first','warn'); closeCSVModal(); return; }
  var text = await file.text();
  var preview = $id('csv-preview');
  try {
    var rows = API.parseStatsCsv(text, _statsMatchId);
    var resolved=[], errors=[];
    rows.forEach(function(r,i) {
      if (!r.player_id && r.player_name) {
        var n=(r.player_name||'').trim().toLowerCase();
        var p=_players.find(function(x){return x.name.toLowerCase()===n;})
           || _players.find(function(x){return x.name.toLowerCase().includes(n);});
        if (p) r.player_id=p.id; else errors.push('Row '+(i+2)+': "'+r.player_name+'" not found');
      }
      delete r.player_name;
      if (r.player_id) resolved.push(r);
    });
    preview.style.display='';
    var safeJson = JSON.stringify(resolved).replace(/</g,'\\u003c').replace(/'/g,'\\u0027');
    preview.innerHTML =
      (errors.length?'<div style="background:var(--red-dim);border:1px solid rgba(255,77,109,.25);border-radius:6px;padding:8px 12px;font-size:12px;color:var(--red);margin-bottom:10px;">⚠ '+UI.esc(errors.join(', '))+'</div>':'')+
      '<div style="font-size:13px;color:var(--text2);margin-bottom:8px;"><strong>'+resolved.length+'</strong> rows ready.</div>'+
      (resolved.length?'<button class="btn btn-accent btn-sm" onclick=\'uploadCSV('+safeJson+')\'>Upload '+resolved.length+' rows</button>':'');
  } catch(e){ UI.toast('CSV error: '+e.message,'error'); }
}

async function uploadCSV(rows) {
  try { await API.bulkUpsertPlayerStats(rows); UI.toast('Uploaded '+rows.length+' rows!','success'); closeCSVModal(); await loadSavedStats(); }
  catch(e){ UI.toast('Upload failed: '+e.message,'error'); }
}

/* ══════════════════════════════════════════════════════════════
   CALCULATE POINTS
══════════════════════════════════════════════════════════════ */
async function loadCalcInfo() {
  var matchId=$id('calc-match').value, el=$id('calc-match-info');
  if (!matchId) { el.innerHTML=''; return; }
  var m=_matches.find(function(x){return x.id===matchId;});
  if (!m) return;
  el.innerHTML=
    '<div style="background:var(--bg3);padding:12px 14px;border-radius:8px;font-size:13px;">'+
      '<span style="font-family:var(--f-display);font-weight:900;font-size:16px;">'+UI.esc(m.team1)+' vs '+UI.esc(m.team2)+'</span>'+
      '<div style="color:var(--text2);margin-top:5px;">Winner: <strong style="color:var(--gold);">'+(m.winner||'⚠ Not set')+'</strong> · Target: <strong>'+(m.actual_target||'⚠ Not set')+'</strong>'+
        (m.is_dls_applied?' · <span class="dls-badge">DLS</span>':'')+
        (m.status==='abandoned'?' · <span class="badge badge-red">Abandoned</span>':'')+
      '</div>'+
    '</div>';
}

async function doCalculate() {
  var matchId=$id('calc-match').value;
  if (!matchId) { UI.toast('Select a match','warn'); return; }
  var m=_matches.find(function(x){return x.id===matchId;});
  UI.showConfirm({ icon:'⚡', title:'Calculate & Lock?', msg:'Calculate points for '+(m?tShort(m.team1)+' vs '+tShort(m.team2):'this match'),
    consequence:'Will score all teams and lock the match permanently.', okLabel:'Calculate', okClass:'btn-gold',
    onOk: async function(){
      var btn=$id('calc-btn'); if(btn._busy)return; btn._busy=true; btn.disabled=true;
      btn.innerHTML='<span class="btn-spin"></span> Calculating…';
      $id('calc-log').innerHTML='';
      cLog('Starting calculation for '+tShort(m?m.team1:'')+' vs '+tShort(m?m.team2:'')+'…');
      try {
        var results = await API.calculateMatchPoints(matchId, cLog);
        cLog('✓ Computed '+results.length+' teams · Leaderboard updated · Match locked','ok');
        UI.toast('Points calculated!','success');
        await loadAllMatches(); populateMatchOpts(); loadCalcInfo();
      } catch(e){ cLog('ERROR: '+e.message,'err'); UI.toast('Calculation failed: '+e.message,'error'); }
      btn._busy=false; btn.disabled=false; btn.innerHTML='⚡ Calculate & Lock';
    }
  });
}

async function doRecalculate() {
  var matchId=$id('calc-match').value;
  if (!matchId) { UI.toast('Select a match','warn'); return; }
  var m=_matches.find(function(x){return x.id===matchId;});
  UI.showConfirm({ icon:'↻', title:'Recalculate (Delete & Redo)?', msg:'Delete existing points and recompute for '+(m?tShort(m.team1)+' vs '+tShort(m.team2):'this match'),
    consequence:'All previous points_log entries for this match will be permanently deleted.', okLabel:'Recalculate', okClass:'btn-danger',
    onOk: async function(){
      var btn=$id('recalc-btn'); if(btn._busy)return; btn._busy=true; btn.disabled=true;
      btn.innerHTML='<span class="btn-spin"></span> Recalculating…';
      $id('calc-log').innerHTML='';
      cLog('Deleting existing points log…','warn');
      try {
        var results = await API.recalculateMatch(matchId, cLog);
        cLog('✓ Done — '+results.length+' teams recalculated','ok');
        UI.toast('Recalculation complete!','success');
        await loadAllMatches(); loadCalcInfo();
      } catch(e){ cLog('ERROR: '+e.message,'err'); UI.toast(e.message,'error'); }
      btn._busy=false; btn.disabled=false; btn.innerHTML='↻ Recalculate (Delete & Redo)';
    }
  });
}

/* ══════════════════════════════════════════════════════════════
   POINT OVERRIDES
══════════════════════════════════════════════════════════════ */
async function submitOverride() {
  var matchId=$id('ovr-match').value||null;
  var teamId=$id('ovr-team').value;
  var pts=parseInt($id('ovr-pts').value||0);
  var reason=$id('ovr-reason').value.trim();
  var errEl=$id('ovr-error'); errEl.textContent='';
  if (!teamId) { errEl.textContent='Select a team.'; return; }
  if (!pts)    { errEl.textContent='Enter a non-zero adjustment.'; return; }
  if (!reason) { errEl.textContent='Reason is required.'; return; }

  var teamName = (_teams.find(function(r){return r.fantasy_team_id===teamId;})||{team:{team_name:'?'}}).team.team_name;
  UI.showConfirm({ icon:'⚖️', title:'Apply Adjustment?', msg:'Team: '+teamName+'\nPoints: '+(pts>0?'+':'')+pts,
    consequence:'Reason: '+reason, okLabel:'Apply', okClass:'btn-gold',
    onOk: async function(){
      try {
        await API.applyAdjustment({teamId, matchId, points:pts, remarks:reason});
        UI.toast('Adjustment applied!','success');
        $id('ovr-pts').value=''; $id('ovr-reason').value='';
        await loadAdjustments();
      } catch(e){ errEl.textContent=e.message; UI.toast(e.message,'error'); }
    }
  });
}

async function loadAdjustments() {
  var el=$id('adj-history'); if(!el) return;
  el.innerHTML='<div class="skel skel-row"></div>';
  try {
    var adjs = safeArr(await API.fetchAllAdjustments());
    if (!adjs.length) { el.innerHTML='<div style="color:var(--text3);font-size:13px;padding:12px;">No adjustments yet.</div>'; return; }
    el.innerHTML = adjs.map(function(a){
      var isPos=a.points>0;
      return '<div class="adj-row">'+
        '<span class="adj-badge '+(isPos?'pos':'neg')+'">'+(isPos?'+':'')+a.points+'</span>'+
        '<div style="flex:1;min-width:0;">'+
          '<div style="font-family:var(--f-ui);font-weight:700;font-size:13px;">'+UI.championName(a.team?a.team.team_name:'—')+'</div>'+
          '<div style="font-size:11px;color:var(--text2);">'+UI.esc(a.remarks)+'</div>'+
          (a.match?'<div style="font-size:10px;color:var(--text3);">'+UI.esc(a.match.match_title||'—')+'</div>':'')+
        '</div>'+
        '<div style="font-size:11px;color:var(--text3);flex-shrink:0;">'+UI.shortDate(a.created_at)+'</div>'+
        '<button class="btn btn-danger btn-sm" style="padding:2px 8px;font-size:11px;" title="Undo" onclick="undoAdj(\''+a.id+'\')">↩</button>'+
      '</div>';
    }).join('');
  } catch(e){ el.innerHTML='<div style="color:var(--red);font-size:13px;padding:12px;">'+UI.esc(e.message)+'</div>'; }
}

async function undoAdj(adjId) {
  UI.showConfirm({ icon:'↩', title:'Undo Adjustment?', msg:'Permanently removes this adjustment and refreshes leaderboard.',
    consequence:'Cannot be re-applied automatically.', okLabel:'Undo', okClass:'btn-danger',
    onOk: async function(){
      try { await API.undoAdjustment(adjId); UI.toast('Adjustment removed','warn'); await loadAdjustments(); }
      catch(e){ UI.toast(e.message,'error'); }
    }
  });
}

/* ══════════════════════════════════════════════════════════════
   INJURIES & REPLACEMENTS
══════════════════════════════════════════════════════════════ */
async function loadInjuries() {
  var el=$id('injuries-list'); if(!el) return;
  var filter=$id('rep-filter')?$id('rep-filter').value:'all';
  var teamFilter=$id('rep-team-filter')?$id('rep-team-filter').value:'';
  el.innerHTML='<div class="skel skel-row"></div>';
  try {
    var [repsRes, matchesRes] = await Promise.all([
      sb.from('replacements')
        .select('*,original:players!replacements_original_player_id_fkey(id,name,role,ipl_team,availability_status,availability_note),replacement:players!replacements_replacement_player_id_fkey(id,name,role,ipl_team),team:fantasy_teams(team_name)')
        .order('created_at',{ascending:false}),
      sb.from('matches').select('id,match_no,team1,team2')
    ]);
    if (repsRes.error) throw repsRes.error;
    var data = repsRes.data || [];
    var matchesMap = {};
    (matchesRes.data||[]).forEach(function(m){matchesMap[m.id]=m;});
    if(teamFilter){
      data=data.filter(function(r){return r.fantasy_team_id===teamFilter;});
    }
    if (!data||!data.length) { el.innerHTML='<div style="color:var(--text3);font-size:13px;padding:12px 0;">No replacement requests.</div>'; return; }

    var pending=data.filter(function(r){return r.status==='pending';});
    var active=data.filter(function(r){return r.status==='approved'&&r.is_active;});
    var rejected=data.filter(function(r){return r.status==='rejected';});

    var html='';
    if(filter==='all'||filter==='pending'){
      if(pending.length){
        html+='<div style="margin-bottom:24px;"><div style="font-size:12px;font-weight:700;color:var(--gold);margin-bottom:8px;">⏳ PENDING REQUESTS ('+pending.length+')</div>';
        html+=pending.map(function(r){
          var startMatch=r.start_match_id&&matchesMap[r.start_match_id]?'<span style="color:var(--accent);">M'+(matchesMap[r.start_match_id].match_no||'?')+' · '+UI.esc(UI.tShort(matchesMap[r.start_match_id].team1))+' vs '+UI.esc(UI.tShort(matchesMap[r.start_match_id].team2))+'</span>':'<span style="color:var(--text3);">Next available match</span>';
          return '<div class="inj-card" style="border-left:3px solid var(--gold);padding:12px;margin-bottom:12px;">'+
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">'+
              '<div style="flex:1;min-width:250px;">'+
                '<div style="font-size:11px;color:var(--gold);font-weight:700;margin-bottom:6px;">'+UI.championName(r.team?r.team.team_name:'—')+'</div>'+
                '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px;">'+
                  '<div style="background:rgba(248,113,113,.15);border:1px solid rgba(248,113,113,.3);border-radius:6px;padding:6px 10px;">'+
                    '<div style="font-weight:700;font-size:13px;">'+UI.esc(r.original?r.original.name:'—')+'</div>'+
                    '<div style="font-size:10px;color:var(--red);">'+(r.original?r.original.role:'')+' · '+UI.esc(r.original?r.original.ipl_team:'')+'</div>'+
                  '</div>'+
                  '<svg viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" stroke-width="2" style="width:20px;height:20px;flex-shrink:0;"><path d="M5 12h14M12 5l7 7-7 7"/></svg>'+
                  '<div style="background:rgba(56,217,245,.15);border:1px solid rgba(56,217,245,.3);border-radius:6px;padding:6px 10px;">'+
                    '<div style="font-weight:700;font-size:13px;color:var(--cyan);">'+UI.esc(r.replacement?r.replacement.name:'—')+'</div>'+
                    '<div style="font-size:10px;color:var(--cyan);">'+(r.replacement?r.replacement.role:'')+' · '+UI.esc(r.replacement?r.replacement.ipl_team:'')+'</div>'+
                  '</div>'+
                '</div>'+
                '<div style="font-size:11px;color:var(--text2);margin-bottom:4px;">📅 Start from: '+startMatch+'</div>'+
              '</div>'+
              '<div style="display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap;">'+
                '<button class="btn btn-sm" style="background:var(--green);color:#000;font-weight:700;font-size:11px;padding:8px 16px;" onclick="approveRep(\''+r.id+'\')">✓ Approve</button>'+
                '<button class="btn btn-sm" style="background:var(--red);color:#fff;font-weight:700;font-size:11px;padding:8px 16px;" onclick="rejectRep(\''+r.id+'\')">✕ Reject</button>'+
                '<button class="btn btn-ghost btn-sm" style="font-size:10px;padding:4px 8px;color:var(--red);" onclick="deleteRepAdmin(\''+r.id+'\')" title="Delete permanently">🗑️</button>'+
              '</div>'+
            '</div>'+
          '</div>';
        }).join('');
        html+='</div>';
      }
    }
    if(filter==='all'||filter==='approved'){
      if(active.length){
        html+='<div style="margin-bottom:24px;"><div style="font-size:12px;font-weight:700;color:var(--accent);margin-bottom:8px;">✓ ACTIVE REPLACEMENTS ('+active.length+')</div>';
        html+=active.map(function(r){
          var startMatch=r.start_match_id&&matchesMap[r.start_match_id]?'M'+(matchesMap[r.start_match_id].match_no||'?'):'N/A';
          return '<div class="inj-card replaced" style="padding:12px;margin-bottom:12px;">'+
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">'+
              '<div style="flex:1;min-width:250px;">'+
                '<div style="font-size:11px;color:var(--accent);font-weight:700;margin-bottom:6px;">'+UI.championName(r.team?r.team.team_name:'—')+'</div>'+
                '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">'+
                  '<div style="background:rgba(248,113,113,.15);border:1px solid rgba(248,113,113,.3);border-radius:6px;padding:6px 10px;">'+
                    '<div style="font-weight:700;font-size:13px;">'+UI.esc(r.original?r.original.name:'—')+'</div>'+
                    '<div style="font-size:10px;color:var(--red);">'+(r.original?r.original.role:'')+' · '+UI.esc(r.original?r.original.ipl_team:'')+'</div>'+
                  '</div>'+
                  '<svg viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" stroke-width="2" style="width:20px;height:20px;flex-shrink:0;"><path d="M5 12h14M12 5l7 7-7 7"/></svg>'+
                  '<div style="background:rgba(56,217,245,.15);border:1px solid rgba(56,217,245,.3);border-radius:6px;padding:6px 10px;">'+
                    '<div style="font-weight:700;font-size:13px;color:var(--cyan);">'+UI.esc(r.replacement?r.replacement.name:'—')+'</div>'+
                    '<div style="font-size:10px;color:var(--cyan);">'+(r.replacement?r.replacement.role:'')+' · '+UI.esc(r.replacement?r.replacement.ipl_team:'')+'</div>'+
                  '</div>'+
                '</div>'+
                '<div style="font-size:11px;color:var(--text2);margin-top:4px;">📅 Started: '+startMatch+'</div>'+
              '</div>'+
              '<div style="display:flex;gap:6px;flex-wrap:wrap;">'+
                '<button class="btn btn-ghost btn-sm" style="font-size:10px;padding:4px 8px;" onclick="undoRep(\''+r.id+'\')" title="Undo approval">↩️ Undo</button>'+
                '<button class="btn btn-ghost btn-sm" style="font-size:10px;padding:4px 8px;color:var(--red);" onclick="deleteRepAdmin(\''+r.id+'\')" title="Delete permanently">🗑️</button>'+
              '</div>'+
            '</div>'+
          '</div>';
        }).join('');
        html+='</div>';
      }
    }
    if(filter==='all'||filter==='rejected'){
      if(rejected.length){
        html+='<div><div style="font-size:12px;font-weight:700;color:var(--red);margin-bottom:8px;">✕ REJECTED ('+rejected.length+')</div>';
        html+=rejected.map(function(r){
          return '<div class="inj-card" style="border-left:3px solid var(--red);opacity:0.7;padding:12px;margin-bottom:12px;">'+
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">'+
              '<div style="flex:1;min-width:200px;">'+
                '<div style="font-size:11px;color:var(--text2);margin-bottom:4px;">'+UI.championName(r.team?r.team.team_name:'—')+'</div>'+
                '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">'+
                  '<span style="font-weight:700;">'+UI.esc(r.original?r.original.name:'—')+'</span>'+
                  '<svg viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="2" style="width:16px;height:16px;"><path d="M5 12h14M12 5l7 7-7 7"/></svg>'+
                  '<span style="font-weight:700;color:var(--text3);">'+UI.esc(r.replacement?r.replacement.name:'—')+'</span>'+
                '</div>'+
                (r.admin_notes?'<div style="font-size:10px;color:var(--red);margin-top:4px;">Reason: '+UI.esc(r.admin_notes)+'</div>':'')+
              '</div>'+
              '<div style="display:flex;gap:6px;flex-wrap:wrap;">'+
                '<button class="btn btn-ghost btn-sm" style="font-size:10px;padding:4px 8px;" onclick="undoRep(\''+r.id+'\')" title="Restore to pending">↩️ Undo</button>'+
                '<button class="btn btn-ghost btn-sm" style="font-size:10px;padding:4px 8px;color:var(--red);" onclick="deleteRepAdmin(\''+r.id+'\')" title="Delete permanently">🗑️</button>'+
              '</div>'+
            '</div>'+
          '</div>';
        }).join('');
        html+='</div>';
      }
    }
    if(!html) html='<div style="color:var(--text3);font-size:13px;padding:12px 0;">No requests in this filter.</div>';
    el.innerHTML=html;
  } catch(e){ el.innerHTML='<div style="color:var(--red);font-size:13px;">'+UI.esc(e.message)+'</div>'; }
}

async function approveRep(repId) {
  var notes=prompt('Add approval notes (optional):');
  try{
    await API.approveReplacement(repId,notes);
    UI.toast('Replacement approved','success');
    loadInjuries();
  }catch(e){UI.toast(e.message,'error');}
}

async function rejectRep(repId) {
  var notes=prompt('Add rejection reason:');
  if(notes===null) return;
  try{
    await API.rejectReplacement(repId,notes||'Rejected by admin');
    UI.toast('Replacement rejected','warn');
    loadInjuries();
  }catch(e){UI.toast(e.message,'error');}
}

async function undoRep(repId) {
  try{
    await API.updateReplacement(repId,{status:'pending',is_active:false,admin_notes:null});
    UI.toast('Action undone - back to pending','success');
    loadInjuries();
  }catch(e){UI.toast(e.message,'error');}
}

async function deleteRepAdmin(repId) {
  UI.showConfirm({icon:'🗑️',title:'Delete Replacement?',msg:'This will permanently delete this replacement record.',consequence:'This cannot be undone.',okLabel:'Delete',okClass:'btn-danger',
    onOk:async function(){
      try{
        await API.deleteReplacement(repId);
        UI.toast('Replacement deleted','success');
        loadInjuries();
      }catch(e){UI.toast(e.message,'error');}
    }
  });
}

function onInjTeamChange() {
  var team = $id('inj-team-sel').value;
  var sel = $id('inj-player-sel'); if (!sel) return;
  sel.innerHTML = '<option value="">— Select player —</option>';
  $id('inj-player-id').value = ''; $id('inj-player-info').style.display = 'none';

  if (!team) return;
  var code = tCode(team), short = tShort(team);
  var players = _players.filter(function(p) {
    var pt = p.ipl_team || '';
    return pt === team || pt === code || pt === short;
  });
  sel.innerHTML += players.map(function(p) {
    var statusIcon = p.availability_status === 'injured' ? ' [🏥]' : p.availability_status === 'unavailable' ? ' [⛔]' : '';
    return '<option value="'+p.id+'">'+UI.esc(p.name)+statusIcon+'</option>';
  }).join('');
}

function onInjPlayerChange() {
  var id = $id('inj-player-sel').value;
  if (!id) {
    $id('inj-player-id').value = '';
    $id('inj-player-info').style.display = 'none';
    return;
  }
  var p = _players.find(function(x) { return x.id === id; });
  if (p) selectInjPlayer(p.id, p.name, JSON.stringify(p));
}

function selectInjPlayer(id, name, playerJson) {
  var p; try { p = JSON.parse(playerJson); } catch(e){ p={}; }
  $id('inj-player-id').value=id; $id('inj-player-input').value=name;
  closeInjSearch();
  if (p.availability_note) $id('avail-note').value=p.availability_note;
  if (p.availability_status) $id('avail-status').value=p.availability_status;
  var info=$id('inj-player-info');
  info.style.display=''; info.className='inj-card mb-8'+(p.availability_status!=='available'?' injured':'');
  var statusLabel=p.availability_status==='injured'?'🏥 Injured':p.availability_status==='unavailable'?'⛔ Unavailable':'✓ Available';
  info.innerHTML='<div style="flex:1;"><div style="font-weight:700;">'+UI.esc(name)+'</div>'+
    '<div style="font-size:11px;color:var(--text2);">'+UI.esc(p.role||'')+' · '+UI.esc(p.ipl_team||'')+'</div>'+
    (p.availability_status!=='available'?'<div style="font-size:11px;color:var(--red);margin-top:3px;">'+statusLabel+(p.availability_note?' — '+UI.esc(p.availability_note):'')+'</div>':'')+
  '</div>';
}

async function setPlayerAvailability() {
  var id=$id('inj-player-id').value, status=$id('avail-status').value, note=$id('avail-note').value.trim();
  if (!id) { UI.toast('Select a player','warn'); return; }
  try { 
    await API.setPlayerAvailability(id, status, note||null); 
    UI.toast('Availability updated','success'); 
    await loadAllPlayers(); 
    onInjTeamChange();
    $id('inj-player-id').value=''; 
    $id('inj-player-info').style.display='none'; 
    await loadInjuries(); 
  }
  catch(e){ UI.toast(e.message,'error'); }
}
async function clearAvailability() {
  var id=$id('inj-player-id').value;
  if (!id) { UI.toast('Select a player','warn'); return; }
  try { 
    await API.clearPlayerAvailability(id); 
    UI.toast('Player is now available','success'); 
    await loadAllPlayers(); 
    // Refresh the player dropdown
    onInjTeamChange();
    $id('inj-player-info').style.display='none'; 
    await loadInjuries(); 
  }
  catch(e){ UI.toast(e.message,'error'); }
}

async function loadRepTeamSquad() {
  var teamId=$id('rep-team').value;
  var injSel=$id('rep-injured'); injSel.innerHTML='<option value="">— Select injured player —</option>';
  if (!teamId) return;
  try {
    var squad = safeArr(await API.fetchSquad(teamId));
    var unavailable = squad.filter(function(sp){return sp.player&&sp.player.availability_status&&sp.player.availability_status!=='available';});
    var src = unavailable.length ? unavailable : squad;
    injSel.innerHTML = '<option value="">— Select —</option>' +
      src.map(function(sp){
        var p=sp.player||{};
        var icon = p.availability_status === 'injured' ? ' 🏥' : p.availability_status === 'unavailable' ? ' ⛔' : '';
        return '<option value="'+p.id+'">'+UI.esc(p.name||'')+icon+'</option>';
      }).join('');
  } catch(e){ UI.toast(e.message,'error'); }
}

async function loadSameRolePlayers() {
  var teamId=$id('rep-team').value, injId=$id('rep-injured').value;
  var repSel=$id('rep-player'); repSel.innerHTML='<option value="">— Select replacement —</option>';
  if (!injId) return;
  var injPlayer=_players.find(function(p){return p.id===injId;}); if (!injPlayer) return;
  var squad=teamId?safeArr(await API.fetchSquad(teamId)):[];
  var squadIds=new Set(squad.map(function(sp){return sp.player&&sp.player.id;}));
  var eligible=_players.filter(function(p){return p.role===injPlayer.role&&!squadIds.has(p.id)&&p.availability_status==='available'&&p.id!==injId;});
  repSel.innerHTML='<option value="">— Select —</option>'+
    eligible.map(function(p){return '<option value="'+p.id+'">'+UI.esc(p.name)+' · '+UI.esc(p.ipl_team||'?')+'</option>';}).join('');
}

async function setReplacement() {
  var teamId=$id('rep-team').value, origId=$id('rep-injured').value, replId=$id('rep-player').value, reason=$id('rep-note').value.trim();
  if (!teamId||!origId||!replId) { UI.toast('Fill all required fields','warn'); return; }
  try { 
    var created=await API.createReplacement({teamId,originalPlayerId:origId,replacementPlayerId:replId,reason:reason||null});
    // Auto-approve admin-set replacements
    await API.approveReplacement(created.id,'Approved by admin');
    UI.toast('Replacement set and active!','success'); 
    $id('rep-note').value=''; $id('rep-player').value=''; 
    await loadInjuries(); 
  }
  catch(e){ UI.toast(e.message,'error'); }
}

async function removeRep(repId) {
  UI.showConfirm({ icon:'↩', title:'Remove Replacement?', msg:'Original (injured) player will be used going forward.',
    consequence:'Any future calculations will revert to the original player.', okLabel:'Remove', okClass:'btn-danger',
    onOk: async function(){ try { await API.deactivateReplacement(repId); UI.toast('Replacement removed','warn'); await loadInjuries(); } catch(e){ UI.toast(e.message,'error'); } }
  });
}

/* ══════════════════════════════════════════════════════════════
   SQUAD MANAGEMENT
══════════════════════════════════════════════════════════════ */
async function loadSquadAdmin() {
  var teamId=$id('squad-team').value; if (!teamId) return;
  var team=_teams.find(function(r){return r.fantasy_team_id===teamId;});
  $id('squad-team-label').textContent=team&&team.team?team.team.team_name:'Team';
  $id('squad-admin-view').style.display='';
  try {
    var squad=safeArr(await API.fetchSquad(teamId));
    _squadEdits[teamId]={
      captainId: (squad.find(function(s){return s.is_captain;})&&squad.find(function(s){return s.is_captain;}).player&&squad.find(function(s){return s.is_captain;}).player.id)||null,
      vcId:      (squad.find(function(s){return s.is_vc;})&&squad.find(function(s){return s.is_vc;}).player&&squad.find(function(s){return s.is_vc;}).player.id)||null,
      impactId:  (squad.find(function(s){return s.is_impact;})&&squad.find(function(s){return s.is_impact;}).player&&squad.find(function(s){return s.is_impact;}).player.id)||null,
    };
    var tbody=$id('squad-admin-tbody');
    tbody.innerHTML=squad.map(function(sp){
      var p=sp.player||{};
      var statusIcon = p.availability_status === 'injured' ? '🏥 Injured' : p.availability_status === 'unavailable' ? '⛔ Unavailable' : '';
      return '<tr>'+
        '<td><div style="font-family:var(--f-ui);font-weight:700;">'+UI.esc(p.name||'—')+'</div>'+(statusIcon?'<div style="font-size:10px;color:var(--red);">'+statusIcon+(p.availability_note?' — '+UI.esc(p.availability_note):'')+'</div>':'')+'</td>'+
        '<td>'+UI.roleBadge(p.role)+'</td>'+
        '<td style="font-size:12px;color:var(--text2);">'+UI.esc(p.ipl_team||'—')+'</td>'+
        '<td><input type="radio" name="cap-'+teamId+'" value="'+p.id+'" '+(sp.is_captain?'checked':'')+' onchange="sqEdit(\''+teamId+'\',\'captain\',\''+p.id+'\')"></td>'+
        '<td><input type="radio" name="vc-'+teamId+'"  value="'+p.id+'" '+(sp.is_vc?'checked':'')+' onchange="sqEdit(\''+teamId+'\',\'vc\',\''+p.id+'\')"></td>'+
        '<td><input type="radio" name="ip-'+teamId+'"  value="'+p.id+'" '+(sp.is_impact?'checked':'')+' onchange="sqEdit(\''+teamId+'\',\'impact\',\''+p.id+'\')"></td>'+
        '<td style="font-size:13px;">'+(p.is_overseas?'✈️':'—')+'</td>'+
        '<td style="font-size:13px;">'+(p.availability_status!=='available'?statusIcon:'—')+'</td>'+
      '</tr>';
    }).join('');
  } catch(e){ UI.toast(e.message,'error'); }
}
function sqEdit(teamId,role,pid) {
  if (!_squadEdits[teamId]) _squadEdits[teamId]={};
  if (role==='captain') _squadEdits[teamId].captainId=pid;
  if (role==='vc')      _squadEdits[teamId].vcId=pid;
  if (role==='impact')  _squadEdits[teamId].impactId=pid;
}
async function saveSquadRoles() {
  var teamId=$id('squad-team').value, edits=_squadEdits[teamId];
  if (!teamId||!edits) { UI.toast('No changes','warn'); return; }
  UI.showConfirm({ icon:'👑', title:'Save Squad Roles?', msg:'Update Captain, VC, and Impact Player.',
    consequence:'Multipliers apply from the next calculation.', okLabel:'Save', okClass:'btn-accent',
    onOk: async function(){
      try {
        await sb.from('squad_players').update({is_captain:false,is_vc:false,is_impact:false}).eq('fantasy_team_id',teamId);
        if (edits.captainId) await sb.from('squad_players').update({is_captain:true}).eq('fantasy_team_id',teamId).eq('player_id',edits.captainId);
        if (edits.vcId)      await sb.from('squad_players').update({is_vc:true}).eq('fantasy_team_id',teamId).eq('player_id',edits.vcId);
        if (edits.impactId)  await sb.from('squad_players').update({is_impact:true}).eq('fantasy_team_id',teamId).eq('player_id',edits.impactId);
        await API._log('squad_roles_updated','team',teamId,null,edits);
        UI.toast('Squad roles saved!','success');
      } catch(e){ UI.toast(e.message,'error'); }
    }
  });
}

/* ══════════════════════════════════════════════════════════════
   BLOG MANAGER
══════════════════════════════════════════════════════════════ */
async function loadBlogList() {
  var cont=$id('blog-list');
  cont.innerHTML='<div style="padding:20px;text-align:center;color:var(--text3);">Loading…</div>';
  try {
    var blogs=safeArr(await API.fetchBlogs({limit:50,publishedOnly:false,status:_blogFilter==='all'?null:_blogFilter}));
    if (!blogs.length) { cont.innerHTML='<div style="padding:20px;text-align:center;color:var(--text3);">No posts yet.</div>'; return; }
    var sCols={draft:'var(--gold)',review:'var(--cyan)',published:'var(--green)'};
    cont.innerHTML=blogs.map(function(b,i){
      var col=sCols[b.status]||'var(--text3)';
      return '<div class="blog-list-item" style="animation:row-in .2s ease '+(i*.04)+'s both;" onclick="loadBlogEdit(\''+b.id+'\')">'+
        '<div style="flex:1;min-width:0;">'+
          '<div style="font-family:var(--f-ui);font-weight:700;font-size:13px;">'+(b.ai_generated?'🤖 ':'')+UI.esc(b.title)+'</div>'+
          '<div style="font-size:11px;color:var(--text2);">'+UI.esc(b.category)+' · '+UI.shortDate(b.created_at)+' · '+UI.esc(b.views||0)+' views</div>'+
        '</div>'+
        '<span style="background:'+col+'22;color:'+col+';font-size:9px;font-weight:700;padding:2px 7px;border-radius:3px;font-family:var(--f-ui);flex-shrink:0;">'+UI.esc(b.status)+'</span>'+
      '</div>';
    }).join('');
  } catch(e){ cont.innerHTML='<div style="color:var(--red);padding:14px;font-size:13px;">'+UI.esc(e.message)+'</div>'; }
}

function filterBlogs(status, btn) {
  _blogFilter=status;
  document.querySelectorAll('#panel-blogs .btn').forEach(function(b){b.classList.remove('active');});
  if (btn) btn.classList.add('active');
  loadBlogList();
}

function newBlog() { clearBlogForm(); }
function clearBlogForm() {
  $id('blog-id').value=''; $id('b-title').value=''; $id('b-excerpt').value='';
  $id('b-cat').value='general'; $id('b-status').value='draft'; $id('b-content').value='';
  $id('blog-editor-title').textContent='New Post'; $id('blog-del-btn').style.display='none'; $id('blog-err').textContent='';
}
async function loadBlogEdit(blogId) {
  try {
    var b=await API.fetchBlog(blogId,true); if(!b) return;
    $id('blog-id').value=b.id; $id('b-title').value=b.title||''; $id('b-excerpt').value=b.excerpt||'';
    $id('b-cat').value=b.category||'general'; $id('b-status').value=b.status||'draft'; $id('b-content').value=b.content||'';
    $id('blog-editor-title').textContent='Editing: '+b.title.substring(0,30); $id('blog-del-btn').style.display='';
  } catch(e){ UI.toast(e.message,'error'); }
}
async function saveBlog() {
  var id=$id('blog-id').value, title=$id('b-title').value.trim(), content=$id('b-content').value.trim();
  var errEl=$id('blog-err'); errEl.textContent='';
  if (!title||!content) { errEl.textContent='Title and content are required.'; return; }
  var blog={title,content,excerpt:$id('b-excerpt').value.trim()||null,category:$id('b-cat').value,status:$id('b-status').value,is_published:$id('b-status').value==='published'};
  if (id) blog.id=id;
  try { await API.upsertBlog(blog); UI.toast('Saved!','success'); clearBlogForm(); await loadBlogList(); }
  catch(e){ errEl.textContent=e.message; UI.toast(e.message,'error'); }
}
async function publishBlog() {
  var id=$id('blog-id').value; if(!id){ UI.toast('Save the post first','warn'); return; }
  UI.showConfirm({ icon:'🚀', title:'Publish Post?', msg:'Make this post visible to all users.', okLabel:'Publish', okClass:'btn-accent',
    onOk: async function(){ try { await API.publishBlog(id,'admin'); UI.toast('Published!','success'); clearBlogForm(); await loadBlogList(); } catch(e){ UI.toast(e.message,'error'); } }
  });
}
async function deleteBlog() {
  var id=$id('blog-id').value; if(!id) return;
  UI.showConfirm({ icon:'🗑️', title:'Delete Post?', msg:'Permanently remove this blog post.', okLabel:'Delete', okClass:'btn-danger',
    onOk: async function(){ try { await API.deleteBlog(id); UI.toast('Deleted','warn'); clearBlogForm(); await loadBlogList(); } catch(e){ UI.toast(e.message,'error'); } }
  });
}
function toggleAIGen() {
  var p=$id('ai-gen-panel'); if(p) p.style.display=p.style.display==='none'?'':'none';
}
async function generateAIBlog() {
  var title=$id('ai-title').value.trim(), cat=$id('ai-cat').value, ctx=$id('ai-ctx').value.trim();
  if (!title) { UI.toast('Enter a topic','warn'); return; }
  var btn=$id('ai-btn'), icon=$id('ai-icon');
  if (btn._busy) return; btn._busy=true; btn.disabled=true; icon.textContent='⏳';
  try {
    var blog=await API.generateAIBlog({title,category:cat,context:ctx});
    await loadBlogEdit(blog.id);
    $id('ai-gen-panel').style.display='none';
    await loadBlogList();
    UI.toast('AI draft generated — review and publish!','success',5000);
  } catch(e){ UI.toast('AI failed: '+e.message,'error'); }
  btn._busy=false; btn.disabled=false; icon.textContent='✨';
}

/* ══════════════════════════════════════════════════════════════
   USERS
══════════════════════════════════════════════════════════════ */
async function loadUsers() {
  var tbody=$id('users-tbody'); if(!tbody) return;
  tbody.innerHTML='<tr><td colspan="7"><div class="skel skel-row" style="margin:8px;"></div></td></tr>';
  try {
    var lb=safeArr(await API.fetchLeaderboard());
    if (lb.some(function(r){ return !r.matches_played; })) {
      try {
        var allLogs = await sb.from('points_log').select('fantasy_team_id');
        var counts = {};
        (allLogs.data || []).forEach(function(l){ counts[l.fantasy_team_id] = (counts[l.fantasy_team_id] || 0) + 1; });
        lb.forEach(function(r){ if (!r.matches_played) r.matches_played = counts[r.fantasy_team_id] || 0; });
      } catch(e) {}
    }
    var medals={1:'🥇',2:'🥈',3:'🥉'};
    tbody.innerHTML=lb.map(function(r,i){
      var t=r.team||{};
      var initials=(t.team_name||'?').split(' ').map(function(w){return w[0];}).join('').substring(0,2).toUpperCase();
      var logo = UI.getTeamLogo(t.team_name);
      var avatarObj = logo ? '<img src="'+logo+'" style="width:100%;height:100%;object-fit:contain;padding:2px;" onerror="this.outerHTML=\''+initials+'\'">' : initials;
      return '<tr style="animation:row-in .2s ease '+(i*.04)+'s both;">'+
        '<td><div class="user-avatar" style="font-size:11px;">'+avatarObj+'</div></td>'+
        '<td style="font-family:var(--f-ui);font-weight:700;">'+UI.championName(t.team_name||'—')+'</td>'+
        '<td style="font-size:13px;color:var(--text2);">'+UI.esc(t.owner_name||'—')+'</td>'+
        '<td class="rank">'+(medals[r.rank]||r.rank)+'</td>'+
        '<td class="pts">'+r.total_points+'</td>'+
        '<td style="color:var(--text2);">'+r.matches_played+'</td>'+
        '<td><button class="btn btn-ghost btn-sm" style="font-size:11px;" onclick="goToSquad(\''+r.fantasy_team_id+'\')">Squad</button></td>'+
      '</tr>';
    }).join('');
  } catch(e){ tbody.innerHTML='<tr><td colspan="7" style="color:var(--red);padding:12px;">'+UI.esc(e.message)+'</td></tr>'; }
}
function goToSquad(teamId) { $id('squad-team').value=teamId; showPanel('squads'); loadSquadAdmin(); }

/* ══════════════════════════════════════════════════════════════
   AUDIT LOG
══════════════════════════════════════════════════════════════ */
async function loadAuditLog() {
  var tbody=$id('audit-tbody'); if(!tbody) return;
  tbody.innerHTML='<tr><td colspan="6"><div class="skel skel-row" style="margin:8px;"></div></td></tr>';
  var filter=$id('audit-filter');
  var actionType=filter?filter.value||null:null;
  try {
    var logs=safeArr(await API.fetchActionLog({limit:100,actionType}));
    if (!logs.length) { tbody.innerHTML='<tr><td colspan="6" class="empty-state" style="padding:20px;">No log entries.</td></tr>'; return; }
    tbody.innerHTML=logs.map(function(l,i){
      var col=ACTION_COLORS[l.action_type]||'var(--text2)';
      var canUndo=l.action_type==='stat_entry'||l.action_type==='adjustment';
      return '<tr style="animation:row-in .2s ease '+(i*.02)+'s both;">'+
        '<td style="font-size:11px;color:var(--text3);white-space:nowrap;">'+UI.shortDate(l.created_at)+'</td>'+
        '<td><span style="background:'+col+'22;color:'+col+';font-size:9px;font-weight:700;padding:2px 7px;border-radius:3px;font-family:var(--f-ui);">'+UI.esc(l.action_type)+'</span></td>'+
        '<td style="font-size:12px;">'+UI.esc(l.entity_type)+'</td>'+
        '<td style="font-family:var(--f-mono);font-size:10px;color:var(--text3);">'+UI.esc((l.entity_id||'').substring(0,12))+'…</td>'+
        '<td style="font-size:12px;">'+UI.esc(l.performed_by||'admin')+'</td>'+
        '<td>'+(canUndo?'<button class="btn btn-ghost btn-sm" style="font-size:10px;padding:2px 7px;" onclick="undoAction(\''+l.id+'\',\''+l.action_type+'\',\''+l.entity_id+'\')">↩ Undo</button>':'—')+'</td>'+
      '</tr>';
    }).join('');
  } catch(e){ tbody.innerHTML='<tr><td colspan="6" style="color:var(--red);padding:12px;">'+UI.esc(e.message)+'</td></tr>'; }
}

async function undoAction(logId, actionType, entityId) {
  if (actionType==='stat_entry') {
    UI.showConfirm({ icon:'↩', title:'Undo Stat Entry?', msg:'Restore previous stats for this player.',
      consequence:'Overwrites current stats with the version before this action.', okLabel:'Undo', okClass:'btn-danger',
      onOk: async function(){ try { await API.undoLastStatEntry(entityId); UI.toast('Stats restored','success'); await loadAuditLog(); } catch(e){ UI.toast(e.message,'error'); } }
    });
  } else if (actionType==='adjustment') {
    UI.toast('To undo an adjustment, use the Point Overrides panel → Adjustment History → ↩','info',5000);
  } else {
    UI.toast('Undo not available for this action type.','warn');
  }
}

/* ══════════════════════════════════════════════════════════════
   LOGOUT
══════════════════════════════════════════════════════════════ */
async function doLogout() { await Auth.signOut(); }

/* ══════════════════════════════════════════════════════════════
   BOOT
══════════════════════════════════════════════════════════════ */
init();