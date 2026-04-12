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
var _playerSquadMap = {}; // player_id → {team_id, team_name} (BFL team that picked this player)
var _ctrlMatchId  = null;
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
  if (panel) {
    panel.classList.add('active');
    if (id === 'users') {
      setTimeout(function() { $id('admin-body').scrollTop = 0; }, 50);
    }
  }

  var link = document.querySelector('.sb-link[data-panel="' + id + '"]');
  if (link) link.classList.add('active');

  // Lazy-load panel
  var loaders = {
    dashboard:      loadDashboard,
    fixtures:       renderFixtureList,
    results:        loadResultsPanel,
    matchctrl:      loadMatchCtrlPanel,
    stats:          function() {},
    calculate:      function() {},
    overrides:      function() { loadAdjustments(); },
    injuries:       loadInjuries,
    squads:         function() {},
    audit:          loadAuditLog,
    'pred-summary': loadPredictionsSummary,
    'fantasy-leaderboard': loadFantasyLeaderboard,
    'user-teams':   loadUserTeams,
    'pred-accuracy': loadPredictionAccuracy,
    'match-preds':  loadMatchPredictionsPanel,
    'power-rankings': loadPowerRankings,
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

    // Init overlay click/touch to close sidebar
    var overlay = $id('sb-overlay');
    if (overlay) {
      overlay.addEventListener('click', closeSidebar);
      overlay.addEventListener('touchstart', closeSidebar, {passive: true});
    }

    // Auto-close sidebar on link click
    var sb = $id('admin-sidebar');
    if (sb) {
      sb.addEventListener('click', function(e) {
        if (e.target && e.target.closest && e.target.closest('a')) {
          closeSidebar();
        }
      });
    }

    // Resize handler
    window.addEventListener('resize', function() {
      if (window.innerWidth > 900 && !_sidebarOpen) {
        // On desktop, re-open if it was only closed for mobile
      }
      applySidebarState();
    });

// Load core data
  await Promise.all([loadAllMatches(), loadAllPlayers(), loadAllTeams()]);
  await loadPlayerSquadMap();

    // Update notification badge for pending replacements
    updateRepBadge();

    // Poll for new replacement requests every 30 seconds
    setInterval(updateRepBadge, 30000);

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
    var raw = safeArr(await API.fetchAllTeamPoints());
    _teams = raw.map(function(t) {
      return {
        fantasy_team_id: t.id,
        team: t
      };
    });
  } catch(e) { console.error('[loadAllTeams]', e); _teams = []; }
}

async function loadPlayerSquadMap() {
  try {
    var squadData = safeArr(await API.fetchSquadPlayersAll());
    var teamMap = {};
    _teams.forEach(function(t) { teamMap[t.fantasy_team_id] = t.team && t.team.team_name; });
    _playerSquadMap = {};
    squadData.forEach(function(sp) {
      if (sp.player_id && sp.fantasy_team_id && !sp.is_released) {
        _playerSquadMap[sp.player_id] = {
          team_id: sp.fantasy_team_id,
          team_name: teamMap[sp.fantasy_team_id] || ''
        };
      }
    });
  } catch(e) { console.error('[loadPlayerSquadMap]', e); _playerSquadMap = {}; }
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

    // Recent predictions
    try {
      var preds = await sb.from('predictions').select('*,match:matches(match_no,team1,team2,match_date),fantasy_team:fantasy_teams(team_name)').order('submitted_at', {ascending:false}).limit(8);
      var predData = safeArr(preds.data);
      $id('dash-predictions').innerHTML = !predData.length
        ? '<div style="color:var(--text3);font-size:13px;padding:8px 0;">No predictions yet.</div>'
        : predData.map(function(p) {
            var t = p.fantasy_team || {};
            var m = p.match || {};
            return '<div class="user-row">'+
              '<div style="flex:1;">'+
                '<div style="font-weight:700;font-size:13px;">'+UI.esc(t.team_name||'—')+'</div>'+
                '<div style="font-size:11px;color:var(--text3);">M'+(m.match_no||'?')+' '+UI.esc((m.team1||'').substring(0,3))+' vs '+UI.esc((m.team2||'').substring(0,3))+'</div>'+
              '</div>'+
              '<div style="font-size:11px;color:var(--text2);">'+(p.predicted_winner||'—')+(p.target_score ? ' · '+p.target_score : '')+'</div>'+
            '</div>';
          }).join('');
    } catch(e) { $id('dash-predictions').innerHTML = '<div style="color:var(--text3);font-size:12px;">Could not load.</div>'; }

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
      '<div style="font-family:var(--f-display);font-size:18px;font-weight:700;margin-bottom:10px;">'+UI.esc(m.team1)+' vs '+UI.esc(m.team2)+'</div>'+
      '<div style="font-size:13px;color:var(--text2);margin-bottom:6px;">'+UI.fmtDate(m.match_date)+(m.venue?' · '+UI.esc(m.venue):'')+'</div>'+
      (m.winner?'<div style="color:var(--gold);margin-bottom:4px;">🏆 Winner: <strong>'+UI.esc(m.winner)+'</strong></div>':'')+
      (m.actual_target?'<div style="color:var(--text2);">🎯 Target: <strong style="color:var(--accent);">'+m.actual_target+'</strong>'+(m.is_dls_applied?' <span class="dls-badge">DLS</span>':'')+'</div>':'')+
      '<div style="margin-top:8px;"><span class="match-status '+(m.is_abandoned?'status-upcoming':m.is_locked?'status-locked':'status-open')+'" style="font-size:11px;">'+(m.is_abandoned?'☔ Abandoned':m.is_locked?'🔒 Locked':'● Open')+'</span></div>'+
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
var _allPredictionsCache = [];
async function exportPredictionsCSV() {
  try {
    var preds = await sb.from('predictions').select('*,match:matches(match_no,team1,team2,match_date),fantasy_team:fantasy_teams(team_name,owner_name)').order('submitted_at', {ascending:false});
    _allPredictionsCache = safeArr(preds.data);
    if (!_allPredictionsCache.length) { UI.toast('No predictions to export','warn'); return; }
    var csv = 'Match,Team,Owner,Predicted Winner,Target Score,Submitted At\n';
    _allPredictionsCache.forEach(function(p) {
      var m = p.match || {};
      var t = p.fantasy_team || {};
      csv += '"M'+(m.match_no||'')+' '+UI.esc((m.team1||'').substring(0,3))+' vs '+UI.esc((m.team2||'').substring(0,3))+'",' +
        '"'+(t.team_name||'').replace(/"/g,'""')+'",' +
        '"'+(t.owner_name||'').replace(/"/g,'""')+'",' +
        (p.predicted_winner||'') + ',' +
        (p.target_score||'') + ',' +
        (p.submitted_at||'') + '\n';
    });
    var blob = new Blob([csv], {type:'text/csv'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = 'predictions_export_' + new Date().toISOString().slice(0,10) + '.csv'; a.click();
    URL.revokeObjectURL(url);
    UI.toast('Predictions CSV exported!','success');
  } catch(e) { UI.toast('Export failed: '+e.message,'error'); }
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
      '<span style="font-family:var(--f-display);font-weight:700;font-size:17px;">'+UI.esc(m.team1)+' vs '+UI.esc(m.team2)+'</span>'+
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
      var squad = _playerSquadMap[p.id];
      var teamLabel = squad ? UI.tShort(squad.team_name) : null;
      var optionText = teamLabel ? UI.esc(p.name)+' ('+teamLabel+')' : UI.esc(p.name);
      return '<option value="'+p.id+'">'+optionText+'</option>';
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

async function selectStatPlayer(id, name, role, iplTeam) {
  _statsPlayerId = id;
  $id('stats-player-id').value = id;

  var squad = _playerSquadMap[id];
  var bflTeam = squad ? UI.tShort(squad.team_name) : '';
  var chip = $id('stats-player-chip');
  if (chip) {
    var teamSpan = bflTeam ? ' <span style="color:var(--text2);">'+bflTeam+'</span>' : '';
    chip.innerHTML = '<div style="display:inline-flex;align-items:center;gap:8px;background:var(--bg3);border:1px solid var(--border);border-radius:20px;padding:4px 12px;font-size:13px;">'+
      UI.roleBadge(role)+' <strong>'+UI.esc(name)+'</strong>'+teamSpan+'</div>';
    chip.style.display='';
  }

  // Load existing stats if any
  if (_statsMatchId) {
    try {
      var {data} = await sb.from('player_match_stats').select('*').eq('match_id',_statsMatchId).eq('player_id',id).maybeSingle();
      if (data) prefillStats(data); else clearStatsFields(false);
    } catch(e) { console.warn('[selectStatPlayer] load stats error:', e); clearStatsFields(false); }
  }
  $id('sf-player-name').textContent = name;
  $id('sf-player-sub').textContent  = role + ' · ' + iplTeam;
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
          var startMatch=r.start_match_id&&matchesMap[r.start_match_id]?'M'+(matchesMap[r.start_match_id].match_no||'?'):'N/A';
          return '<div class="inj-card" style="border-left:3px solid var(--red);opacity:0.7;padding:12px;margin-bottom:12px;">'+
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">'+
              '<div style="flex:1;min-width:200px;">'+
                '<div style="font-size:11px;color:var(--text2);margin-bottom:4px;">'+UI.championName(r.team?r.team.team_name:'—')+'</div>'+
                '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">'+
                  '<div style="background:rgba(248,113,113,.15);border:1px solid rgba(248,113,113,.3);border-radius:6px;padding:6px 10px;">'+
                    '<div style="font-weight:700;font-size:13px;">'+UI.esc(r.original?r.original.name:'—')+'</div>'+
                    '<div style="font-size:10px;color:var(--text2);">'+(r.original?r.original.role:'')+' · '+UI.esc(r.original?r.original.ipl_team:'')+'</div>'+
                  '</div>'+
                  '<svg viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="2" style="width:16px;height:16px;"><path d="M5 12h14M12 5l7 7-7 7"/></svg>'+
                  '<div style="background:rgba(56,217,245,.1);border:1px solid rgba(56,217,245,.2);border-radius:6px;padding:6px 10px;">'+
                    '<div style="font-weight:700;font-size:13px;color:var(--text3);">'+UI.esc(r.replacement?r.replacement.name:'—')+'</div>'+
                    '<div style="font-size:10px;color:var(--text3);">'+(r.replacement?r.replacement.role:'')+' · '+UI.esc(r.replacement?r.replacement.ipl_team:'')+'</div>'+
                  '</div>'+
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
    
    // Update badge count
    updateRepBadge();
  } catch(e){ el.innerHTML='<div style="color:var(--red);font-size:13px;">'+UI.esc(e.message)+'</div>'; }
}

async function updateRepBadge() {
  try {
    var badge = document.getElementById('rep-badge');
    if (!badge) return;
    
    var { count, error } = await sb.from('replacements')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    
    if (error) throw error;
    
    var pendingCount = count || 0;
    if (pendingCount > 0) {
      badge.textContent = pendingCount;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  } catch(e) {
    console.warn('[updateRepBadge]', e.message);
  }
}

async function approveRep(repId) {
  var notes='';
  var confirmed=await new Promise(function(resolve){
    UI.showConfirm({icon:'✓',title:'Approve Replacement?',msg:'This will approve the replacement request and activate it.',okLabel:'Approve',okClass:'btn-accent',
      onOk:function(){ resolve(true); },
      onCancel:function(){ resolve(false); }
    });
  });
  if(!confirmed) return;
  try{
    await API.approveReplacement(repId,notes);
    UI.toast('Replacement approved','success');
    loadInjuries();
  }catch(e){UI.toast(e.message,'error');}
}

async function rejectRep(repId) {
  var notes='';
  var confirmed=await new Promise(function(resolve){
    UI.showPrompt({title:'Reject Replacement',label:'Rejection Reason (optional)',placeholder:'Enter reason for rejection...',
      onOk:function(val){ notes=val||'Rejected by admin'; resolve(true); },
      onCancel:function(){ resolve(false); }
    });
  });
  if(!confirmed) return;
  try{
    await API.rejectReplacement(repId,notes);
    UI.toast('Replacement rejected','warn');
    loadInjuries();
  }catch(e){UI.toast(e.message,'error');}
}

async function undoRep(repId) {
  try{
    await API.updateReplacement(repId,{status:'pending',is_active:false,admin_notes:null},true);
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
  $id('inj-player-id').value=id;
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
  var injPlayer=_players.find(function(p){return p.id===injId}); if (!injPlayer) return;
  var squad=teamId?safeArr(await API.fetchSquad(teamId)):[];
  var squadIds=new Set(squad.map(function(sp){return sp.player&&sp.player.id;}));
  var targetTeam=injPlayer.ipl_team||'';
  var eligible=_players.filter(function(p){return p.role===injPlayer.role&&p.ipl_team===targetTeam&&!squadIds.has(p.id)&&p.availability_status==='available'&&p.id!==injId;});
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
        '<td style="font-size:13px;">'+(p.is_overseas?'<img src="images/ipl/teams-foreign-player-icon.svg" style="width:14px;vertical-align:middle;transform:rotate(45deg);">':'—')+'</td>'+
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

async function exportReleasesPDF() {
  UI.toast('Loading releases...','info');
  try {
    var { data: teams, error: ftError } = await sb.from('fantasy_teams').select('*');
    if (ftError) throw ftError;
    teams = teams || [];
    var allReleases = [];
    var seenTeams = {};
    for (var i = 0; i < teams.length; i++) {
      var team = teams[i];
      if (!team.id || seenTeams[team.id]) continue;
      seenTeams[team.id] = true;
      var squad = safeArr(await API.fetchSquad(team.id, true));
      var released = squad.filter(function(s) { return s.is_released === true; });
      if (released.length) {
        allReleases.push({ team: team, releases: released });
      }
    }
    if (!allReleases.length) { 
      UI.toast('No releases found in database','warn'); 
      return; 
    }
      var tradedPlayers = ['Urvil Patel', 'Will Jacks', 'Prasidh Krishna', 'Mohammed Siraj'];
    var html = '<!DOCTYPE html><html><head><title>All Releases - PDF</title>'+
      '<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=Work+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">'+
      '<style>'+
      '*{box-sizing:border-box;margin:0;padding:0;}'+
      'body{font-family:"Work Sans",Arial,sans-serif;padding:0;background:#0f0f0f;color:#fff;min-height:100vh;}'+
      '.header{background:linear-gradient(135deg,#e5393522 0%,#1a1a1a 100%);padding:40px 40px 30px;border-bottom:3px solid #e53935;}'+
      '.header-title{font-family:"Barlow Condensed",sans-serif;font-size:36px;font-weight:900;letter-spacing:1px;margin-bottom:5px;color:#e53935;}'+
      '.header-sub{font-size:14px;color:#888;margin-bottom:20px;padding:15px 40px;background:#1a1a1a;border-bottom:1px solid #333;}'+
      '.team-card{background:linear-gradient(135deg,#1a1a1a 0%,#252525 100%);border:1px solid #333;border-radius:12px;margin:0 40px 30px;overflow:hidden;}'+
      '.team-card-header{background:#e53935;padding:15px 20px;}'+
      '.team-card-name{font-size:20px;font-weight:700;color:#fff;}'+
      '.team-card-owner{font-size:12px;color:#ffcdd2;}'+
      '.player-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:15px;padding:20px;}'+
      '.player-card{background:#1a1a1a;border:1px solid #333;border-radius:10px;padding:15px;display:flex;align-items:center;gap:12px;transition:all 0.2s;}'+
      '.player-card:hover{border-color:#e53935;transform:translateY(-2px);}'+
      '.player-avatar{width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,#e53935,#8c1b1b);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#fff;flex-shrink:0;}'+
      '.player-info{flex:1;min-width:0;}'+
      '.player-name{font-weight:600;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'+
      '.player-role{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;}'+
      '.player-team{font-size:12px;color:#666;margin-top:2px;}'+
      '.badge-os{background:#e65100;color:#fff;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:700;}'+
      '.badge-released{background:#e53935;color:#fff;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:700;}'+
      '.badge-traded{background:#ffc107;color:#000;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:700;}'+
      '.player-card.traded{border-color:#ffc107;}'+
      '@media print{'+
      'body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}'+
      '.player-card{break-inside:avoid;}'+
      '}'+
      '</style></head>'+
      '<body>'+
      '<div class="header">'+
        '<div class="header-title">📤 Player Releases & Trades</div>'+
        '<div class="header-sub">IPL 2026 Fantasy League | Generated: '+new Date().toLocaleDateString()+' | Total: '+allReleases.reduce(function(acc,t){return acc+t.releases.length;},0)+' players</div>'+
      '</div>';
    var shownPlayers = {};
    allReleases.forEach(function(tr) {
      html += '<div class="team-card">'+
        '<div class="team-card-header"><div class="team-card-name">'+UI.esc(tr.team.team_name||'')+'</div>'+
        '<div class="team-card-owner">Owner: '+UI.esc(tr.team.owner_name||'—')+'</div></div>'+
        '<div class="player-grid">';
      var tradedPlayers = ['urvil', 'will jacks', 'prasidh', 'siraj'];
      var hasPlayers = false;
      tr.releases.forEach(function(sp) {
        if (shownPlayers[sp.player_id]) return;
        shownPlayers[sp.player_id] = true;
        hasPlayers = true;
        var p = sp.player || {};
        var initials = (p.name||'').split(' ').map(function(w) { return w[0]; }).join('').substring(0,2).toUpperCase();
        var playerNameLower = (p.name||'').toLowerCase().trim();
        var isTraded = false;
        for (var ti = 0; ti < tradedPlayers.length; ti++) {
          if (playerNameLower.includes(tradedPlayers[ti])) { isTraded = true; break; }
        }
        var badgeClass = isTraded ? 'badge-traded' : 'badge-released';
        var badgeText = isTraded ? 'Traded' : 'Released';
        html += '<div class="player-card'+(isTraded?' traded':'')+'">'+
          '<div class="player-avatar">'+initials+'</div>'+
          '<div class="player-info">'+
            '<div class="player-name">'+UI.esc(p.name||'—')+'</div>'+
            '<div class="player-role">'+(p.role||'')+'</div>'+
            '<div class="player-team">'+(p.ipl_team||'')+'</div>'+
            '<div style="margin-top:5px;">'+(p.is_overseas ? '<span class="badge-os">OS</span>' : '')+' <span class="'+badgeClass+'">'+badgeText+'</span></div>'+
          '</div>'+
        '</div>';
      });
      html += '</div></div>';
    });
    html += '</body></html>';
    allReleases.forEach(function(tr) {
      html += '<div class="team-card">'+
        '<div class="team-card-header"><div class="team-card-name">'+UI.esc(tr.team.team_name||'')+'</div>'+
        '<div class="team-card-owner">Owner: '+UI.esc(tr.team.owner_name||'—')+'</div></div>'+
        '<div class="player-grid">';
      tr.releases.forEach(function(sp) {
        var p = sp.player || {};
        var initials = (p.name||'').split(' ').map(function(w) { return w[0]; }).join('').substring(0,2).toUpperCase();
        html += '<div class="player-card">'+
          '<div class="player-avatar">'+initials+'</div>'+
          '<div class="player-info">'+
            '<div class="player-name">'+UI.esc(p.name||'—')+'</div>'+
            '<div class="player-role">'+(p.role||'')+'</div>'+
            '<div class="player-team">'+(p.ipl_team||'')+'</div>'+
            '<div style="margin-top:5px;">'+(p.is_overseas ? '<span class="badge-os">OS</span>' : '')+' <span class="badge-released">Released</span></div>'+
          '</div>'+
        '</div>';
      });
      html += '</div></div>';
    });
    html += '</body></html>';
    var printWin = window.open('','_blank');
    if (!printWin) { UI.toast('Please allow popups and try again','warn'); return; }
    printWin.document.write(html);
    printWin.document.close();
    setTimeout(function() { printWin.print(); }, 500);
    UI.toast('PDF ready - use print dialog to save','success');
  } catch(e) { UI.toast(e.message,'error'); }
}

async function exportSquadPDF() {
  var teamId = $id('squad-team').value;
  if (!teamId) { UI.toast('Select a team first','warn'); return; }
  UI.toast('Loading squad...','info');
  try {
    var teams = safeArr(await API.fetchLeaderboard());
    var teamInfo = teams.find(function(t) { return t.fantasy_team_id === teamId; });
    var team = teamInfo ? teamInfo.team : {};
    var squad = safeArr(await API.fetchSquad(teamId));
    if (!squad.length) { UI.toast('No squad found','warn'); return; }
    var captain = squad.find(function(s) { return s.is_captain; });
    var vc = squad.find(function(s) { return s.is_vc; });
    var impact = squad.find(function(s) { return s.is_impact; });
    var totalValue = squad.length;
    var overseas = squad.filter(function(s) { return s.player && s.player.is_overseas; }).length;
    var injured = squad.filter(function(s) { return s.player && s.player.availability_status !== 'available'; }).length;
    var iplTeams = {};
    squad.forEach(function(s) { if (s.player && s.player.ipl_team) iplTeams[s.player.ipl_team] = (iplTeams[s.player.ipl_team] || 0) + 1; });
    var topIplTeam = Object.keys(iplTeams).reduce(function(a, b) { return iplTeams[a] > iplTeams[b] ? a : b; }, '');
    var teamColor = '#c8f135';
    if (team.team_name && team.team_name.toLowerCase().includes('mumbai')) teamColor = '#004ba0';
    else if (team.team_name && team.team_name.toLowerCase().includes('chennai')) teamColor = '#f2c512';
    else if (team.team_name && team.team_name.toLowerCase().includes('kolkata')) teamColor = '#2e2b5e';
    else if (team.team_name && team.team_name.toLowerCase().includes('delhi')) teamColor = '#17449b';
    else if (team.team_name && team.team_name.toLowerCase().includes('hyderabad')) teamColor = '#e61d2b';
    else if (team.team_name && team.team_name.toLowerCase().includes('rajasthan')) teamColor = '#fb6537';
    else if (team.team_name && team.team_name.toLowerCase().includes('punjab')) teamColor = '#d01c1f';
    else if (team.team_name && team.team_name.toLowerCase().includes('bangalore')) teamColor = '#d01c1f';
    var html = '<!DOCTYPE html><html><head><title>Squad - '+UI.esc(team.team_name||'')+'</title>'+
      '<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=Work+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">'+
      '<style>'+
      '*{box-sizing:border-box;margin:0;padding:0;}'+
      'body{font-family:"Work Sans",Arial,sans-serif;padding:0;background:#0f0f0f;color:#fff;min-height:100vh;}'+
      '.header{background:linear-gradient(135deg,'+teamColor+'22 0%,#1a1a1a 100%);padding:40px 40px 30px;border-bottom:3px solid '+teamColor+';}'+
      '.team-name{font-family:"Barlow Condensed",sans-serif;font-size:42px;font-weight:900;letter-spacing:1px;margin-bottom:5px;color:'+teamColor+';}'+
      '.owner{font-size:16px;color:#888;margin-bottom:20px;}'+
      '.rank-badge{display:inline-block;background:'+teamColor+';color:#000;font-weight:700;padding:8px 20px;border-radius:25px;font-size:14px;margin-right:15px;}'+
      '.points-badge{display:inline-block;background:#222;border:1px solid '+teamColor+';color:'+teamColor+';font-weight:700;padding:8px 20px;border-radius:25px;font-size:14px;}'+
      '.stats-bar{background:#1a1a1a;padding:25px 40px;display:flex;justify-content:space-between;border-bottom:1px solid #333;}'+
      '.stat-box{text-align:center;flex:1;}'+
      '.stat-num{font-size:32px;font-weight:700;color:'+teamColor+';}'+
      '.stat-lbl{font-size:11px;text-transform:uppercase;color:#666;letter-spacing:1px;margin-top:5px;}'+
      '.section{padding:30px 40px;}'+
      '.section-title{font-size:18px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#666;margin-bottom:20px;padding-bottom:10px;border-bottom:1px solid #333;}'+
      '.leadership{display:flex;gap:20px;margin-bottom:30px;}'+
      '.leader-card{background:linear-gradient(135deg,#222 0%,#1a1a1a 100%);padding:20px;border-radius:12px;flex:1;text-align:center;border:1px solid #333;}'+
      '.leader-card.captain{border-color:#ff9800;background:linear-gradient(135deg,#ff980022 0%,#1a1a1a 100%);}'+
      '.leader-card.vc{border-color:#ffc107;background:linear-gradient(135deg,#ffc10722 0%,#1a1a1a 100%);}'+
      '.leader-card.impact{border-color:#c8f135;background:linear-gradient(135deg,#c8f13522 0%,#1a1a1a 100%);}'+
      '.leader-icon{font-size:28px;margin-bottom:8px;}'+
      '.leader-role{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888;}'+
      '.leader-name{font-size:18px;font-weight:700;margin-top:5px;}'+
      '.player-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:15px;}'+
      '.player-card{background:#1a1a1a;border:1px solid #333;border-radius:10px;padding:15px;display:flex;align-items:center;gap:12px;transition:all 0.2s;}'+
      '.player-card:hover{border-color:'+teamColor+';transform:translateY(-2px);}'+
      '.player-card.injured{border-color:#e51c23;}'+
      '.player-avatar{width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,'+teamColor+',#666);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#000;flex-shrink:0;}'+
      '.player-info{flex:1;min-width:0;}'+
      '.player-name{font-weight:600;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'+
      '.player-role{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;}'+
      '.player-team{font-size:12px;color:#666;margin-top:2px;}'+
      '.player-badges{display:flex;gap:5px;margin-top:5px;}'+
      '.badge{display:inline-block;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:700;}'+
      '.badge-c{background:#ff9800;color:#fff;}'+
      '.badge-vc{background:#ffc107;color:#000;}'+
      '.badge-imp{background:'+teamColor+';color:#000;}'+
      '.badge-os{background:#e65100;color:#fff;}'+
      '.status-available{color:#4caf50;font-size:11px;}'+
      '.status-injured{color:#e51c23;font-size:11px;}'+
      '@media print{'+
      'body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}'+
      '.player-card{break-inside:avoid;}'+
      '}'+
      '</style></head>'+
      '<body>'+
      '<div class="header">'+
        '<div class="team-name">'+UI.esc(team.team_name||'Team')+'</div>'+
        '<div class="owner">Owned by '+UI.esc(team.owner_name||'—')+'</div>'+
        '<div><span class="rank-badge">#'+(teamInfo.rank||'—')+'</span><span class="points-badge">'+(teamInfo.total_points||0)+' PTS</span></div>'+
      '</div>'+
      '<div class="stats-bar">'+
        '<div class="stat-box"><div class="stat-num">'+totalValue+'</div><div class="stat-lbl">Players</div></div>'+
        '<div class="stat-box"><div class="stat-num">'+overseas+'</div><div class="stat-lbl">Overseas</div></div>'+
        '<div class="stat-box"><div class="stat-num">'+injured+'</div><div class="stat-lbl">Injured</div></div>'+
        '<div class="stat-box"><div class="stat-num">'+(teamInfo.matches_played||0)+'</div><div class="stat-lbl">Matches</div></div>'+
        '<div class="stat-box"><div class="stat-num">'+Object.keys(iplTeams).length+'</div><div class="stat-lbl">IPL Teams</div></div>'+
      '</div>';
    if (captain || vc || impact) {
      html += '<div class="section"><div class="section-title">🏆 Team Leadership</div>'+
        '<div class="leadership">';
      if (captain && captain.player) {
        var capInitials = (captain.player.name||'').split(' ').map(function(w) { return w[0]; }).join('').substring(0,2).toUpperCase();
        html += '<div class="leader-card captain"><div class="leader-icon">👑</div><div class="leader-role">Captain</div><div class="leader-name">'+UI.esc(captain.player.name||'')+'</div></div>';
      }
      if (vc && vc.player) {
        html += '<div class="leader-card vc"><div class="leader-icon">🎖️</div><div class="leader-role">Vice Captain</div><div class="leader-name">'+UI.esc(vc.player.name||'')+'</div></div>';
      }
      if (impact && impact.player) {
        html += '<div class="leader-card impact"><div class="leader-icon">⚡</div><div class="leader-role">Impact Player</div><div class="leader-name">'+UI.esc(impact.player.name||'')+'</div></div>';
      }
      html += '</div></div>';
    }
    html += '<div class="section"><div class="section-title">👥 Full Squad</div>'+
      '<div class="player-grid">';
    squad.forEach(function(sp) {
      var p = sp.player || {};
      var initials = (p.name||'').split(' ').map(function(w) { return w[0]; }).join('').substring(0,2).toUpperCase();
      var isInjured = p.availability_status !== 'available';
      var badges = '';
      if (sp.is_captain) badges += '<span class="badge badge-c">C</span>';
      if (sp.is_vc) badges += '<span class="badge badge-vc">VC</span>';
      if (sp.is_impact) badges += '<span class="badge badge-imp">IMP</span>';
      if (p.is_overseas) badges += '<span class="badge badge-os">OS</span>';
      html += '<div class="player-card'+(isInjured?' injured':'')+'">'+
        '<div class="player-avatar">'+initials+'</div>'+
        '<div class="player-info">'+
          '<div class="player-name">'+UI.esc(p.name||'—')+'</div>'+
          '<div class="player-role">'+(p.role||'')+'</div>'+
          '<div class="player-team">'+(p.ipl_team||'')+'</div>'+
          '<div class="player-badges">'+badges+'</div>'+
        '</div>'+
        '<div class="'+(isInjured?'status-injured':'status-available')+'">'+(isInjured?'🏥':'✓')+'</div>'+
      '</div>';
    });
    html += '</div></div></body></html>';
    var printWin = window.open('','_blank');
    if (!printWin) { UI.toast('Please allow popups and try again','warn'); return; }
    printWin.document.write(html);
    printWin.document.close();
    setTimeout(function() { printWin.print(); }, 500);
    UI.toast('PDF ready - use print dialog to save','success');
  } catch(e) { UI.toast(e.message,'error'); }
}

async function exportAllSquadsPDF() {
  UI.toast('Loading all squads...','info');
  try {
    var { data: teams, error: ftError } = await sb.from('fantasy_teams').select('*');
    if (ftError) throw ftError;
    teams = teams || [];
    var html = '<!DOCTYPE html><html><head><title>All Squads - PDF</title>'+
      '<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=Work+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">'+
      '<style>'+
      '*{box-sizing:border-box;margin:0;padding:0;}'+
      'body{font-family:"Work Sans",Arial,sans-serif;padding:0;background:#0f0f0f;color:#fff;min-height:100vh;}'+
      '.page-break{page-break-after:always;}'+
      '.header{background:linear-gradient(135deg,#c8f13522 0%,#1a1a1a 100%);padding:40px 40px 30px;border-bottom:3px solid #c8f135;}'+
      '.header-title{font-family:"Barlow Condensed",sans-serif;font-size:42px;font-weight:900;letter-spacing:1px;margin-bottom:5px;color:#c8f135;}'+
      '.header-sub{font-size:14px;color:#888;}'+
      '.team-card{background:linear-gradient(135deg,#1a1a1a 0%,#252525 100%);border:1px solid #333;border-radius:12px;margin:20px 40px 40px;overflow:hidden;}'+
      '.team-card-header{background:linear-gradient(135deg,#c8f13522 0%,#1a1a1a 100%);padding:20px 25px;border-bottom:1px solid #333;display:flex;justify-content:space-between;align-items:center;}'+
      '.team-card-name{font-family:"Barlow Condensed",sans-serif;font-size:24px;font-weight:700;color:#c8f135;}'+
      '.team-card-stats{display:flex;gap:20px;}'+
      '.stat-pill{background:#222;border:1px solid #444;padding:5px 12px;border-radius:20px;font-size:11px;}'+
      '.stat-pill span{color:#c8f135;font-weight:700;}'+
      '.leadership-bar{background:#1a1a1a;padding:15px 25px;display:flex;gap:15px;border-bottom:1px solid #333;}'+
      '.leader-chip{background:#222;border:1px solid #444;padding:8px 15px;border-radius:8px;display:flex;align-items:center;gap:8px;font-size:13px;}'+
      '.leader-chip.cap{border-color:#ff9800;}'+
      '.leader-chip.vc{border-color:#ffc107;}'+
      '.leader-chip.imp{border-color:#c8f135;}'+
      '.player-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;padding:20px;}'+
      '.player-card{background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:12px;display:flex;align-items:center;gap:10px;transition:all 0.2s;}'+
      '.player-card:hover{border-color:#c8f135;}'+
      '.player-card.released{opacity:0.5;border-color:#e53935;}'+
      '.player-card.injured{border-color:#e51c23;}'+
      '.player-avatar{width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#c8f135,#666);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#000;flex-shrink:0;}'+
      '.player-info{flex:1;min-width:0;}'+
      '.player-name{font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'+
      '.player-role{font-size:10px;color:#888;text-transform:uppercase;}'+
      '.player-team{font-size:11px;color:#666;}'+
      '.badge{display:inline-block;padding:2px 6px;border-radius:3px;font-size:9px;font-weight:700;margin-right:3px;}'+
      '.badge-c{background:#ff9800;color:#fff;}'+
      '.badge-vc{background:#ffc107;color:#000;}'+
      '.badge-imp{background:#c8f135;color:#000;}'+
      '.badge-os{background:#e65100;color:#fff;}'+
      '.badge-traded{background:#ffc107;color:#000;}'+
      '.player-card.traded{border-color:#ffc107;}'+
      '@media print{'+
      'body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}'+
      '.player-card{break-inside:avoid;}'+
      '}'+
      '</style></head>'+
      '<body>'+
      '<div class="header">'+
        '<div class="header-title">👥 All Squads</div>'+
        '<div class="header-sub">IPL 2026 Fantasy League | Generated: '+new Date().toLocaleDateString()+' | Total Teams: '+teams.length+'</div>'+
      '</div>';
    for (var i = 0; i < teams.length; i++) {
      var team = teams[i];
      if (!team || !team.id) continue;
      var squad = safeArr(await API.fetchSquad(team.id, true));
      if (!squad.length) continue;
      var captain = squad.find(function(s) { return s.is_captain; });
      var vc = squad.find(function(s) { return s.is_vc; });
      var impact = squad.find(function(s) { return s.is_impact; });
      var overseas = squad.filter(function(s) { return s.player && s.player.is_overseas; }).length;
      var injured = squad.filter(function(s) { return s.player && s.player.availability_status !== 'available'; }).length;
      var releasedCount = squad.filter(function(s) { return s.is_released === true; }).length;
      var activeCount = squad.length - releasedCount;
      if (i > 0) html += '<div class="page-break">';
      html += '<div class="team-card">'+
        '<div class="team-card-header">'+
          '<div class="team-card-name">'+UI.esc(team.team_name||'')+'</div>'+
          '<div class="team-card-stats">'+
            '<div class="stat-pill">Players: <span>'+activeCount+'</span></div>'+
            '<div class="stat-pill">Released: <span>'+releasedCount+'</span></div>'+
            '<div class="stat-pill">OS: <span>'+overseas+'</span></div>'+
            '<div class="stat-pill">Injured: <span>'+injured+'</span></div>'+
          '</div>'+
        '</div>';
      if (captain || vc || impact) {
        html += '<div class="leadership-bar">';
        if (captain && captain.player) html += '<div class="leader-chip cap">👑 '+UI.esc(captain.player.name||'')+'</div>';
        if (vc && vc.player) html += '<div class="leader-chip vc">🎖️ '+UI.esc(vc.player.name||'')+'</div>';
        if (impact && impact.player) html += '<div class="leader-chip imp">⚡ '+UI.esc(impact.player.name||'')+'</div>';
        html += '</div>';
      }
      html += '<div class="player-grid">';
      var tradedPlayers = ['urvil', 'will jacks', 'prasidh', 'siraj'];
      squad.forEach(function(sp) {
        var p = sp.player || {};
        var initials = (p.name||'').split(' ').map(function(w) { return w[0]; }).join('').substring(0,2).toUpperCase();
        var badges = '';
        if (sp.is_captain) badges += '<span class="badge badge-c">C</span>';
        if (sp.is_vc) badges += '<span class="badge badge-vc">VC</span>';
        if (sp.is_impact) badges += '<span class="badge badge-imp">IMP</span>';
        if (p.is_overseas) badges += '<span class="badge badge-os">OS</span>';
        var isReleased = sp.is_released === true;
        var isInjured = p.availability_status !== 'available';
        var playerNameLower = (p.name||'').toLowerCase().trim();
        var isTraded = false;
        if (isReleased) {
          for (var ti = 0; ti < tradedPlayers.length; ti++) {
            if (playerNameLower.includes(tradedPlayers[ti])) { isTraded = true; break; }
          }
        }
        html += '<div class="player-card'+(isTraded?' traded':'')+(isReleased && !isTraded?' released':'')+(isInjured?' injured':'')+'">'+
          '<div class="player-avatar">'+initials+'</div>'+
          '<div class="player-info">'+
            '<div class="player-name">'+UI.esc(p.name||'—')+'</div>'+
            '<div class="player-role">'+(p.role||'')+'</div>'+
            '<div class="player-team">'+(p.ipl_team||'')+'</div>'+
            '<div style="margin-top:4px;">'+badges+(isTraded?' <span class="badge badge-traded">Traded</span>':'')+'</div>'+
          '</div>'+
        '</div>';
      });
      html += '</div></div>';
    }
    html += '</body></html>';
    var printWin = window.open('','_blank');
    if (!printWin) { UI.toast('Please allow popups and try again','warn'); return; }
    printWin.document.write(html);
    printWin.document.close();
    setTimeout(function() { printWin.print(); }, 500);
    UI.toast('PDF ready - use print dialog to save','success');
  } catch(e) { UI.toast(e.message,'error'); }
}

/* ══════════════════════════════════════════════════════════════
   AUDIT LOG

  rows.forEach(function(row) {
    var text = row.textContent.toLowerCase();
    row.style.display = !search || text.includes(search) ? '' : 'none';
  });
}
var _leaderboardData = [];
async function exportUsersCSV() {
  if (!_leaderboardData.length) {
    try { _leaderboardData = safeArr(await API.fetchLeaderboard()); } catch(e) { _leaderboardData = []; }
  }
  if (!_leaderboardData.length) { UI.toast('No data to export','warn'); return; }
  var csv = 'Rank,Team,Owner,Total Points,Matches\n';
  _leaderboardData.forEach(function(r) {
    var t = r.team || {};
    csv += (r.rank||'') + ',' + (t.team_name||'').replace(/,/g,';') + ',' + (t.owner_name||'').replace(/,/g,';') + ',' + (r.total_points||0) + ',' + (r.matches_played||0) + '\n';
  });
  var blob = new Blob([csv], {type:'text/csv'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a'); a.href = url; a.download = 'teams_export_' + new Date().toISOString().slice(0,10) + '.csv'; a.click();
  URL.revokeObjectURL(url);
  UI.toast('CSV exported!','success');
}

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
   PREDICTIONS SUMMARY
══════════════════════════════════════════════════════════════ */
async function loadPredictionsSummary() {
  var teamWins = $id('pred-team-wins');
  var targetDist = $id('pred-target-dist');
  if (!teamWins || !targetDist) return;
  teamWins.innerHTML = '<div class="skel skel-row"></div>';
  targetDist.innerHTML = '<div class="skel skel-row"></div>';
  try {
    var preds = safeArr(await API.fetchAllPredictionsAllMatches());
    var completedMatches = _matches.filter(function(m) { return m.status === 'completed' || m.status === 'processed'; });
    var teamCounts = {};
    var targetScores = [];
    var validPredsCount = 0;

    preds.forEach(function(p) {
      var match = completedMatches.find(function(m) { return String(m.id) === String(p.match_id); });
      if (!match) return; // Only count predictions for resulted, non-abandoned matches

      validPredsCount++;
      if (p.predicted_winner) {
        teamCounts[p.predicted_winner] = (teamCounts[p.predicted_winner] || 0) + 1;
      }
      if (p.target_score) {
        targetScores.push(p.target_score);
      }
    });
    var teamList = Object.keys(teamCounts).sort(function(a,b) { return teamCounts[b] - teamCounts[a]; });
    if (teamList.length === 0) {
      teamWins.innerHTML = '<div class="empty-state" style="padding:20px;">No completed matches with predictions yet.</div>';
    } else {
      teamWins.innerHTML = '<div style="display:flex;flex-direction:column;gap:8px;">' + teamList.map(function(t) {
        var cnt = teamCounts[t];
        var pct = Math.round(cnt / validPredsCount * 100);
        var shortCode = UI.tShort(t) || t.substring(0,3).toUpperCase();
        return '<div style="display:flex;align-items:center;gap:10px;"><span style="width:50px;font-weight:700;">' + shortCode + '</span><div style="flex:1;background:var(--bg3);height:24px;border-radius:4px;overflow:hidden;"><div style="width:' + pct + '%;background:var(--accent);height:100%;"></div></div><span style="width:60px;text-align:right;color:var(--text2);">' + cnt + ' (' + pct + '%)</span></div>';
      }).join('') + '</div>';
    }
    if (targetScores.length === 0) {
      targetDist.innerHTML = '<div class="empty-state" style="padding:20px;">No target score predictions yet.</div>';
    } else {
      var ranges = { 
        '<100': 0, '100-120': 0, '121-140': 0, '141-160': 0, '161-180': 0, 
        '181-190': 0, '191-200': 0, '201-210': 0, '211-220': 0, '221-230': 0, '231-250': 0, '250+': 0 
      };
      targetScores.forEach(function(s) {
        if (s < 100) ranges['<100']++;
        else if (s <= 120) ranges['100-120']++;
        else if (s <= 140) ranges['121-140']++;
        else if (s <= 160) ranges['141-160']++;
        else if (s <= 180) ranges['161-180']++;
        else if (s <= 190) ranges['181-190']++;
        else if (s <= 200) ranges['191-200']++;
        else if (s <= 210) ranges['201-210']++;
        else if (s <= 220) ranges['211-220']++;
        else if (s <= 230) ranges['221-230']++;
        else if (s <= 250) ranges['231-250']++;
        else ranges['250+']++;
      });
      targetDist.innerHTML = '<div style="display:flex;flex-direction:column;gap:6px;">' + Object.keys(ranges).map(function(r) {
        var cnt = ranges[r];
        var pct = Math.round(cnt / targetScores.length * 100);
        return '<div style="display:flex;align-items:center;gap:10px;"><span style="width:70px;">' + r + '</span><div style="flex:1;background:var(--bg3);height:18px;border-radius:3px;overflow:hidden;"><div style="width:' + pct + '%;background:var(--purple);height:100%;"></div></div><span style="width:40px;text-align:right;color:var(--text2);">' + cnt + '</span></div>';
      }).join('') + '</div>';
    }
  } catch(e) { teamWins.innerHTML = '<div style="color:var(--red);padding:12px;">' + UI.esc(e.message) + '</div>'; }
}

/* ══════════════════════════════════════════════════════════════
   FANTASY PLAYERS LEADERBOARD
 ══════════════════════════════════════════════════════════════ */
var _flData = [];
var _flPage = 1;
var _flSort = { col: 'points', asc: false };
var _flPerPage = 12;

async function loadFantasyLeaderboard() {
  var tbody = $id('fantasy-leaderboard-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7"><div class="skel skel-row" style="margin:8px;"></div></td></tr>';
  try {
    var stats = safeArr(await API.fetchAllPlayerStats());
    var completedMatches = _matches.filter(function(m) { return m.status === 'completed' || m.status === 'processed'; });
    var completedMatchIds = completedMatches.map(function(m) { return m.id; });
    var playerPoints = {};
    var playerMatches = {};
    var playerIds = [];
    stats.forEach(function(s) {
      if (s.match_id && completedMatchIds.includes(s.match_id)) {
        var pid = s.player_id;
        if (!playerIds.includes(pid)) playerIds.push(pid);
        var pts = API.calcBattingPoints(s) + API.calcBowlingPoints(s) + API.calcFieldingPoints(s);
        playerPoints[pid] = (playerPoints[pid] || 0) + pts;
        playerMatches[pid] = (playerMatches[pid] || 0) + 1;
      }
    });
    var playerMap = {};
    if (playerIds.length > 0) {
      var allPlayers = safeArr(await API.fetchAllPlayers());
      allPlayers.forEach(function(p) { playerMap[p.id] = p; });
    }
    _flData = [];
    for (var pid in playerPoints) {
      var p = playerMap[pid];
      if (p) {
        var squad = _playerSquadMap[pid];
        _flData.push({ id: pid, name: p.name, role: p.role, ipl_team: p.ipl_team, bfl_team: squad ? squad.team_name : null, points: playerPoints[pid], matches: playerMatches[pid] });
      }
    }
    for (var pid in playerMatches) {
      if (!playerPoints[pid]) {
        var p = playerMap[pid];
        if (p) {
          var squad = _playerSquadMap[pid];
          _flData.push({ id: pid, name: p.name, role: p.role, ipl_team: p.ipl_team, bfl_team: squad ? squad.team_name : null, points: 0, matches: playerMatches[pid] });
        }
      }
    }
    populateFlFilters();
    filterFantasyLeaderboard();
  } catch(e) { tbody.innerHTML = '<tr><td colspan="7" style="color:var(--red);padding:12px;">' + UI.esc(e.message) + '</td></tr>'; }
}

function populateFlFilters() {
  var iplTeamSel = $id('fl-ipl-team');
  var bflTeamSel = $id('fl-bfl-team');
  if (iplTeamSel) {
    var iplTeamOptions = ['CHENNAI SUPER KINGS','DELHI CAPITALS','GUJARAT TITANS','KOLKATA KNIGHT RIDERS','LUCKNOW SUPER GIANTS','MUMBAI INDIANS','PUNJAB KINGS','RAJASTHAN ROYALS','ROYAL CHALLENGERS BENGALURU','SUNRISERS HYDERABAD','SUPREME RAJAS'];
    iplTeamSel.innerHTML = '<option value="">All IPL Teams</option>' + iplTeamOptions.map(function(t) { return '<option value="'+t+'">'+t+'</option>'; }).join('');
  }
  if (bflTeamSel) {
    var bflTeamOptions = [];
    if (_teams && _teams.length) {
      bflTeamOptions = _teams.map(function(t) { return t.team && t.team.team_name; }).filter(Boolean).sort();
    }
    if (!bflTeamOptions.length && _flData.length) {
      bflTeamOptions = [...new Set(_flData.map(function(p) { return p.bfl_team; }).filter(Boolean))].sort();
    }
    if (bflTeamOptions.length) {
      bflTeamSel.innerHTML = '<option value="">All BFL Teams</option>' + bflTeamOptions.map(function(t) { return '<option value="'+t.toUpperCase()+'">'+UI.tShort(t)+'</option>'; }).join('');
    } else {
      bflTeamSel.innerHTML = '<option value="">All BFL Teams</option>';
    }
  }
}

function filterFantasyLeaderboard() {
  var s = $id('fl-search');
  var it = $id('fl-ipl-team');
  var rl = $id('fl-role');
  var bt = $id('fl-bfl-team');
  var q = s ? s.value : '';
  var iplTeam = it ? it.value.trim() : '';
  var role = rl ? rl.value.trim() : '';
  var bflTeam = bt ? bt.value : '';
  var roleMap = { 'BAT': ['BAT','BATTER','BATTING'], 'BOW': ['BOW','BOWLER','BOWLING'], 'AR': ['AR','ALLROUNDER','ALL-ROUNDER'], 'WK': ['WK','WICKETKEEPER','WICKET-KEEPER','WICKET KEEPER'] };
  var roleVals = roleMap[role] || [role];
  /* debug log removed */
  var filtered = _flData.filter(function(p) {
    if (q && !(p.name||'').toLowerCase().includes(q.toLowerCase())) return false;
    if (iplTeam && p.ipl_team !== iplTeam && UI.tCode(iplTeam) !== p.ipl_team) return false;
    if (role && p.role && !roleVals.some(function(r) { return p.role.toUpperCase().indexOf(r) >= 0; })) return false;
    if (bflTeam) {
      var pb = p.bfl_team || '';
      if (pb.toUpperCase() !== bflTeam.toUpperCase()) return false;
    }
    return true;
  });
  sortFlData(filtered);
  _flPage = 1;
  renderFlTable(filtered);
}

function resetFantasyLeaderboard() {
  if ($id('fl-search')) $id('fl-search').value = '';
  if ($id('fl-ipl-team')) $id('fl-ipl-team').value = '';
  if ($id('fl-role')) $id('fl-role').value = '';
  if ($id('fl-bfl-team')) $id('fl-bfl-team').value = '';
  _flSort = { col: 'points', asc: false };
  _flPage = 1;
  filterFantasyLeaderboard();
}

function sortFantasyLeaderboard(col) {
  if (_flSort.col === col) {
    _flSort.asc = !_flSort.asc;
  } else {
    _flSort.col = col;
    _flSort.asc = false;
  }
  filterFantasyLeaderboard();
}

function sortFlData(list) {
  var asc = _flSort.asc;
  var col = _flSort.col;
  list.forEach(function(p) { p.average = p.matches > 0 ? Math.round(p.points/p.matches*10)/10 : 0; });
  list.sort(function(a, b) {
    var av = a[col], bv = b[col];
    if (typeof av === 'string') av = av || '';
    if (typeof bv === 'string') bv = bv || '';
    if (col === 'name' || col === 'bfl_team' || col === 'ipl_team' || col === 'role') {
      return asc ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return asc ? av - bv : bv - av;
  });
}

function renderFlTable(list) {
  var tbody = $id('fantasy-leaderboard-tbody');
  if (!tbody) return;
  var total = list.length;
  var totalPages = Math.ceil(total / _flPerPage);
  var start = (_flPage - 1) * _flPerPage;
  var pageData = list.slice(start, start + _flPerPage);
  var info = $id('fl-info');
  if (info) info.textContent = total > 0 ? 'Showing ' + (start + 1) + '-' + Math.min(start + _flPerPage, total) + ' of ' + total + ' players' : 'No players';
  if (!pageData.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty-state" style="padding:20px;">No player stats yet.</td></tr>'; renderFlPagination(0, 0); return; }
  tbody.innerHTML = pageData.map(function(p, i) {
    var rank = start + i + 1;
    var iplLogo = p.ipl_team ? '<img src="images/teams/'+UI.tCode(p.ipl_team)+'outline.png" style="width:24px;height:24px;object-fit:contain;" alt="'+UI.esc(p.ipl_team)+'">' : '-';
    var bflTeam = p.bfl_team ? UI.tShort(p.bfl_team) : '-';
    var avg = p.matches > 0 ? Math.round(p.points/p.matches*10)/10 : 0;
    return '<tr>' +
      '<td style="font-weight:700;text-align:center;' + (rank<=3?'color:var(--gold);':'') + '">' + rank + '</td>' +
      '<td style="text-align:center;">' + iplLogo + '</td>' +
      '<td style="font-weight:600;">' + UI.esc(p.name) + ' ' + UI.roleBadge(p.role) + '</td>' +
      '<td style="text-align:center;"><span class="clickable-team" style="background:var(--bg3);padding:2px 8px;border-radius:3px;font-size:10px;cursor:pointer;color:var(--accent);" onclick="jumpToUserTeams(\'' + UI.esc(p.bfl_team || '') + '\')">' + UI.esc(bflTeam) + '</span></td>' +
      '<td style="font-weight:700;color:var(--accent);text-align:center;">' + p.points + '</td>' +
      '<td style="text-align:center;">' + p.matches + '</td>' +
      '<td style="text-align:center;">' + avg + '</td>' +
    '</tr>';
  }).join('');
  renderFlPagination(total, totalPages);
}

function renderFlPagination(total, totalPages) {
  var container = $id('fl-pagination');
  if (!container) return;
  if (total === 0) { container.innerHTML = ''; return; }
  var html = '<button class="btn btn-ghost btn-sm" ' + (_flPage <= 1 ? 'disabled' : 'onclick="setFlPage(1)"') + '>‹ Prev</button>';
  var startPage = Math.max(1, _flPage - 2);
  var endPage = Math.min(totalPages, _flPage + 2);
  if (startPage > 1) { html += '<button class="btn btn-ghost btn-sm" onclick="setFlPage(1)">1</button>'; if (startPage > 2) html += '<span style="padding:0 4px;">…</span>'; }
  for (var i = startPage; i <= endPage; i++) {
    html += '<button class="btn ' + (i === _flPage ? 'btn-accent' : 'btn-ghost') + ' btn-sm" onclick="setFlPage(' + i + ')">' + i + '</button>';
  }
  if (endPage < totalPages) { if (endPage < totalPages - 1) html += '<span style="padding:0 4px;">…</span>'; html += '<button class="btn btn-ghost btn-sm" onclick="setFlPage(' + totalPages + ')">' + totalPages + '</button>'; }
  html += '<button class="btn btn-ghost btn-sm" ' + (_flPage >= totalPages ? 'disabled' : 'onclick="setFlPage(' + (_flPage + 1) + ')"') + '>Next ›</button>';
  container.innerHTML = html;
}

function setFlPage(page) {
  _flPage = page;
  var s = $id('fl-search');
  var it = $id('fl-ipl-team');
  var rl = $id('fl-role');
  var bt = $id('fl-bfl-team');
  var q = s ? s.value : '';
  var iplTeam = it ? it.value.trim() : '';
  var role = rl ? rl.value.trim() : '';
  var bflTeam = bt ? bt.value : '';
  var roleMap = { 'BAT': ['BAT','BATTER','BATTING'], 'BOW': ['BOW','BOWLER','BOWLING'], 'AR': ['AR','ALLROUNDER','ALL-ROUNDER'], 'WK': ['WK','WICKETKEEPER','WICKET-KEEPER','WICKET KEEPER'] };
  var roleVals = roleMap[role] || [role];
  var filtered = _flData.filter(function(p) {
    if (q && !(p.name||'').toLowerCase().includes(q.toLowerCase())) return false;
    if (iplTeam && p.ipl_team !== iplTeam && UI.tCode(iplTeam) !== p.ipl_team) return false;
    if (role && p.role && !roleVals.some(function(r) { return p.role.toUpperCase().indexOf(r) >= 0; })) return false;
    if (bflTeam) {
      var pb = p.bfl_team || '';
      if (pb.toUpperCase() !== bflTeam.toUpperCase()) return false;
    }
    return true;
  });
  sortFlData(filtered);
  renderFlTable(filtered);
}

/* ══════════════════════════════════════════════════════════════
   USER TEAMS OVERVIEW
══════════════════════════════════════════════════════════════ */
async function loadUserTeams() {
  var tbody = $id('user-teams-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6"><div class="skel skel-row" style="margin:8px;"></div></td></tr>';
  try {
    var teams = safeArr(await API.fetchAllFantasyTeams());
    if (!teams.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-state" style="padding:20px;">No fantasy teams found.</td></tr>'; return; }
    var allPlayers = safeArr(await API.fetchAllPlayers());
    var playerMap = {}; allPlayers.forEach(function(p) { playerMap[p.id] = p; });
    var squadData = safeArr(await API.fetchSquadPlayersAll());
    var squadByTeam = {};
    squadData.forEach(function(sp) {
      if (!squadByTeam[sp.fantasy_team_id]) squadByTeam[sp.fantasy_team_id] = [];
      squadByTeam[sp.fantasy_team_id].push({ ...sp, player: playerMap[sp.player_id] });
    });
    tbody.innerHTML = teams.map(function(t,i) {
      var sps = squadByTeam[t.id] || [];
      var captain = sps.find(function(p) { return p.is_captain === true; });
      var vc = sps.find(function(p) { return p.is_vc === true; });
      var impact = sps.find(function(p) { return p.is_impact === true; });
      var playerCount = sps.filter(function(p) { return p.is_released !== true; }).length;
      return '<tr style="animation:row-in .2s ease ' + (i*.02) + 's both;">' +
        '<td style="font-size:12px;">' + UI.esc(t.owner_name || '-') + '</td>' +
        '<td style="font-weight:600;"><span class="clickable-team" style="cursor:pointer;color:var(--accent);" onclick="jumpToSquadManagement(\'' + t.id + '\')">' + UI.esc(UI.tShort(t.team_name)) + '</span></td>' +
        '<td>' + (captain ? UI.esc(captain.player?.name || '-') : '-') + '</td>' +
        '<td>' + (vc ? UI.esc(vc.player?.name || '-') : '-') + '</td>' +
        '<td>' + (impact ? UI.esc(impact.player?.name || '-') : '-') + '</td>' +
        '<td>' + playerCount + '</td>' +
      '</tr>';
    }).join('');
  } catch(e) { tbody.innerHTML = '<tr><td colspan="6" style="color:var(--red);padding:12px;">' + UI.esc(e.message) + '</td></tr>'; }
}

/* ══════════════════════════════════════════════════════════════
   PREDICTION ACCURACY
═════════════════════════════════════════════════════════════ */
async function loadPredictionAccuracy() {
  var byMatch = $id('accuracy-by-match');
  var overall = $id('accuracy-overall');
  var teamLeaderboard = $id('accuracy-team-leaderboard');
  if (!byMatch || !overall) return;
  byMatch.innerHTML = '<div class="skel skel-row"></div>';
  overall.innerHTML = '';
  if (teamLeaderboard) teamLeaderboard.innerHTML = '<div class="skel skel-row"></div>';
  try {
    var preds = safeArr(await API.fetchAllPredictionsAllMatches());
    var matches = _matches.filter(function(m) { return m.status === 'completed' || m.status === 'processed'; });
    var matchStats = [];
    matches.forEach(function(m) {
      var matchPreds = preds.filter(function(p) { return String(p.match_id) === String(m.id); });
      var correct = matchPreds.filter(function(p) { return p.predicted_winner === m.winner; }).length;
      var total = matchPreds.length;
      matchStats.push({ match: m, correct: correct, total: total, pct: total > 0 ? Math.round(correct/total*100) : 0 });
    });
    if (!matchStats.length) {
      byMatch.innerHTML = '<div class="empty-state" style="padding:20px;">No completed matches yet.</div>';
      overall.innerHTML = '<div class="empty-state">No data</div>';
      return;
    }
    var sortedStats = matchStats.slice().sort(function(a,b) { return (b.match.match_no||0) - (a.match.match_no||0); });
    byMatch.innerHTML = '<div style="display:flex;flex-direction:column;gap:8px;">' + sortedStats.map(function(m) {
      var color = m.pct >= 70 ? 'var(--green)' : m.pct >= 40 ? 'var(--gold)' : 'var(--red)';
      return '<div style="display:flex;align-items:center;gap:10px;font-size:12px;"><span style="width:80px;">Match ' + m.match.match_no + '</span><div style="flex:1;background:var(--bg3);height:20px;border-radius:3px;overflow:hidden;"><div style="width:' + m.pct + '%;background:' + color + ';height:100%;"></div></div><span style="width:50px;text-align:center;color:' + color + ';">' + m.correct + '/' + m.total + '</span></div>';
    }).join('') + '</div>';
    var totalCorrect = matchStats.reduce(function(s,m) { return s + m.correct; }, 0);
    var totalPreds = matchStats.reduce(function(s,m) { return s + m.total; }, 0);
    var overallPct = totalPreds > 0 ? Math.round(totalCorrect / totalPreds * 100) : 0;
    overall.innerHTML = '<div class="kpi-chip"><div class="kpi-label">Overall Accuracy</div><div class="kpi-value" style="color:var(--accent);">' + overallPct + '%</div></div>' +
      '<div class="kpi-chip"><div class="kpi-label">Correct Predictions</div><div class="kpi-value">' + totalCorrect + '</div></div>' +
      '<div class="kpi-chip"><div class="kpi-label">Total Predictions</div><div class="kpi-value">' + totalPreds + '</div></div>' +
      '<div class="kpi-chip"><div class="kpi-label">Matches Analyzed</div><div class="kpi-value">' + matchStats.length + '</div></div>';
    var teamStats = {};
    var teamMap = {};
    _teams.forEach(function(t) { teamMap[t.fantasy_team_id] = t.team && t.team.team_name; });
    preds.forEach(function(p) {
      if (!teamStats[p.fantasy_team_id]) teamStats[p.fantasy_team_id] = { correct: 0, total: 0 };
      var match = matches.find(function(m) { return String(m.id) === String(p.match_id); });
      if (match) {
        teamStats[p.fantasy_team_id].total++;
        if (p.predicted_winner === match.winner) teamStats[p.fantasy_team_id].correct++;
      }
    });
    var teamList = [];
    for (var tid in teamStats) {
      var teamName = teamMap[tid] || tid;
      teamList.push({ id: tid, name: teamName, correct: teamStats[tid].correct, total: teamStats[tid].total, pct: teamStats[tid].total > 0 ? Math.round(teamStats[tid].correct/teamStats[tid].total*100) : 0 });
    }
    teamList.sort(function(a,b) { return b.pct - a.pct; });
    if (teamLeaderboard) {
      teamLeaderboard.innerHTML = teamList.length ? '<div style="display:flex;flex-direction:column;gap:6px;font-size:12px;">' + teamList.map(function(t, i) {
        var color = t.pct >= 70 ? 'var(--green)' : t.pct >= 40 ? 'var(--gold)' : 'var(--red)';
        return '<div style="display:flex;align-items:center;gap:8px;"><span style="width:20px;font-weight:700;color:var(--text2);">' + (i+1) + '</span><span style="flex:1;">' + UI.esc(UI.tShort(t.name)) + '</span><span style="color:' + color + ';">' + t.correct + '/' + t.total + ' (' + t.pct + '%)</span></div>';
      }).join('') + '</div>' : '<div class="empty-state">No team data</div>';
    }
  } catch(e) { byMatch.innerHTML = '<div style="color:var(--red);padding:12px;">' + UI.esc(e.message) + '</div>'; }
}

/* ══════════════════════════════════════════════════════════════
   MATCH PREDICTIONS PANEL (Team-wise)
═════════════════════════════════════════════════════════════ */
async function loadMatchPredictionsPanel() {
  var sel = $id('mp-team-select');
  if (!sel) return;
  var teams = safeArr(await API.fetchAllTeamPoints());
  if (sel.options.length <= 1) {
    sel.innerHTML = '<option value="">— Select BFL Team —</option>' + 
      teams.map(function(t) {
        return '<option value="' + t.id + '">' + UI.esc(UI.tShort(t.team_name)) + '</option>';
      }).join('');
  }
  loadTeamMatchPredictions();
}

async function loadTeamMatchPredictions() {
  var list = $id('team-preds-list');
  var stats = $id('team-preds-stats');
  if (!list || !stats) return;
  var teamId = $id('mp-team-select') ? $id('mp-team-select').value : null;
  if (!teamId) { list.innerHTML = '<div class="empty-state" style="padding:20px;">Select a BFL Team</div>'; return; }
  list.innerHTML = '<div class="skel skel-row"></div>';
  stats.innerHTML = '';
  try {
    var preds = safeArr(await API.fetchAllPredictionsAllMatches());
    var teamPreds = preds.filter(function(p) { return p.fantasy_team_id === teamId; });
    var teamInfo = await API.fetchAllTeamPoints();
    var tInfo = teamInfo.find(function(t) { return t.id === teamId; });
    if (!teamPreds.length) { list.innerHTML = '<div class="empty-state" style="padding:20px;">No predictions by this team.</div>'; return; }
    teamPreds.sort(function(a,b) {
      var ma = _matches.find(function(m) { return m.id === a.match_id; });
      var mb = _matches.find(function(m) { return m.id === b.match_id; });
      return (mb.match_no||0) - (ma.match_no||0);
    });
    list.innerHTML = teamPreds.map(function(p,i) {
      var match = _matches.find(function(m) { return m.id === p.match_id; });
      if (!match) return '';
      var isCorrect = match.winner && p.predicted_winner === match.winner;
      var isAbandoned = match.status === 'abandoned';
      var matchStatus = match.status === 'completed' || match.status === 'processed';
      var targetBadge = '';
      if (matchStatus && match.actual_target && p.target_score) {
        var diff = Math.abs(p.target_score - match.actual_target);
        if (diff === 0) { targetBadge = '<span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;background:var(--cyan);color:var(--bg1);border-radius:50%;font-size:9px;font-weight:700;">✓</span>'; }
        else if (diff <= 10) { targetBadge = '<span style="display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:24px;background:var(--green);color:var(--bg1);border-radius:12px;font-size:10px;font-weight:700;padding:0 4px;">±' + diff + '</span>'; }
        else { targetBadge = '<span style="display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:24px;background:var(--red);color:var(--bg1);border-radius:12px;font-size:10px;font-weight:700;padding:0 4px;">±' + diff + '</span>'; }
      }
      var predVsActual = matchStatus ? 
        '<div style="font-size:11px;color:var(--text2);display:flex;align-items:center;gap:8px;">' + (match.actual_target ? '<span>Pred: ' + p.target_score + ' | Actual: ' + match.actual_target + '</span>' : '<span>Target: ' + (p.target_score || '-') + '</span>') + (targetBadge || '') + '</div>' :
        '<div style="font-size:11px;color:var(--text2);">Target: ' + (p.target_score || '-') + '</div>';
      var statusText = isAbandoned ? 'Abandoned' : (isCorrect ? '✓ Correct' : (matchStatus ? '✗ Wrong' : 'Pending'));
      var statusColor = isAbandoned ? 'var(--orange);' : (isCorrect ? 'var(--green);' : (matchStatus ? 'var(--red);' : 'var(--text3);'));
      return '<div style="padding:10px 16px;border-bottom:1px solid var(--border);animation:row-in .2s ease ' + (i*.02) + 's both;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;">' +
          '<div><div style="font-weight:600;">M' + (match.match_no||'?') + ': ' + UI.tShort(match.team1) + ' vs ' + UI.tShort(match.team2) + '</div>' + predVsActual + '</div>' +
          '<div style="text-align:right;"><span style="font-weight:700;color:' + statusColor + '">' + statusText + '</span></div>' +
        '</div>' +
        '<div style="font-size:10px;color:var(--text3);margin-top:4px;">' +
          'Predicted: ' + UI.esc(p.predicted_winner || '-') + (match.winner ? ' | Winner: ' + UI.esc(match.winner) : (isAbandoned ? ' | Match Abandoned' : '')) +
        '</div>' +
      '</div>';
    }).join('');
    var correctCount = 0, incorrectCount = 0, abandonedCount = 0, totalDiff = 0, diffCount = 0;
    var currentStreak = 0, maxStreak = 0, currentWrongStreak = 0, maxWrong = 0;
    var sortedPreds = teamPreds.slice().sort(function(a,b) {
      var ma = _matches.find(function(m) { return m.id === a.match_id; });
      var mb = _matches.find(function(m) { return m.id === b.match_id; });
      return (mb.match_no||0) - (ma.match_no||0);
    });
    sortedPreds.forEach(function(p) {
      var match = _matches.find(function(m) { return String(m.id) === String(p.match_id) });
      if (!match) return;
      if (match.actual_target && p.target_score && (match.status === 'completed' || match.status === 'processed')) {
        totalDiff += Math.abs((p.target_score||0) - (match.actual_target||0));
        diffCount++;
      }
      if (match.status === 'abandoned') { abandonedCount++; }
      else if (match.winner && p.predicted_winner === match.winner) { correctCount++; currentStreak++; maxStreak = Math.max(maxStreak, currentStreak); currentWrongStreak = 0; }
      else if (match.status === 'completed' || match.status === 'processed') { incorrectCount++; currentWrongStreak++; maxWrong = Math.max(maxWrong, currentWrongStreak); currentStreak = 0; }
      else { currentStreak = 0; currentWrongStreak = 0; }
    });
    var completedCount = correctCount + incorrectCount;
    var accuracy = completedCount > 0 ? Math.round(correctCount / completedCount * 100) : 0;
    var avgDiff = diffCount > 0 ? Math.round(totalDiff / diffCount) : 0;
    var teamCode = tInfo ? UI.tCode(tInfo.team_name) : '';
    var logoUrl = teamCode ? 'images/teams/' + teamCode + 'outline.png' : '';
    stats.innerHTML = '<div style="position:relative;padding:16px;border-radius:var(--radius-md);">' +
      (logoUrl ? '<img src="' + logoUrl + '" style="position:absolute;right:-10px;bottom:-10px;width:120px;opacity:0.15;pointer-events:none;">' : '') +
      '<div class="kpi-grid" style="grid-template-columns:repeat(2,1fr);position:relative;z-index:1;">' +
      '<div class="kpi-chip"><div class="kpi-label">Total Preds</div><div class="kpi-value" style="font-size:18px;">' + teamPreds.length + '</div></div>' +
      '<div class="kpi-chip"><div class="kpi-label">Accuracy</div><div class="kpi-value" style="font-size:18px;color:var(--cyan);">' + (completedCount > 0 ? accuracy + '%' : '-') + '</div></div>' +
      '<div class="kpi-chip"><div class="kpi-label">Correct</div><div class="kpi-value" style="color:var(--green);">' + correctCount + '</div></div>' +
      '<div class="kpi-chip"><div class="kpi-label">Incorrect</div><div class="kpi-value" style="color:var(--red);">' + incorrectCount + '</div></div>' +
      '<div class="kpi-chip"><div class="kpi-label">Abandoned</div><div class="kpi-value" style="color:var(--text3);">' + abandonedCount + '</div></div>' +
      '<div class="kpi-chip"><div class="kpi-label">Avg Target Diff</div><div class="kpi-value" style="color:var(--gold);">' + (diffCount > 0 ? '±' + avgDiff : '-') + '</div></div>' +
      '<div class="kpi-chip"><div class="kpi-label">Best WT Streak</div><div class="kpi-value" style="color:var(--green);">' + maxStreak + '</div></div>' +
      '<div class="kpi-chip"><div class="kpi-label">Worst WT Streak</div><div class="kpi-value" style="color:var(--red);">' + maxWrong + '</div></div>' +
      '</div>' +
    '</div>';
  } catch(e) { list.innerHTML = '<div style="color:var(--red);padding:12px;">' + UI.esc(e.message) + '</div>'; }
}

/* ══════════════════════════════════════════════════════════════
   POWER RANKINGS
═════════════════════════════════════════════════════════════ */
async function loadPowerRankings() {
  var tbody = $id('power-rankings-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5"><div class="skel skel-row" style="margin:8px;"></div></td></tr>';
  try {
    var teams = safeArr(await API.fetchAllTeamPoints());
    var preds = safeArr(await API.fetchAllPredictionsAllMatches());
    var matches = _matches.filter(function(m) { return m.status === 'completed' || m.status === 'processed'; });
    var completedMatchIds = matches.map(function(m) { return m.id; });
    var userStats = {};
    teams.forEach(function(t) {
      var uid = t.id;
      if (!userStats[uid]) { userStats[uid] = { teamName: UI.tShort(t.team_name), fantasyPoints: t.total_points || 0, correctPreds: 0, totalPreds: 0 }; }
      else { userStats[uid].fantasyPoints = Math.max(userStats[uid].fantasyPoints, t.total_points || 0); }
    });
    preds.forEach(function(p) {
      if (p.fantasy_team_id && userStats[p.fantasy_team_id] && p.match_id && completedMatchIds.includes(p.match_id)) {
        var match = matches.find(function(m) { return m.id === p.match_id; });
        userStats[p.fantasy_team_id].totalPreds++;
        if (match && match.winner && p.predicted_winner === match.winner) {
          userStats[p.fantasy_team_id].correctPreds++;
        }
      }
    });
    var rankings = Object.values(userStats).map(function(u) {
      var predAcc = u.totalPreds > 0 ? u.correctPreds / u.totalPreds : 0;
      var fantasyNorm = u.fantasyPoints / 1000;
      var combined = Math.round((predAcc * 50 + fantasyNorm * 50) * 100) / 100;
      return { teamName: u.teamName, predAcc: Math.round(predAcc * 100), fantasyPoints: u.fantasyPoints, combined: combined };
    });
    rankings.sort(function(a,b) { return b.combined - a.combined; });
    if (!rankings.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty-state" style="padding:20px;">No data yet.</td></tr>'; return; }
    tbody.innerHTML = rankings.slice(0, 20).map(function(r,i) {
      return '<tr style="animation:row-in .2s ease ' + (i*.02) + 's both;">' +
        '<td style="font-weight:700;' + (i<3?'color:var(--gold);':'') + '">' + (i+1) + '</td>' +
        '<td style="font-weight:600;">' + UI.esc(r.teamName || '-') + '</td>' +
        '<td>' + r.predAcc + '%</td>' +
        '<td style="font-weight:700;">' + r.fantasyPoints + '</td>' +
        '<td style="font-weight:700;color:var(--accent);">' + r.combined + '</td>' +
      '</tr>';
    }).join('');
  } catch(e) { tbody.innerHTML = '<tr><td colspan="5" style="color:var(--red);padding:12px;">' + UI.esc(e.message) + '</td></tr>'; }
}

/* ══════════════════════════════════════════════════════════════
   LOGOUT
═════════════════════════════════════════════════════════════ */
async function doLogout() { await Auth.signOut(); }

/* ══════════════════════════════════════════════════════════════
   BOOT
══════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════
   NAVIGATION HELPERS
   ══════════════════════════════════════════════════════════════ */
function jumpToUserTeams(teamName) {
  if (!teamName) return;
  showPanel('user-teams');
}
function jumpToSquadManagement(teamId) {
  if (!teamId) return;
  showPanel('squads');
  var sel = $id('sq-team-select');
  if (sel) {
    sel.value = teamId;
    var event = new Event('change');
    sel.dispatchEvent(event);
  }
}

init();