'use strict';
// ─────────────────────────────────────────────────────────────
//  admin.js — BFL Fantasy IPL 2026  Full Admin Controller
// ─────────────────────────────────────────────────────────────

/* ══ CONSTANTS ══════════════════════════════════════════════ */
var TEAMS = ['CHENNAI SUPER KINGS','DELHI CAPITALS','GUJARAT TITANS',
  'KOLKATA KNIGHT RIDERS','LUCKNOW SUPER GIANTS','MUMBAI INDIANS',
  'PUNJAB KINGS','RAJASTHAN ROYALS','ROYAL CHALLENGERS BENGALURU',
  'SUNRISERS HYDERABAD','SUPREME RAJAS'];

var CODES = {
  CHENNAISUPERKINGS:'CSK', DELHICAPITALS:'DC', GUJARATTITANS:'GT',
  KOLKATAKNIGHTRIDERS:'KKR', LUCKNOWSUPERGIANTS:'LSG', MUMBAIINDIANS:'MI',
  PUNJABKINGS:'PBKS', RAJASTHANROYALS:'RR', ROYALCHALLENGERSBENGALURU:'RCB',
  SUNRISERSHYDERABAD:'SRH', SUPREMERAJAS:'SURA'
};
var TCOLS = {
  CSK:'#fdb913', MI:'#004ba0', RCB:'#da1818', KKR:'#6a1bac',
  SRH:'#f26522', DC:'#004c93', PBKS:'#ed1b24', RR:'#ea1a85',
  GT:'#1c2c5b', LSG:'#ff002b', SURA:'#1a3a8a'
};
var ACTION_COLORS = {
  stat_entry:'#60a5fa', match_edit:'#c8f135', adjustment:'#f5c842',
  injury_set:'#f87171', replacement_created:'#38d9f5', blog_published:'#34d399',
  match_abandoned:'#a78bfa', deadline_extended:'#fbbf24', dls_target_set:'#fbbf24',
  prediction_submitted:'#94a3b8', predictions_reopened:'#38d9f5'
};

/* ══ STATE ═══════════════════════════════════════════════════ */
var _allMatches     = [];
var _allPlayers     = [];
var _allTeams       = [];
var _selectedFixture= null;
var _statsMatchId   = null;
var _statsPlayerId  = null;
var _ctrlMatchId    = null;
var _blogFilter     = 'all';
var _squadEdits     = {}; // teamId -> {captainId, vcId, impactId}

/* ══ UTILS ═══════════════════════════════════════════════════ */
function tCode(n)  { return CODES[(n||'').toUpperCase().replace(/\s+/g,'')] || null; }
function tLogo(n)  { var c = tCode(n); return c ? 'images/teams/'+c+'outline.png' : ''; }
function tShort(n) { var c = tCode(n); return c || (n||'').split(' ').map(function(w){return w[0];}).join('').toUpperCase(); }
function tColor(n) { var c = tCode(n); return c && TCOLS[c] ? TCOLS[c] : 'var(--accent)'; }
function safeArr(v){ return Array.isArray(v) ? v : (v ? [v] : []); }

function calcLog(msg, type) {
  var log = document.getElementById('calc-log');
  if (!log) return;
  var line = document.createElement('div');
  line.className = 'calc-log-line ' + (type||'');
  line.textContent = '[' + new Date().toLocaleTimeString('en-IN') + '] ' + msg;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

function ctrlLog(msg, type) {
  var el = document.getElementById('ctrl-log');
  if (!el) return;
  var col = type==='ok' ? 'var(--green)' : type==='err' ? 'var(--red)' : 'var(--text2)';
  el.innerHTML = '<div style="'+col+';font-size:13px;padding:10px 14px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;">'+UI.esc(msg)+'</div>';
}

/* ══ INIT ════════════════════════════════════════════════════ */
async function init() {
  try {
    var sess = await Auth.requireAuth();
    if (!sess) return;
    if (!Auth.isAdmin(sess.user)) { window.location.href = 'dashboard.html'; return; }

    await initNavbar('admin');

    // Load core data
    await Promise.all([loadAllPlayers(), loadAllMatches(), loadAllTeams()]);
    populateTeamDropdowns();
    populateMatchDropdowns();

    // Initial panel
    await loadDashboard();

    // Sidebar hamburger for mobile
    var toggle = document.getElementById('sb-toggle');
    if (toggle) toggle.onclick = function() {
      document.getElementById('admin-sidebar').classList.toggle('open');
    };
  } catch(err) {
    console.error('[admin init]', err);
    UI.toast('Init failed: ' + err.message, 'error');
  }
}

/* ══ PANEL ROUTER ════════════════════════════════════════════ */
function showPanel(id) {
  document.querySelectorAll('.admin-panel').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.admin-nav-link').forEach(function(l) { l.classList.remove('active'); });

  var panel = document.getElementById('panel-' + id);
  if (panel) panel.classList.add('active');

  var link = document.querySelector('.admin-nav-link[onclick*="' + id + '"]');
  if (link) link.classList.add('active');

  // Lazy-load panel data
  var loaders = {
    dashboard:      loadDashboard,
    fixtures:       renderFixtureList,
    results:        loadResultsPanel,
    'match-controls': loadMatchCtrlPanel,
    stats:          loadStatsPanel,
    calculate:      loadCalcPanel,
    overrides:      function() { loadAdjustments(); populateOvrDropdowns(); },
    injuries:       loadInjuries,
    squads:         loadSquadsPanel,
    blogs:          loadBlogList,
    users:          loadUsers,
    audit:          loadAuditLog,
  };
  if (loaders[id]) loaders[id]();

  // Mobile: close sidebar after nav
  if (window.innerWidth < 900) {
    document.getElementById('admin-sidebar').classList.remove('open');
  }
}

/* ══ DATA LOADERS ════════════════════════════════════════════ */
async function loadAllPlayers() {
  _allPlayers = await API.fetchAllPlayers();
}
async function loadAllMatches() {
  _allMatches = safeArr(await API.fetchMatches({ limit: 74 }));
}
async function loadAllTeams() {
  var lb = await API.fetchLeaderboard();
  _allTeams = lb;
}

function populateTeamDropdowns() {
  var teamOpts = '<option value="">— Select team —</option>' +
    _allTeams.map(function(r) {
      return '<option value="'+r.fantasy_team_id+'">'+UI.esc(r.team ? r.team.team_name : '—')+'</option>';
    }).join('');
  ['ovr-team-sel', 'rep-team-sel', 'squad-team-sel'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = teamOpts;
  });
}

function populateMatchDropdowns() {
  var mOpts = '<option value="">— Select match —</option>' +
    _allMatches.map(function(m) {
      var label = 'M'+(m.match_no||'') + ' · ' + tShort(m.team1) + ' vs ' + tShort(m.team2) + ' · ' + UI.shortDate(m.match_date);
      var suffix = m.status==='abandoned' ? ' ☔' : m.is_locked ? ' 🔒' : ' ●';
      return '<option value="'+m.id+'">'+label+suffix+'</option>';
    }).join('');

  ['stats-match-sel','calc-match-sel','ovr-match-sel','ctrl-match-sel','res-match-sel'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var cur = el.value;
    el.innerHTML = (id === 'ovr-match-sel') ? '<option value="">— Season-wide —</option>' + _allMatches.map(function(m){
      return '<option value="'+m.id+'">M'+(m.match_no||'')+' · '+tShort(m.team1)+' vs '+tShort(m.team2)+'</option>';
    }).join('') : mOpts;
    if (cur) el.value = cur;
  });

  // PoM player
  var pomSel = document.getElementById('res-pom');
  if (pomSel) {
    pomSel.innerHTML = '<option value="">— Select —</option>' +
      _allPlayers.map(function(p) {
        return '<option value="'+p.id+'">'+UI.esc(p.name)+' · '+UI.esc(p.ipl_team||'?')+'</option>';
      }).join('');
  }
}

/* ══ DASHBOARD ═══════════════════════════════════════════════ */
async function loadDashboard() {
  var now = new Date();
  document.getElementById('dash-greeting').textContent =
    now.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'}) + ' · BFL Admin';

  try {
    var [lb, matches] = await Promise.all([API.fetchLeaderboard(), API.fetchMatches({limit:74})]);
    var total    = matches.length;
    var locked   = matches.filter(function(m){return m.is_locked;}).length;
    var abandoned= matches.filter(function(m){return m.status==='abandoned';}).length;
    var pending  = matches.filter(function(m){return m.is_locked && m.winner && !m.status==='processed';});
    var upcoming = matches.filter(function(m){return !m.is_locked && m.status !== 'abandoned';});

    // Pending = locked with winner but no points_log yet — approximate via locked count
    var pendingCalc = matches.filter(function(m){
      return m.is_locked && m.winner && m.status !== 'processed' && m.status !== 'abandoned';
    }).length;

    var cards = [
      { val: total, lbl: 'Total Matches', sub: upcoming.length + ' upcoming', color: 'var(--accent)' },
      { val: locked, lbl: 'Completed', sub: abandoned + ' abandoned', color: 'var(--cyan)' },
      { val: pendingCalc, lbl: 'Pending Calc', sub: 'Need points entry', color: pendingCalc ? 'var(--red)' : 'var(--green)' },
      { val: lb.length, lbl: 'Teams', sub: 'Registered', color: 'var(--gold)' },
      { val: _allPlayers.length, lbl: 'Players', sub: 'In player pool', color: 'var(--purple)' },
      { val: matches.filter(function(m){return !m.is_locked;}).length, lbl: 'Open Predictions', sub: '', color: 'var(--green)' },
    ];

    document.getElementById('overview-cards').innerHTML = cards.map(function(c) {
      return '<div class="overview-card" style="--oc-color:'+c.color+'">'+
        '<div class="overview-card-val">'+c.val+'</div>'+
        '<div class="overview-card-lbl">'+c.lbl+'</div>'+
        (c.sub ? '<div class="overview-card-sub">'+c.sub+'</div>' : '')+
      '</div>';
    }).join('');

    // Upcoming
    var upEl = document.getElementById('dash-upcoming');
    if (!upcoming.length) {
      upEl.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:12px 0;">No upcoming matches.</div>';
    } else {
      upEl.innerHTML = upcoming.slice(0,5).map(function(m) {
        return '<div class="fixture-admin-row" onclick="showPanel(\'fixtures\')">'+
          '<div class="fx-match-label">'+
            '<div class="fx-match-title">M'+(m.match_no||'')+' · '+UI.esc(tShort(m.team1)+' vs '+tShort(m.team2))+'</div>'+
            '<div class="fx-match-sub">'+UI.fmtDate(m.match_date)+(m.venue?' · '+UI.esc(m.venue):'')+'</div>'+
          '</div>'+
          '<span class="match-status status-open" style="font-size:10px;">Open</span>'+
        '</div>';
      }).join('');
    }

    // Pending calc
    var pendEl = document.getElementById('dash-pending');
    var pendMatches = matches.filter(function(m){
      return m.is_locked && m.winner && m.status !== 'processed' && m.status !== 'abandoned';
    });
    if (!pendMatches.length) {
      pendEl.innerHTML = '<div style="color:var(--green);font-size:13px;padding:12px 0;">✓ All locked matches have been calculated.</div>';
    } else {
      pendEl.innerHTML = pendMatches.slice(0,5).map(function(m) {
        return '<div class="fixture-admin-row" onclick="showPanel(\'calculate\')">'+
          '<div class="fx-match-label">'+
            '<div class="fx-match-title">M'+(m.match_no||'')+' · '+UI.esc(m.team1)+' vs '+UI.esc(m.team2)+'</div>'+
            '<div class="fx-match-sub">Winner: '+UI.esc(m.winner||'—')+' · Target: '+(m.actual_target||'—')+'</div>'+
          '</div>'+
          '<span class="pending-dot"></span>'+
        '</div>';
      }).join('');
    }

    // Top 5
    document.getElementById('dash-leaderboard').innerHTML =
      lb.slice(0,5).map(function(r,i) {
        var medals = {1:'🥇',2:'🥈',3:'🥉'};
        return '<div class="user-row">'+
          '<div class="user-avatar-sm" style="font-size:14px;">'+(medals[r.rank]||r.rank)+'</div>'+
          '<div style="flex:1;font-family:var(--f-ui);font-weight:700;font-size:13px;">'+UI.esc(r.team?r.team.team_name:'—')+'</div>'+
          '<div style="font-family:var(--f-display);font-weight:900;font-size:16px;color:var(--accent);">'+r.total_points+'</div>'+
        '</div>';
      }).join('');

    // Recent audit
    var logs = await API.fetchActionLog({limit:5});
    document.getElementById('dash-audit').innerHTML = logs.length
      ? logs.map(function(l) {
          var col = ACTION_COLORS[l.action_type] || 'var(--text2)';
          return '<div class="user-row">'+
            '<div style="background:'+col+'22;color:'+col+';font-size:9px;font-weight:700;padding:2px 7px;border-radius:3px;font-family:var(--f-ui);flex-shrink:0;">'+UI.esc(l.action_type)+'</div>'+
            '<div style="flex:1;font-size:12px;color:var(--text2);">'+UI.esc(l.entity_type)+' '+UI.esc((l.entity_id||'').substring(0,8))+'…</div>'+
            '<div style="font-size:11px;color:var(--text3);">'+UI.shortDate(l.created_at)+'</div>'+
          '</div>';
        }).join('')
      : '<div style="color:var(--text3);font-size:13px;padding:12px 0;">No actions yet.</div>';

  } catch(e) {
    UI.toast('Dashboard error: '+e.message,'error');
  }
}

/* ══ FIXTURE MANAGEMENT ══════════════════════════════════════ */
var _allFixtures = [], _fixtureFilter = '';

async function renderFixtureList() {
  await loadAllMatches();
  _allFixtures = _allMatches.slice();
  buildFixtureList();
  buildTeamOpts();
}

function buildFixtureList() {
  var q = _fixtureFilter.toLowerCase();
  var sf = document.getElementById('fixture-status-filter');
  var statusF = sf ? sf.value : '';
  var list = _allFixtures.filter(function(m) {
    var matchText = ('M'+(m.match_no||'')+' '+m.team1+' '+m.team2+' '+(m.venue||'')).toLowerCase();
    return (!q || matchText.includes(q)) && (!statusF || m.status === statusF);
  });

  var cont = document.getElementById('fixture-list');
  if (!list.length) { cont.innerHTML='<div style="padding:20px;text-align:center;color:var(--text3);">No matches found.</div>'; return; }

  cont.innerHTML = list.map(function(m,i) {
    var sCls = m.status==='completed'||m.status==='processed' ? 'status-done' :
               m.status==='abandoned' ? 'status-upcoming' :
               m.is_locked ? 'status-locked' : 'status-open';
    var sTxt = m.status==='abandoned' ? '☔ Abandoned' : m.is_locked ? '🔒 Locked' : '● Open';
    return '<div class="fixture-admin-row" style="animation:row-in .2s ease '+(i*.025)+'s both;" onclick="editFixture(\''+m.id+'\')">'+
      '<span style="font-family:var(--f-mono);font-size:11px;color:var(--text3);min-width:28px;">'+(m.match_no||i+1)+'</span>'+
      '<div class="fx-match-label">'+
        '<div class="fx-match-title">'+UI.esc(tShort(m.team1)+' vs '+tShort(m.team2))+'</div>'+
        '<div class="fx-match-sub">'+UI.shortDate(m.match_date)+(m.venue?' · '+UI.esc(m.venue):'')+'</div>'+
      '</div>'+
      '<span class="match-status '+sCls+'" style="font-size:10px;">'+sTxt+'</span>'+
      '<div class="fx-actions">'+
        '<button class="btn btn-ghost btn-sm" style="padding:3px 8px;font-size:11px;" onclick="event.stopPropagation();editFixture(\''+m.id+'\')">Edit</button>'+
      '</div>'+
    '</div>';
  }).join('');
}

function filterFixtures(q) {
  _fixtureFilter = q || '';
  buildFixtureList();
}

function buildTeamOpts() {
  var opts = '<option value="">— Select —</option>' +
    TEAMS.map(function(t){return '<option value="'+t+'">'+t+'</option>';}).join('');
  ['fx-team1','fx-team2'].forEach(function(id){
    var el = document.getElementById(id); if(el) el.innerHTML = opts;
  });
}

function syncWinnerOpts() {
  var t1 = document.getElementById('fx-team1').value;
  var t2 = document.getElementById('fx-team2').value;
  // used in results panel too
}

function openFixtureModal() { clearFixtureForm(); }

function clearFixtureForm() {
  _selectedFixture = null;
  document.getElementById('fx-id').value = '';
  document.getElementById('fixture-form-title').textContent = 'New Match';
  document.getElementById('fx-delete-btn').style.display = 'none';
  ['fx-no','fx-date'].forEach(function(id){ var e=document.getElementById(id); if(e) e.value=''; });
  ['fx-team1','fx-team2','fx-venue'].forEach(function(id){ var e=document.getElementById(id); if(e) e.value=''; });
  document.getElementById('fx-time').value = '19:30';
  document.getElementById('fx-autolock').value = '15';
  document.getElementById('fx-status').value = 'upcoming';
}

function editFixture(matchId) {
  var m = _allFixtures.find(function(x){return x.id===matchId;});
  if (!m) return;
  _selectedFixture = m;
  document.getElementById('fx-id').value = m.id;
  document.getElementById('fixture-form-title').textContent = 'Editing M' + (m.match_no||'');
  document.getElementById('fx-delete-btn').style.display = '';
  document.getElementById('fx-no').value = m.match_no || '';
  document.getElementById('fx-team1').value = m.team1 || '';
  document.getElementById('fx-team2').value = m.team2 || '';
  document.getElementById('fx-venue').value = m.venue || '';
  document.getElementById('fx-status').value = m.status || 'upcoming';
  document.getElementById('fx-autolock').value = m.auto_lock_mins || 15;
  if (m.match_date) {
    var dt = new Date(m.match_date);
    document.getElementById('fx-date').value = dt.toLocaleDateString('sv',{timeZone:'Asia/Kolkata'});
    document.getElementById('fx-time').value = String(dt.getHours()).padStart(2,'0')+':'+String(dt.getMinutes()).padStart(2,'0');
  }
  document.getElementById('fx-no').scrollIntoView({behavior:'smooth',block:'nearest'});
}

async function saveFixture() {
  var id     = document.getElementById('fx-id').value;
  var team1  = document.getElementById('fx-team1').value;
  var team2  = document.getElementById('fx-team2').value;
  var date   = document.getElementById('fx-date').value;
  var time   = document.getElementById('fx-time').value || '19:30';
  var no     = parseInt(document.getElementById('fx-no').value||0)||null;
  var venue  = document.getElementById('fx-venue').value;
  var status = document.getElementById('fx-status').value;
  var al     = parseInt(document.getElementById('fx-autolock').value||15);

  if (!team1||!team2) { UI.toast('Select both teams','warn'); return; }
  var matchDate = date ? new Date(date+'T'+time+':00+05:30').toISOString() : null;
  var deadline  = matchDate ? new Date(new Date(matchDate).getTime() - al*60000).toISOString() : null;

  var match = {
    match_title: 'Match '+(no||'') + ' · ' + tShort(team1)+' vs '+tShort(team2),
    match_no: no, team1, team2, venue, status,
    match_date: matchDate, deadline_time: deadline,
    auto_lock_mins: al,
    is_locked: status !== 'upcoming' && status !== 'live',
  };
  if (id) match.id = id;
  try {
    await API.upsertMatch(match);
    UI.toast('Match saved!','success');
    clearFixtureForm();
    await loadAllMatches();
    populateMatchDropdowns();
    renderFixtureList();
  } catch(e) { UI.toast('Save failed: '+e.message,'error'); }
}

async function deleteFixture() {
  var id = document.getElementById('fx-id').value;
  if (!id) return;
  UI.showConfirm({
    icon:'🗑️', title:'Delete Match?',
    msg:'This will permanently delete the fixture and all associated data.',
    consequence:'Cannot be undone. Stats, predictions and points_log entries will remain.',
    okLabel:'Delete', okClass:'btn-danger',
    onOk: async function() {
      try {
        var { error } = await sb.from('matches').delete().eq('id', id);
        if (error) throw error;
        UI.toast('Match deleted','warn');
        clearFixtureForm();
        await loadAllMatches();
        populateMatchDropdowns();
        renderFixtureList();
      } catch(e) { UI.toast(e.message,'error'); }
    }
  });
}

async function loadIPLFixtures() {
  UI.showConfirm({
    icon:'⚡', title:'Load IPL 2026 Fixtures?',
    msg:'Insert the standard IPL schedule. Existing match numbers will be skipped.',
    okLabel:'Load Fixtures', okClass:'btn-accent',
    onOk: async function() {
      UI.toast('Loading fixtures…','info',3000);
      // Default fixture set — can be expanded
      var fixtures = [
        {no:1,home:'KOLKATA KNIGHT RIDERS',away:'ROYAL CHALLENGERS BENGALURU',date:'2026-03-22',time:'19:30',venue:'Kolkata'},
        {no:2,home:'SUNRISERS HYDERABAD',away:'RAJASTHAN ROYALS',date:'2026-03-23',time:'15:30',venue:'Hyderabad'},
        {no:3,home:'DELHI CAPITALS',away:'LUCKNOW SUPER GIANTS',date:'2026-03-23',time:'19:30',venue:'Delhi'},
        {no:4,home:'GUJARAT TITANS',away:'PUNJAB KINGS',date:'2026-03-24',time:'19:30',venue:'Ahmedabad'},
        {no:5,home:'MUMBAI INDIANS',away:'CHENNAI SUPER KINGS',date:'2026-03-25',time:'19:30',venue:'Mumbai'},
      ];
      var loaded=0, skipped=0;
      for(var f of fixtures) {
        if (_allFixtures.find(function(m){return m.match_no===f.no;})) { skipped++; continue; }
        var isoDate = new Date(f.date+'T'+f.time+':00+05:30').toISOString();
        try {
          await API.upsertMatch({
            match_title:'Match '+f.no+' · '+tShort(f.home)+' vs '+tShort(f.away),
            match_no:f.no, team1:f.home, team2:f.away, venue:f.venue,
            match_date:isoDate, is_locked:false, status:'upcoming'
          });
          loaded++;
        } catch(e) { console.warn(e); }
      }
      UI.toast('Loaded '+loaded+' fixtures'+(skipped?' ('+skipped+' skipped)':''),'success');
      await loadAllMatches();
      populateMatchDropdowns();
      renderFixtureList();
    }
  });
}

/* ══ RESULTS PANEL ═══════════════════════════════════════════ */
async function loadResultsPanel() {
  // Populate results match selector with locked/upcoming matches
  var sel = document.getElementById('res-match-sel');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Select match —</option>' +
    _allMatches.map(function(m) {
      return '<option value="'+m.id+'">M'+(m.match_no||'')+' · '+UI.esc(tShort(m.team1)+' vs '+tShort(m.team2))+'</option>';
    }).join('');
}

async function loadResultForm() {
  var matchId = document.getElementById('res-match-sel').value;
  var body = document.getElementById('result-form-body');
  var preview = document.getElementById('result-preview');
  if (!matchId) { body.style.display='none'; preview.innerHTML='<div style="color:var(--text3);font-size:13px;">Select a match.</div>'; return; }

  var m = _allMatches.find(function(x){return x.id===matchId;});
  if (!m) return;

  // Winner options
  var winSel = document.getElementById('res-winner');
  winSel.innerHTML = '<option value="">— Select winner —</option>' +
    [m.team1,m.team2].filter(Boolean).map(function(t){
      return '<option value="'+t+'">'+UI.esc(t)+'</option>';
    }).join('');

  if (m.winner) winSel.value = m.winner;
  if (m.actual_target) document.getElementById('res-target').value = m.actual_target;
  if (m.player_of_match) document.getElementById('res-pom').value = m.player_of_match;
  document.getElementById('res-dls').checked = !!m.is_dls_applied;

  body.style.display = '';
  preview.innerHTML =
    '<div class="card" style="background:var(--bg3);">'+
      '<div style="font-family:var(--f-display);font-size:18px;font-weight:900;margin-bottom:10px;">'+UI.esc(m.team1)+' vs '+UI.esc(m.team2)+'</div>'+
      (m.winner ? '<div style="color:var(--gold);font-size:14px;margin-bottom:4px;">🏆 Winner: <strong>'+UI.esc(m.winner)+'</strong></div>' : '')+
      (m.actual_target ? '<div style="font-size:13px;color:var(--text2);">🎯 Target: <strong>'+m.actual_target+'</strong>'+(m.is_dls_applied?' <span class="dls-badge">DLS</span>':'')+'</div>' : '')+
      '<div style="font-size:12px;color:var(--text3);margin-top:8px;">'+UI.fmtDate(m.match_date)+(m.venue?' · '+m.venue:'')+'</div>'+
    '</div>';
}

async function saveResult() {
  var matchId = document.getElementById('res-match-sel').value;
  var target  = parseInt(document.getElementById('res-target').value||0)||null;
  var winner  = document.getElementById('res-winner').value||null;
  var pom     = document.getElementById('res-pom').value||null;
  var dls     = document.getElementById('res-dls').checked;
  var errEl   = document.getElementById('res-error');
  errEl.textContent = '';

  if (!matchId) { errEl.textContent='Select a match first.'; return; }
  if (!winner)  { errEl.textContent='Select the winner.'; return; }

  UI.showConfirm({
    icon:'🏆', title:'Save Match Result?',
    msg:'Winner: '+winner+(target?'\nTarget: '+target:''),
    consequence:'This will lock the match and enable point calculation.',
    okLabel:'Save Result', okClass:'btn-accent',
    onOk: async function() {
      try {
        var upd = {
          winner, actual_target:target,
          is_locked:true, status:'completed',
          is_dls_applied:dls
        };
        if (pom) upd.player_of_match = pom;
        var {error} = await sb.from('matches').update(upd).eq('id', matchId);
        if (error) throw error;
        await API._log('match_edit','match',matchId,null,upd);
        UI.toast('Result saved!','success');
        await loadAllMatches();
        populateMatchDropdowns();
        loadResultForm();
        loadResultsPanel();
      } catch(e) { errEl.textContent = e.message; UI.toast(e.message,'error'); }
    }
  });
}

/* ══ MATCH CONTROLS ══════════════════════════════════════════ */
async function loadMatchCtrlPanel() {
  var sel = document.getElementById('ctrl-match-sel');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Pick a match —</option>' +
    _allMatches.map(function(m){
      return '<option value="'+m.id+'">M'+(m.match_no||'')+' · '+tShort(m.team1)+' vs '+tShort(m.team2)+' · '+UI.shortDate(m.match_date)+'</option>';
    }).join('');
}

async function loadMatchCtrl() {
  _ctrlMatchId = document.getElementById('ctrl-match-sel').value;
  var cards = document.getElementById('ctrl-cards');
  if (!_ctrlMatchId) { cards.style.display='none'; return; }

  var m = _allMatches.find(function(x){return x.id===_ctrlMatchId;});
  if (!m) return;
  cards.style.display = '';

  var sCls = m.status==='abandoned'?'status-upcoming':m.is_locked?'status-locked':'status-open';
  document.getElementById('ctrl-match-info').innerHTML =
    '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">'+
      '<span style="font-family:var(--f-display);font-weight:900;font-size:18px;">'+UI.esc(m.team1)+' vs '+UI.esc(m.team2)+'</span>'+
      '<span class="match-status '+sCls+'">'+UI.esc(m.status||'unknown')+'</span>'+
      (m.is_dls_applied ? '<span class="dls-badge">🌧 DLS</span>' : '')+
    '</div>'+
    '<div style="font-size:12px;color:var(--text2);margin-top:6px;">'+UI.fmtDate(m.match_date)+(m.venue?' · '+m.venue:'')+'</div>'+
    (m.deadline_time ? '<div style="font-size:11px;color:var(--text3);margin-top:3px;">Deadline: '+UI.fmtDate(m.deadline_time)+'</div>' : '');

  // Pre-fill deadline
  if (m.deadline_time) {
    var d = new Date(m.deadline_time);
    var local = new Date(d - d.getTimezoneOffset()*60000);
    document.getElementById('ctrl-deadline').value = local.toISOString().slice(0,16);
  }
}

async function ctrlExtendDeadline() {
  if (!_ctrlMatchId) return;
  var val = document.getElementById('ctrl-deadline').value;
  if (!val) { UI.toast('Enter a new deadline','warn'); return; }
  var isoIST = new Date(val+':00+05:30').toISOString();
  UI.showConfirm({
    icon:'⏰', title:'Extend Deadline?',
    msg:'New deadline: '+new Date(isoIST).toLocaleString('en-IN'),
    consequence:'Lock time will be set to deadline + 5 min.',
    okLabel:'Extend', okClass:'btn-accent',
    onOk: async function(){
      try {
        await API.extendDeadline(_ctrlMatchId, isoIST, 5);
        ctrlLog('✓ Deadline extended to '+new Date(isoIST).toLocaleString('en-IN'),'ok');
        UI.toast('Deadline extended!','success');
        await loadAllMatches(); loadMatchCtrl();
      } catch(e) { ctrlLog('Error: '+e.message,'err'); UI.toast(e.message,'error'); }
    }
  });
}

async function ctrlReopen() {
  if (!_ctrlMatchId) return;
  var val = document.getElementById('ctrl-deadline').value;
  var isoIST = val ? new Date(val+':00+05:30').toISOString() : null;
  UI.showConfirm({
    icon:'🔓', title:'Reopen Predictions?',
    msg: isoIST ? 'New deadline: '+new Date(isoIST).toLocaleString('en-IN') : 'Opens for 30 minutes.',
    consequence:'Users can update their predictions until the new deadline.',
    okLabel:'Reopen', okClass:'btn-accent',
    onOk: async function(){
      try {
        await API.reopenPredictions(_ctrlMatchId, isoIST);
        ctrlLog('✓ Predictions reopened.','ok');
        UI.toast('Predictions reopened!','success');
        await loadAllMatches(); loadMatchCtrl();
      } catch(e){ ctrlLog('Error: '+e.message,'err'); UI.toast(e.message,'error'); }
    }
  });
}

async function ctrlSetDLS() {
  if (!_ctrlMatchId) return;
  var t = parseInt(document.getElementById('ctrl-dls-target').value||0);
  if (!t||t<50||t>500) { UI.toast('Enter valid revised target (50–500)','warn'); return; }
  UI.showConfirm({
    icon:'🌧', title:'Set DLS Target?',
    msg:'Revised target: '+t+' runs',
    consequence:'All prediction scoring will use this target.',
    okLabel:'Set DLS', okClass:'btn-gold',
    onOk: async function(){
      try {
        await API.setDLSTarget(_ctrlMatchId, t);
        ctrlLog('✓ DLS target set to '+t,'ok');
        UI.toast('DLS target set!','success');
        await loadAllMatches(); loadMatchCtrl();
      } catch(e){ ctrlLog('Error: '+e.message,'err'); UI.toast(e.message,'error'); }
    }
  });
}

async function ctrlQuickLock() {
  if (!_ctrlMatchId) return;
  UI.showConfirm({
    icon:'🔒', title:'Lock Predictions Now?',
    msg:'Immediately close predictions for this match.',
    consequence:'No further submissions or edits will be allowed.',
    okLabel:'Lock Now', okClass:'btn-danger',
    onOk: async function(){
      try {
        await API.lockMatch(_ctrlMatchId);
        ctrlLog('✓ Match locked.','ok');
        UI.toast('Match locked!','warn');
        await loadAllMatches(); loadMatchCtrl();
      } catch(e){ ctrlLog('Error: '+e.message,'err'); UI.toast(e.message,'error'); }
    }
  });
}

async function ctrlAbandon() {
  if (!_ctrlMatchId) return;
  var m = _allMatches.find(function(x){return x.id===_ctrlMatchId;});
  UI.showConfirm({
    icon:'☔', title:'Abandon Match?',
    msg: m ? tShort(m.team1)+' vs '+tShort(m.team2) : 'Selected match',
    consequence:'No points awarded. Impact uses for this match are refunded automatically.',
    okLabel:'Mark Abandoned', okClass:'btn-danger',
    onOk: async function(){
      try {
        await API.markMatchAbandoned(_ctrlMatchId);
        ctrlLog('✓ Match marked abandoned. Impact uses refunded.','ok');
        UI.toast('Match abandoned.','warn');
        await loadAllMatches(); loadMatchCtrl();
      } catch(e){ ctrlLog('Error: '+e.message,'err'); UI.toast(e.message,'error'); }
    }
  });
}

async function ctrlMarkLive() {
  if (!_ctrlMatchId) return;
  try {
    var {error} = await sb.from('matches').update({status:'live'}).eq('id',_ctrlMatchId);
    if (error) throw error;
    ctrlLog('✓ Match marked as Live.','ok');
    UI.toast('Match is now live!','success');
    await loadAllMatches(); loadMatchCtrl();
  } catch(e){ ctrlLog('Error: '+e.message,'err'); }
}

/* ══ PLAYER STATS ════════════════════════════════════════════ */
var _statsPlayers = [];

async function loadStatsPanel() {
  // nothing extra — match dropdown already populated
}

async function onStatsMatchChange() {
  _statsMatchId = document.getElementById('stats-match-sel').value;
  document.getElementById('stats-form-card').style.display = 'none';
  document.getElementById('saved-stats-card').style.display = 'none';
  document.getElementById('stats-player-input').value = '';
  document.getElementById('stats-player-id').value = '';
  document.getElementById('stats-player-chip').style.display = 'none';

  if (!_statsMatchId) return;
  var m = _allMatches.find(function(x){return x.id===_statsMatchId;});
  if (!m) return;

  // Populate team filter
  var tf = document.getElementById('stats-team-filter');
  tf.innerHTML = '<option value="">Both teams</option>'+
    [m.team1,m.team2].filter(Boolean).map(function(t){
      return '<option value="'+t+'">'+UI.esc(t)+'</option>';
    }).join('');

  // Filter players to match teams
  _statsPlayers = _allPlayers.filter(function(p){
    return !m.team1 && !m.team2 ? true :
      p.ipl_team===m.team1 || p.ipl_team===m.team2;
  });

  await loadSavedStats();
}

function filterStatPlayers() {
  var team = document.getElementById('stats-team-filter').value;
  _statsPlayers = _allPlayers.filter(function(p){
    return !team || p.ipl_team===team;
  });
}

function searchPlayers(q) {
  var res = document.getElementById('player-search-results');
  if (!q || q.length < 2) { res.classList.remove('visible'); return; }
  var matches = _statsPlayers.filter(function(p){
    return p.name.toLowerCase().includes(q.toLowerCase());
  }).slice(0, 8);
  if (!matches.length) { res.classList.remove('visible'); return; }
  res.innerHTML = matches.map(function(p){
    var col = tColor(p.ipl_team||'');
    return '<div class="player-search-item" onclick="selectStatPlayer(\''+p.id+'\',\''+UI.esc(p.name)+'\',\''+UI.esc(p.role||'')+'\',\''+UI.esc(p.ipl_team||'')+'\')">'+
      '<span style="width:8px;height:8px;border-radius:50%;background:'+col+';flex-shrink:0;"></span>'+
      '<span style="font-weight:700;">'+UI.esc(p.name)+'</span>'+
      '<span style="font-size:11px;color:var(--text2);margin-left:auto;">'+UI.esc(p.ipl_team||'')+'</span>'+
    '</div>';
  }).join('');
  res.classList.add('visible');
}

async function selectStatPlayer(id, name, role, team) {
  _statsPlayerId = id;
  document.getElementById('stats-player-id').value = id;
  document.getElementById('stats-player-input').value = name;
  document.getElementById('player-search-results').classList.remove('visible');

  // Show chip
  var chip = document.getElementById('stats-player-chip');
  chip.innerHTML = '<div style="display:inline-flex;align-items:center;gap:8px;background:var(--bg3);border:1px solid var(--border);border-radius:20px;padding:4px 12px;font-size:13px;">'+
    UI.roleBadge(role)+' <strong>'+UI.esc(name)+'</strong> <span style="color:var(--text2);">'+UI.esc(team)+'</span></div>';
  chip.style.display = '';

  // Check if existing stats for this player+match
  if (_statsMatchId) {
    var { data } = await sb.from('player_match_stats')
      .select('*').eq('match_id',_statsMatchId).eq('player_id',id).maybeSingle();
    if (data) prefillStats(data);
    else clearStatsForm(false);
  }

  document.getElementById('stats-form-player-name').textContent = name;
  document.getElementById('stats-form-player-sub').textContent = role + ' · ' + team;
  document.getElementById('stats-form-card').style.display = '';
  recalcLive();
}

function closePlayerSearch() {
  var res = document.getElementById('player-search-results');
  if (res) res.classList.remove('visible');
}

function prefillStats(s) {
  document.getElementById('s-runs').value    = s.runs    || '';
  document.getElementById('s-balls').value   = s.balls_faced || '';
  document.getElementById('s-fours').value   = s.fours   || '';
  document.getElementById('s-sixes').value   = s.sixes   || '';
  document.getElementById('s-notout').value  = s.not_out ? 'true' : '';
  document.getElementById('s-wickets').value = s.wickets || '';
  document.getElementById('s-overs').value   = s.overs_bowled || '';
  document.getElementById('s-runsc').value   = s.runs_conceded || '';
  document.getElementById('s-maidens').value = s.maidens || '';
  document.getElementById('s-catches').value = s.catches || '';
  document.getElementById('s-runouts').value = s.run_outs || '';
  document.getElementById('s-stumpings').value = s.stumpings || '';
  recalcLive();
}

function clearStatsForm(hideCard) {
  ['s-runs','s-balls','s-fours','s-sixes','s-wickets','s-overs','s-runsc','s-maidens','s-catches','s-runouts','s-stumpings'].forEach(function(id){
    var e = document.getElementById(id); if(e) e.value='';
  });
  document.getElementById('s-notout').value = '';
  if (hideCard !== false) document.getElementById('stats-form-card').style.display='none';
  recalcLive();
}

function getStatsObj() {
  return {
    runs:          parseInt(document.getElementById('s-runs').value||0)||0,
    balls_faced:   parseInt(document.getElementById('s-balls').value||0)||0,
    fours:         parseInt(document.getElementById('s-fours').value||0)||0,
    sixes:         parseInt(document.getElementById('s-sixes').value||0)||0,
    not_out:       document.getElementById('s-notout').value==='true',
    wickets:       parseInt(document.getElementById('s-wickets').value||0)||0,
    overs_bowled:  parseFloat(document.getElementById('s-overs').value||0)||0,
    runs_conceded: parseInt(document.getElementById('s-runsc').value||0)||0,
    maidens:       parseInt(document.getElementById('s-maidens').value||0)||0,
    catches:       parseInt(document.getElementById('s-catches').value||0)||0,
    run_outs:      parseInt(document.getElementById('s-runouts').value||0)||0,
    stumpings:     parseInt(document.getElementById('s-stumpings').value||0)||0,
  };
}

function recalcLive() {
  var s = getStatsObj();
  var pts = API.calcBattingPoints(s) + API.calcBowlingPoints(s) + API.calcFieldingPoints(s);
  var ring = document.getElementById('live-pts-ring');
  if (!ring) return;
  ring.textContent = Math.round(pts);
  ring.style.borderColor = pts > 150 ? 'var(--gold)' : pts > 75 ? 'var(--accent)' : 'var(--border)';
  ring.style.color        = pts > 150 ? 'var(--gold)' : pts > 75 ? 'var(--accent)' : 'var(--text2)';
  ring.style.background   = pts > 150 ? 'rgba(245,200,66,.12)' : pts > 75 ? 'var(--accent-dim)' : 'var(--bg3)';
}

async function saveStats() {
  if (!_statsMatchId) { UI.toast('Select a match first','warn'); return; }
  if (!_statsPlayerId) { UI.toast('Select a player first','warn'); return; }
  var s = getStatsObj();
  s.match_id = _statsMatchId;
  s.player_id = _statsPlayerId;
  var est = Math.round(API.calcBattingPoints(s)+API.calcBowlingPoints(s)+API.calcFieldingPoints(s));

  UI.showConfirm({
    icon:'📊', title:'Save Player Stats?',
    msg:'Estimated points: '+est,
    consequence:'Will overwrite any existing stats for this player+match.',
    okLabel:'Save', okClass:'btn-accent',
    onOk: async function(){
      try {
        await API.upsertPlayerStats(s);
        UI.toast('Stats saved!','success');
        await loadSavedStats();
      } catch(e){ UI.toast('Save failed: '+e.message,'error'); }
    }
  });
}

async function loadSavedStats() {
  if (!_statsMatchId) return;
  var card = document.getElementById('saved-stats-card');
  var list = document.getElementById('saved-stats-list');
  var m = _allMatches.find(function(x){return x.id===_statsMatchId;});
  if (m) document.getElementById('saved-stats-match-label').textContent = tShort(m.team1)+' vs '+tShort(m.team2);
  card.style.display = '';
  list.innerHTML = '<div class="skel skel-row"></div>';
  try {
    var stats = await API.fetchPlayerStats(_statsMatchId);
    if (!stats.length) { list.innerHTML='<div style="color:var(--text3);font-size:13px;padding:12px;">No stats entered yet.</div>'; return; }
    list.innerHTML = stats.map(function(s) {
      var p = s.player||{};
      var bat  = API.calcBattingPoints(s);
      var bowl = API.calcBowlingPoints(s);
      var fld  = API.calcFieldingPoints(s);
      var tot  = Math.round(bat+bowl+fld);
      var col  = tColor(p.ipl_team||'');
      return '<div class="saved-stat-card">'+
        '<div style="width:4px;height:40px;border-radius:2px;background:'+col+';flex-shrink:0;"></div>'+
        '<div class="saved-stat-player">'+
          '<div class="saved-stat-player-name">'+UI.esc(p.name||'—')+'</div>'+
          '<div class="saved-stat-player-sub">'+UI.esc(p.ipl_team||'')+'</div>'+
          '<div class="saved-stat-breakdown">R:'+s.runs+' B:'+s.balls_faced+' W:'+s.wickets+' C:'+s.catches+' | Bat:'+Math.round(bat)+' Bowl:'+Math.round(bowl)+' Fld:'+Math.round(fld)+'</div>'+
        '</div>'+
        '<div class="saved-stat-pts">'+tot+'</div>'+
        '<button class="btn btn-ghost btn-sm" style="padding:3px 8px;font-size:11px;" onclick="editSavedStat(\''+p.id+'\',\''+UI.esc(p.name||'')+'\')">Edit</button>'+
      '</div>';
    }).join('');
  } catch(e) { list.innerHTML='<div style="color:var(--red);font-size:13px;padding:12px;">'+UI.esc(e.message)+'</div>'; }
}

async function editSavedStat(playerId, playerName) {
  var { data } = await sb.from('player_match_stats')
    .select('*').eq('match_id',_statsMatchId).eq('player_id',playerId).maybeSingle();
  if (data) {
    _statsPlayerId = playerId;
    document.getElementById('stats-player-id').value = playerId;
    document.getElementById('stats-player-input').value = playerName;
    document.getElementById('stats-form-player-name').textContent = playerName;
    document.getElementById('stats-form-card').style.display = '';
    prefillStats(data);
  }
}

/* ══ CSV UPLOAD ═══════════════════════════════════════════════ */
function openCSVModal()  { document.getElementById('csv-modal').style.display='flex'; }
function closeCSVModal() { document.getElementById('csv-modal').style.display='none'; document.getElementById('csv-preview').style.display='none'; }
function onCSVDrop(event){ event.preventDefault(); event.currentTarget.classList.remove('drag-over'); var f=event.dataTransfer.files[0]; if(f) processCSVFile(f); }
function onCSVFile(event){ var f=event.target.files[0]; if(f) processCSVFile(f); }

async function processCSVFile(file) {
  if (!_statsMatchId) { UI.toast('Select a match in Stats panel first','warn'); closeCSVModal(); return; }
  var text = await file.text();
  var preview = document.getElementById('csv-preview');
  try {
    var rawRows = API.parseStatsCsv(text, _statsMatchId);
    var resolved = [], errors = [];
    for (var i=0; i<rawRows.length; i++) {
      var r = rawRows[i];
      if (!r.player_id && r.player_name) {
        var name = (r.player_name||'').trim().toLowerCase();
        var match = _allPlayers.find(function(p){return p.name.toLowerCase()===name;})
                 || _allPlayers.find(function(p){return p.name.toLowerCase().includes(name);});
        if (match) { r.player_id=match.id; }
        else { errors.push('Row '+(i+2)+': could not find "'+r.player_name+'"'); }
      }
      delete r.player_name;
      if (r.player_id) resolved.push(r);
    }
    var uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    resolved = resolved.filter(function(r){
      if (!uuidRe.test(r.player_id)){ errors.push('Invalid UUID: '+r.player_id); return false; }
      return true;
    });
    preview.style.display='';
    preview.innerHTML =
      (errors.length ? '<div style="background:var(--red-dim);border:1px solid rgba(255,77,109,.25);border-radius:6px;padding:8px 12px;font-size:12px;color:var(--red);margin-bottom:8px;">⚠ '+errors.join('<br>')+'</div>' : '')+
      '<div style="font-size:13px;color:var(--text2);margin-bottom:8px;"><strong>'+resolved.length+'</strong> rows ready to upload.</div>'+
      (resolved.length ? '<button class="btn btn-accent btn-sm" onclick=\'uploadCSVStats('+JSON.stringify(resolved).replace(/</g,'\\u003c').replace(/'/g,'\\u0027')+')\'>Upload '+resolved.length+' rows</button>' : '');
  } catch(e) { UI.toast('CSV parse error: '+e.message,'error'); }
}

async function uploadCSVStats(rows) {
  try {
    await API.bulkUpsertPlayerStats(rows);
    UI.toast('Uploaded '+rows.length+' rows!','success');
    closeCSVModal();
    await loadSavedStats();
  } catch(e) { UI.toast('Upload failed: '+e.message,'error'); }
}

/* ══ CALCULATE POINTS ═════════════════════════════════════════ */
async function loadCalcPanel() {
  // match dropdown already populated
}

async function loadCalcInfo() {
  var matchId = document.getElementById('calc-match-sel').value;
  var el = document.getElementById('calc-match-info');
  if (!matchId) { el.innerHTML=''; return; }
  var m = _allMatches.find(function(x){return x.id===matchId;});
  if (!m) return;
  el.innerHTML =
    '<div style="background:var(--bg3);padding:12px 14px;border-radius:8px;font-size:13px;">'+
      '<span style="font-family:var(--f-display);font-weight:900;font-size:16px;">'+UI.esc(m.team1)+' vs '+UI.esc(m.team2)+'</span>'+
      '<div style="color:var(--text2);margin-top:4px;">'+
        'Winner: <strong style="color:var(--gold);">'+(m.winner||'Not set')+'</strong> · '+
        'Target: <strong>'+(m.actual_target||'Not set')+'</strong>'+
        (m.is_dls_applied ? ' · <span class="dls-badge">DLS</span>' : '')+
        (m.status==='abandoned' ? ' · <span class="badge badge-red">Abandoned</span>' : '')+
      '</div>'+
    '</div>';
}

async function calculatePoints() {
  var matchId = document.getElementById('calc-match-sel').value;
  if (!matchId) { UI.toast('Select a match','warn'); return; }
  var m = _allMatches.find(function(x){return x.id===matchId;});
  UI.showConfirm({
    icon:'⚡', title:'Calculate & Lock?',
    msg:'Calculate points for '+(m ? tShort(m.team1)+' vs '+tShort(m.team2) : matchId),
    consequence:'This will score all teams and lock the match.',
    okLabel:'Calculate', okClass:'btn-gold',
    onOk: async function(){
      var btn = document.getElementById('calc-btn');
      if (btn._busy) return; btn._busy=true; btn.disabled=true;
      btn.innerHTML='<span class="btn-spin"></span> Calculating…';
      document.getElementById('calc-log').innerHTML='';
      calcLog('Starting calculation…');
      try {
        var results = await API.calculateMatchPoints(matchId, calcLog);
        calcLog('Computed '+results.length+' teams · Leaderboard updated · Match locked ✓','ok');
        UI.toast('Points calculated!','success');
        await loadAllMatches();
      } catch(e){ calcLog('ERROR: '+e.message,'err'); UI.toast('Calculation failed: '+e.message,'error'); }
      btn._busy=false; btn.disabled=false; btn.innerHTML='⚡ Calculate & Lock';
    }
  });
}

async function recalculate() {
  var matchId = document.getElementById('calc-match-sel').value;
  if (!matchId) { UI.toast('Select a match','warn'); return; }
  var m = _allMatches.find(function(x){return x.id===matchId;});
  UI.showConfirm({
    icon:'↻', title:'Danger: Recalculate?',
    msg:'Delete existing points and recompute from scratch for '+(m?tShort(m.team1)+' vs '+tShort(m.team2):'this match'),
    consequence:'All previous points_log entries for this match will be deleted.',
    okLabel:'Recalculate', okClass:'btn-danger',
    onOk: async function(){
      var btn = document.getElementById('recalc-btn');
      if (btn._busy) return; btn._busy=true; btn.disabled=true;
      btn.innerHTML='<span class="btn-spin"></span> Recalculating…';
      document.getElementById('calc-log').innerHTML='';
      calcLog('Deleting existing points log…','warn');
      try {
        var results = await API.recalculateMatch(matchId, calcLog);
        calcLog('Done — '+results.length+' teams recalculated','ok');
        UI.toast('Recalculation complete!','success');
        await loadAllMatches();
      } catch(e){ calcLog('ERROR: '+e.message,'err'); UI.toast(e.message,'error'); }
      btn._busy=false; btn.disabled=false; btn.innerHTML='↻ Recalculate (Delete & Redo)';
    }
  });
}

/* ══ OVERRIDES ═══════════════════════════════════════════════ */
async function populateOvrDropdowns() {
  // already done in populateTeamDropdowns / populateMatchDropdowns
}

async function submitOverride() {
  var matchId = document.getElementById('ovr-match-sel').value||null;
  var teamId  = document.getElementById('ovr-team-sel').value;
  var pts     = parseInt(document.getElementById('ovr-pts').value||0);
  var reason  = document.getElementById('ovr-reason').value.trim();
  var errEl   = document.getElementById('ovr-error');
  errEl.textContent='';

  if (!teamId) { errEl.textContent='Select a team.'; return; }
  if (!pts)    { errEl.textContent='Enter a non-zero adjustment.'; return; }
  if (!reason) { errEl.textContent='Reason is required.'; return; }

  var teamName = (_allTeams.find(function(r){return r.fantasy_team_id===teamId;})||{team:{team_name:'?'}}).team.team_name;
  UI.showConfirm({
    icon:'⚖️', title:'Apply Adjustment?',
    msg:'Team: '+teamName+'\nPoints: '+(pts>0?'+':'')+pts,
    consequence:'Reason: '+reason,
    okLabel:'Apply', okClass:'btn-gold',
    onOk: async function(){
      try {
        await API.applyAdjustment({teamId, matchId, points:pts, remarks:reason});
        UI.toast('Adjustment applied!','success');
        document.getElementById('ovr-pts').value='';
        document.getElementById('ovr-reason').value='';
        await loadAdjustments();
      } catch(e){ errEl.textContent=e.message; UI.toast(e.message,'error'); }
    }
  });
}

async function loadAdjustments() {
  var el = document.getElementById('adj-history');
  if (!el) return;
  el.innerHTML = '<div class="skel skel-row"></div>';
  try {
    var adjs = await API.fetchAllAdjustments();
    if (!adjs.length) { el.innerHTML='<div style="color:var(--text3);font-size:13px;padding:12px;">No adjustments yet.</div>'; return; }
    el.innerHTML = adjs.map(function(a) {
      var isPos = a.points > 0;
      return '<div class="adj-row">'+
        '<span class="adj-pts-badge '+(isPos?'pos':'neg')+'">'+(isPos?'+':'')+a.points+'</span>'+
        '<div style="flex:1;min-width:0;">'+
          '<div style="font-family:var(--f-ui);font-weight:700;font-size:13px;">'+UI.esc(a.team?a.team.team_name:'—')+'</div>'+
          '<div style="font-size:11px;color:var(--text2);">'+UI.esc(a.remarks)+'</div>'+
          (a.match?'<div style="font-size:10px;color:var(--text3);">'+UI.esc(a.match.match_title||'—')+'</div>':'') +
        '</div>'+
        '<div style="font-size:11px;color:var(--text3);">'+UI.shortDate(a.created_at)+'</div>'+
        '<button class="btn btn-danger btn-sm" style="padding:2px 8px;font-size:11px;" title="Undo" onclick="undoAdjustment(\''+a.id+'\')">↩</button>'+
      '</div>';
    }).join('');
  } catch(e) { el.innerHTML='<div style="color:var(--red);font-size:13px;">'+UI.esc(e.message)+'</div>'; }
}

async function undoAdjustment(adjId) {
  UI.showConfirm({
    icon:'↩', title:'Undo Adjustment?',
    msg:'This will permanently remove the adjustment and refresh the leaderboard.',
    consequence:'Cannot be re-done — you will need to re-enter if removed by mistake.',
    okLabel:'Undo', okClass:'btn-danger',
    onOk: async function(){
      try {
        await API.undoAdjustment(adjId);
        UI.toast('Adjustment removed','warn');
        await loadAdjustments();
      } catch(e){ UI.toast(e.message,'error'); }
    }
  });
}

/* ══ INJURIES & REPLACEMENTS ═════════════════════════════════ */
async function loadInjuries() {
  // Load active replacements across all teams
  var el = document.getElementById('injuries-list');
  if (!el) return;
  el.innerHTML = '<div class="skel skel-row"></div>';
  try {
    var { data, error } = await sb.from('replacements')
      .select('*,original:players!replacements_original_player_id_fkey(id,name,role,ipl_team,is_injured,injury_note),replacement:players!replacements_replacement_player_id_fkey(id,name,role,ipl_team),team:fantasy_teams(team_name)')
      .eq('is_active',true).order('created_at',{ascending:false});
    if (error) throw error;
    if (!data||!data.length) { el.innerHTML='<div style="color:var(--text3);font-size:13px;padding:12px;">No active replacements.</div>'; return; }
    el.innerHTML = data.map(function(r) {
      return '<div class="injury-player-card replaced">'+
        '<div style="flex:1;">'+
          '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'+
            '<span style="font-family:var(--f-ui);font-weight:700;">'+UI.esc(r.original?r.original.name:'—')+'</span>'+
            '<span class="badge badge-red" style="font-size:10px;">Injured</span>'+
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;color:var(--cyan)"><path d="M5 12h14M12 5l7 7-7 7"/></svg>'+
            '<span style="font-family:var(--f-ui);font-weight:700;color:var(--cyan);">'+UI.esc(r.replacement?r.replacement.name:'—')+'</span>'+
          '</div>'+
          '<div style="font-size:11px;color:var(--text2);margin-top:3px;">'+
            UI.esc(r.team?r.team.team_name:'—')+
            (r.reason?' · '+UI.esc(r.reason):'')+
          '</div>'+
        '</div>'+
        '<button class="btn btn-ghost btn-sm" style="font-size:11px;" onclick="removeReplacement(\''+r.id+'\')">Remove</button>'+
      '</div>';
    }).join('');
  } catch(e) { el.innerHTML='<div style="color:var(--red);font-size:13px;">'+UI.esc(e.message)+'</div>'; }
}

function searchInjuryPlayer(q) {
  var res = document.getElementById('inj-search-results');
  if (!q||q.length<2) { res.classList.remove('visible'); return; }
  var matches = _allPlayers.filter(function(p){ return p.name.toLowerCase().includes(q.toLowerCase()); }).slice(0,8);
  if (!matches.length) { res.classList.remove('visible'); return; }
  res.innerHTML = matches.map(function(p){
    return '<div class="player-search-item" onclick="selectInjPlayer(\''+p.id+'\',\''+UI.esc(p.name)+'\','+JSON.stringify(p).replace(/</g,'\\u003c')+')">'+
      (p.is_injured?'<span class="badge badge-red" style="font-size:9px;">INJ</span>':'<span style="width:8px;height:8px;border-radius:50%;background:'+tColor(p.ipl_team||'')+';flex-shrink:0;"></span>')+
      '<span style="font-weight:700;">'+UI.esc(p.name)+'</span>'+
      '<span style="font-size:11px;color:var(--text2);margin-left:auto;">'+UI.esc(p.ipl_team||'')+'</span>'+
    '</div>';
  }).join('');
  res.classList.add('visible');
}

function closeInjSearch() { document.getElementById('inj-search-results').classList.remove('visible'); }

function selectInjPlayer(id, name, playerObj) {
  document.getElementById('inj-player-id').value = id;
  document.getElementById('inj-player-input').value = name;
  document.getElementById('inj-search-results').classList.remove('visible');
  if (playerObj.injury_note) document.getElementById('inj-note').value = playerObj.injury_note;
  var info = document.getElementById('inj-player-info');
  info.style.display='';
  info.className = 'injury-player-card mb-8' + (playerObj.is_injured?' injured':'');
  info.innerHTML = '<div style="flex:1;"><div style="font-weight:700;">'+UI.esc(name)+'</div>'+
    '<div style="font-size:11px;color:var(--text2);">'+UI.esc(playerObj.role||'')+'  · '+UI.esc(playerObj.ipl_team||'')+'</div>'+
    (playerObj.is_injured?'<div style="font-size:11px;color:var(--red);">🏥 Injured: '+UI.esc(playerObj.injury_note||'')+'</div>':'')+
  '</div>';
}

async function markInjured() {
  var id   = document.getElementById('inj-player-id').value;
  var note = document.getElementById('inj-note').value.trim();
  if (!id) { UI.toast('Select a player','warn'); return; }
  try {
    await API.markPlayerInjured(id, note||null);
    UI.toast('Player marked injured','warn');
    await loadAllPlayers();
    document.getElementById('inj-player-id').value='';
    document.getElementById('inj-player-input').value='';
    document.getElementById('inj-player-info').style.display='none';
    await loadInjuries();
  } catch(e){ UI.toast(e.message,'error'); }
}

async function clearInjury() {
  var id = document.getElementById('inj-player-id').value;
  if (!id) { UI.toast('Select a player','warn'); return; }
  try {
    await API.clearPlayerInjury(id);
    UI.toast('Injury cleared','success');
    await loadAllPlayers();
    document.getElementById('inj-player-info').style.display='none';
    await loadInjuries();
  } catch(e){ UI.toast(e.message,'error'); }
}

async function loadTeamSquad() {
  var teamId = document.getElementById('rep-team-sel').value;
  var injSel = document.getElementById('rep-injured-sel');
  injSel.innerHTML='<option value="">— Select injured player —</option>';
  if (!teamId) return;
  try {
    var squad = await API.fetchSquad(teamId);
    var injured = squad.filter(function(sp){ return sp.player && sp.player.is_injured; });
    injSel.innerHTML = '<option value="">— Select —</option>' +
      (injured.length ? injured : squad).map(function(sp){
        var p = sp.player||{};
        return '<option value="'+p.id+'">'+UI.esc(p.name||'')+(p.is_injured?' 🏥':'')+'</option>';
      }).join('');
  } catch(e){ UI.toast(e.message,'error'); }
}

async function loadSameRolePlayers() {
  var teamId  = document.getElementById('rep-team-sel').value;
  var injId   = document.getElementById('rep-injured-sel').value;
  var repSel  = document.getElementById('rep-player-sel');
  repSel.innerHTML = '<option value="">— Select replacement —</option>';
  if (!injId) return;
  var injPlayer = _allPlayers.find(function(p){return p.id===injId;});
  if (!injPlayer) return;
  // Get squad player IDs to exclude
  var squad = teamId ? await API.fetchSquad(teamId) : [];
  var squadIds = new Set(squad.map(function(sp){return sp.player&&sp.player.id;}));
  var eligible = _allPlayers.filter(function(p){
    return p.role===injPlayer.role && !squadIds.has(p.id) && !p.is_injured && p.id!==injId;
  });
  repSel.innerHTML = '<option value="">— Select —</option>' +
    eligible.map(function(p){
      return '<option value="'+p.id+'">'+UI.esc(p.name)+' · '+UI.esc(p.ipl_team||'?')+'</option>';
    }).join('');
}

async function setReplacement() {
  var teamId   = document.getElementById('rep-team-sel').value;
  var origId   = document.getElementById('rep-injured-sel').value;
  var replId   = document.getElementById('rep-player-sel').value;
  var reason   = document.getElementById('rep-reason').value.trim();
  if (!teamId||!origId||!replId) { UI.toast('Fill all fields','warn'); return; }
  try {
    await API.createReplacement({teamId, originalPlayerId:origId, replacementPlayerId:replId, reason:reason||null});
    UI.toast('Replacement set!','success');
    document.getElementById('rep-reason').value='';
    document.getElementById('rep-player-sel').value='';
    await loadInjuries();
  } catch(e){ UI.toast(e.message,'error'); }
}

async function removeReplacement(repId) {
  UI.showConfirm({
    icon:'↩', title:'Remove Replacement?',
    msg:'The original (injured) player will be used again.',
    consequence:'Points going forward will revert to the original player.',
    okLabel:'Remove', okClass:'btn-danger',
    onOk: async function(){
      try {
        await API.deactivateReplacement(repId);
        UI.toast('Replacement removed','warn');
        await loadInjuries();
      } catch(e){ UI.toast(e.message,'error'); }
    }
  });
}

/* ══ SQUAD MANAGEMENT ════════════════════════════════════════ */
async function loadSquadsPanel() {
  // team dropdown already populated
}

async function loadSquadAdmin() {
  var teamId = document.getElementById('squad-team-sel').value;
  if (!teamId) return;
  var team = _allTeams.find(function(r){return r.fantasy_team_id===teamId;});
  document.getElementById('squad-team-label').textContent = team&&team.team?team.team.team_name:'Team';
  document.getElementById('squad-admin-view').style.display='';

  try {
    var squad = await API.fetchSquad(teamId);
    _squadEdits[teamId] = {
      captainId: (squad.find(function(s){return s.is_captain;})||{}).player&&squad.find(function(s){return s.is_captain;}).player.id,
      vcId:      (squad.find(function(s){return s.is_vc;})||{}).player&&squad.find(function(s){return s.is_vc;}).player.id,
      impactId:  (squad.find(function(s){return s.is_impact;})||{}).player&&squad.find(function(s){return s.is_impact;}).player.id,
    };
    var tbody = document.getElementById('squad-admin-tbody');
    tbody.innerHTML = squad.map(function(sp) {
      var p = sp.player||{};
      return '<tr>'+
        '<td><div style="font-family:var(--f-ui);font-weight:700;">'+UI.esc(p.name||'—')+'</div>'+
          (p.is_injured?'<div style="font-size:10px;color:var(--red);">🏥 Injured'+(p.injury_note?' · '+UI.esc(p.injury_note):'')+'</div>':'')+
        '</td>'+
        '<td>'+UI.roleBadge(p.role)+'</td>'+
        '<td style="font-size:12px;color:var(--text2);">'+UI.esc(p.ipl_team||'—')+'</td>'+
        '<td><input type="radio" name="sq-cap-'+teamId+'" value="'+p.id+'" '+(sp.is_captain?'checked':'')+' onchange="updateSquadRole(\''+teamId+'\',\'captain\',\''+p.id+'\')"></td>'+
        '<td><input type="radio" name="sq-vc-'+teamId+'" value="'+p.id+'" '+(sp.is_vc?'checked':'')+' onchange="updateSquadRole(\''+teamId+'\',\'vc\',\''+p.id+'\')"></td>'+
        '<td><input type="radio" name="sq-ip-'+teamId+'" value="'+p.id+'" '+(sp.is_impact?'checked':'')+' onchange="updateSquadRole(\''+teamId+'\',\'impact\',\''+p.id+'\')"></td>'+
        '<td><span style="font-size:11px;color:var(--text3);">'+(p.is_overseas?'🌏':'')+'</span></td>'+
      '</tr>';
    }).join('');
  } catch(e){ UI.toast(e.message,'error'); }
}

function updateSquadRole(teamId, roleType, playerId) {
  if (!_squadEdits[teamId]) _squadEdits[teamId] = {};
  if (roleType==='captain') _squadEdits[teamId].captainId = playerId;
  if (roleType==='vc')      _squadEdits[teamId].vcId      = playerId;
  if (roleType==='impact')  _squadEdits[teamId].impactId  = playerId;
}

async function saveSquadRoles() {
  var teamId = document.getElementById('squad-team-sel').value;
  var edits = _squadEdits[teamId];
  if (!teamId||!edits) { UI.toast('No changes to save','warn'); return; }
  UI.showConfirm({
    icon:'👑', title:'Save Squad Roles?',
    msg:'Update Captain, Vice-Captain, and Impact Player assignments.',
    consequence:'Points multipliers will apply from the next calculation.',
    okLabel:'Save', okClass:'btn-accent',
    onOk: async function(){
      try {
        // Reset all then set
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

/* ══ BLOG MANAGEMENT ══════════════════════════════════════════ */
async function loadBlogList() {
  var cont = document.getElementById('blog-admin-list');
  cont.innerHTML='<div style="padding:20px;text-align:center;color:var(--text3);">Loading…</div>';
  try {
    var blogs = await API.fetchBlogs({limit:50, publishedOnly:false, status:_blogFilter==='all'?null:_blogFilter});
    if (!blogs.length) { cont.innerHTML='<div style="padding:20px;text-align:center;color:var(--text3);">No posts.</div>'; return; }
    var sCols = {draft:'var(--gold)',review:'var(--cyan)',published:'var(--green)'};
    cont.innerHTML = blogs.map(function(b,i){
      var col = sCols[b.status]||'var(--text3)';
      return '<div class="fixture-admin-row" onclick="loadBlogEdit(\''+b.id+'\')" style="animation:row-in .2s ease '+(i*.04)+'s both;">'+
        '<div class="fx-match-label">'+
          '<div class="fx-match-title">'+(b.ai_generated?'🤖 ':'')+UI.esc(b.title)+'</div>'+
          '<div class="fx-match-sub">'+UI.esc(b.category)+' · '+UI.shortDate(b.created_at)+' · '+b.views+' views</div>'+
        '</div>'+
        '<span style="background:'+col+'22;color:'+col+';font-size:9px;font-weight:700;padding:2px 7px;border-radius:3px;font-family:var(--f-ui);">'+UI.esc(b.status)+'</span>'+
      '</div>';
    }).join('');
  } catch(e){ cont.innerHTML='<div style="color:var(--red);padding:14px;font-size:13px;">'+UI.esc(e.message)+'</div>'; }
}

function filterBlogs(status, btn) {
  _blogFilter = status;
  document.querySelectorAll('#panel-blogs .btn').forEach(function(b){ b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  loadBlogList();
}

function newBlogPost() { clearBlogForm(); }

async function loadBlogEdit(blogId) {
  try {
    var b = await API.fetchBlog(blogId, true);
    if (!b) return;
    document.getElementById('blog-id').value = b.id;
    document.getElementById('b-title').value   = b.title||'';
    document.getElementById('b-excerpt').value = b.excerpt||'';
    document.getElementById('b-category').value= b.category||'general';
    document.getElementById('b-status').value  = b.status||'draft';
    document.getElementById('b-content').value = b.content||'';
    document.getElementById('blog-editor-title').textContent = 'Editing: '+b.title;
    document.getElementById('blog-delete-btn').style.display='';
  } catch(e){ UI.toast(e.message,'error'); }
}

function clearBlogForm() {
  document.getElementById('blog-id').value='';
  document.getElementById('b-title').value='';
  document.getElementById('b-excerpt').value='';
  document.getElementById('b-category').value='general';
  document.getElementById('b-status').value='draft';
  document.getElementById('b-content').value='';
  document.getElementById('blog-editor-title').textContent='New Post';
  document.getElementById('blog-delete-btn').style.display='none';
  document.getElementById('blog-error').textContent='';
}

async function saveBlog() {
  var id      = document.getElementById('blog-id').value;
  var title   = document.getElementById('b-title').value.trim();
  var content = document.getElementById('b-content').value.trim();
  var errEl   = document.getElementById('blog-error');
  errEl.textContent='';
  if (!title||!content){ errEl.textContent='Title and content required.'; return; }
  var blog = {
    title, content,
    excerpt:  document.getElementById('b-excerpt').value.trim()||null,
    category: document.getElementById('b-category').value,
    status:   document.getElementById('b-status').value,
    is_published: document.getElementById('b-status').value==='published',
  };
  if (id) blog.id=id;
  try {
    await API.upsertBlog(blog);
    UI.toast('Blog saved!','success');
    clearBlogForm();
    await loadBlogList();
  } catch(e){ errEl.textContent=e.message; UI.toast(e.message,'error'); }
}

async function publishBlog() {
  var id = document.getElementById('blog-id').value;
  if (!id){ UI.toast('Save the post first, then publish','warn'); return; }
  UI.showConfirm({
    icon:'🚀', title:'Publish Post?',
    msg:'Make this post visible to all users.',
    okLabel:'Publish', okClass:'btn-accent',
    onOk: async function(){
      try {
        await API.publishBlog(id,'admin');
        UI.toast('Published!','success');
        clearBlogForm();
        await loadBlogList();
      } catch(e){ UI.toast(e.message,'error'); }
    }
  });
}

async function deleteBlog() {
  var id = document.getElementById('blog-id').value; if (!id) return;
  UI.showConfirm({
    icon:'🗑️', title:'Delete Post?',
    msg:'Permanently remove this blog post.',
    okLabel:'Delete', okClass:'btn-danger',
    onOk: async function(){
      try { await API.deleteBlog(id); UI.toast('Post deleted','warn'); clearBlogForm(); await loadBlogList(); }
      catch(e){ UI.toast(e.message,'error'); }
    }
  });
}

function showAIGen() {
  var p = document.getElementById('ai-gen-panel');
  if (p) p.style.display = p.style.display==='none'?'':'none';
}

async function generateAIBlog() {
  var title = document.getElementById('ai-title').value.trim();
  var cat   = document.getElementById('ai-category').value;
  var ctx   = document.getElementById('ai-context').value.trim();
  if (!title){ UI.toast('Enter a topic','warn'); return; }
  var btn = document.getElementById('ai-gen-btn');
  var icon= document.getElementById('ai-gen-icon');
  if (btn._busy) return; btn._busy=true; btn.disabled=true; icon.textContent='⏳';
  try {
    var blog = await API.generateAIBlog({title, category:cat, context:ctx});
    await loadBlogEdit(blog.id);
    document.getElementById('ai-gen-panel').style.display='none';
    await loadBlogList();
    UI.toast('AI draft generated — review and publish!','success',5000);
  } catch(e){ UI.toast('AI generation failed: '+e.message,'error'); }
  btn._busy=false; btn.disabled=false; icon.textContent='✨';
}

/* ══ USERS ═══════════════════════════════════════════════════ */
async function loadUsers() {
  var tbody = document.getElementById('users-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7"><div class="skel skel-row" style="margin:8px;"></div></td></tr>';
  try {
    var lb = await API.fetchLeaderboard();
    var medals = {1:'🥇',2:'🥈',3:'🥉'};
    tbody.innerHTML = lb.map(function(r,i){
      var t = r.team||{};
      var initials = (t.team_name||'?').split(' ').map(function(w){return w[0];}).join('').substring(0,2).toUpperCase();
      return '<tr style="animation:row-in .2s ease '+(i*.04)+'s both;">'+
        '<td><div class="user-avatar-sm" style="font-size:11px;">'+initials+'</div></td>'+
        '<td style="font-family:var(--f-ui);font-weight:700;">'+UI.esc(t.team_name||'—')+'</td>'+
        '<td style="font-size:13px;color:var(--text2);">'+UI.esc(t.owner_name||'—')+'</td>'+
        '<td class="rank">'+(medals[r.rank]||r.rank)+'</td>'+
        '<td class="pts">'+r.total_points+'</td>'+
        '<td style="color:var(--text2);">'+r.matches_played+'</td>'+
        '<td>'+
          '<button class="btn btn-ghost btn-sm" style="font-size:11px;" onclick="viewTeamSquad(\''+r.fantasy_team_id+'\')">Squad</button>'+
        '</td>'+
      '</tr>';
    }).join('');
  } catch(e){ tbody.innerHTML='<tr><td colspan="7" style="color:var(--red);padding:12px;">'+UI.esc(e.message)+'</td></tr>'; }
}

async function viewTeamSquad(teamId) {
  document.getElementById('squad-team-sel').value = teamId;
  showPanel('squads');
  await loadSquadAdmin();
}

/* ══ AUDIT LOG ═══════════════════════════════════════════════ */
async function loadAuditLog() {
  var tbody = document.getElementById('audit-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6"><div class="skel skel-row" style="margin:8px;"></div></td></tr>';
  var filter = document.getElementById('audit-filter');
  var actionType = filter ? filter.value||null : null;
  try {
    var logs = await API.fetchActionLog({limit:100, actionType});
    if (!logs.length) { tbody.innerHTML='<tr><td colspan="6" class="empty-state" style="padding:20px;">No log entries.</td></tr>'; return; }
    tbody.innerHTML = logs.map(function(l,i){
      var col = ACTION_COLORS[l.action_type]||'var(--text2)';
      var canUndo = l.action_type==='stat_entry'||l.action_type==='adjustment';
      return '<tr style="animation:row-in .2s ease '+(i*.02)+'s both;">'+
        '<td style="font-size:11px;color:var(--text3);white-space:nowrap;">'+UI.shortDate(l.created_at)+'</td>'+
        '<td><span style="background:'+col+'22;color:'+col+';font-size:9px;font-weight:700;padding:2px 7px;border-radius:3px;font-family:var(--f-ui);">'+UI.esc(l.action_type)+'</span></td>'+
        '<td style="font-size:12px;">'+UI.esc(l.entity_type)+'</td>'+
        '<td style="font-family:var(--f-mono);font-size:10px;color:var(--text3);">'+UI.esc((l.entity_id||'').substring(0,12))+'…</td>'+
        '<td style="font-size:12px;">'+UI.esc(l.performed_by||'admin')+'</td>'+
        '<td>'+(canUndo?'<button class="btn btn-ghost btn-sm" style="font-size:10px;padding:2px 7px;" onclick="undoAuditAction(\''+l.id+'\',\''+l.action_type+'\',\''+l.entity_id+'\')">↩ Undo</button>':'—')+'</td>'+
      '</tr>';
    }).join('');
  } catch(e){ tbody.innerHTML='<tr><td colspan="6" style="color:var(--red);padding:12px;">'+UI.esc(e.message)+'</td></tr>'; }
}

async function undoAuditAction(logId, actionType, entityId) {
  if (actionType==='stat_entry') {
    UI.showConfirm({
      icon:'↩', title:'Undo Stat Entry?',
      msg:'Restore the previous stats for this player.',
      consequence:'This will overwrite the current stats with the version before this action.',
      okLabel:'Undo', okClass:'btn-danger',
      onOk: async function(){
        try {
          await API.undoLastStatEntry(entityId);
          UI.toast('Stats restored','success');
          await loadAuditLog();
        } catch(e){ UI.toast(e.message,'error'); }
      }
    });
  } else {
    UI.toast('Undo not available for this action type.','warn');
  }
}

/* ══ LOGOUT ══════════════════════════════════════════════════ */
async function doLogout() {
  await Auth.signOut();
}

/* ══ BOOT ════════════════════════════════════════════════════ */
init();