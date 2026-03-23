'use strict';

var TEAMS=['CHENNAI SUPER KINGS','DELHI CAPITALS','GUJARAT TITANS','KOLKATA KNIGHT RIDERS','LUCKNOW SUPER GIANTS','MUMBAI INDIANS','PUNJAB KINGS','RAJASTHAN ROYALS','ROYAL CHALLENGERS BENGALURU','SUNRISERS HYDERABAD','SUPREME RAJAS'];
var CODES={CHENNAISUPERKINGS:'CSK',DELHICAPITALS:'DC',GUJARATTITANS:'GT',KOLKATAKNIGHTRIDERS:'KKR',LUCKNOWSUPERGIANTS:'LSG',MUMBAIINDIANS:'MI',PUNJABKINGS:'PBKS',RAJASTHANROYALS:'RR',ROYALCHALLENGERSBENGALURU:'RCB',SUNRISERSHYDERABAD:'SRH',SUPREMERAJAS:'SURA'};
var TCOLS={CSK:'#fdb913',MI:'#004ba0',RCB:'#da1818',KKR:'#6a1bac',SRH:'#f26522',DC:'#004c93',PBKS:'#ed1b24',RR:'#ea1a85',GT:'#1c2c5b',LSG:'#ff002b',SURA:'#1a3a8a'};
function tCode(n){return CODES[(n||'').toUpperCase().replace(/\s+/g,'')]||null;}
function tLogo(n){var c=tCode(n);return c?'images/teams/'+c+'outline.png':'';}
function tShort(n){return tCode(n)||(n||'').split(' ').map(function(w){return w[0];}).join('');}

var _allPlayers=[], _allMatches=[], _allTeamsData=[];

var ADMIN_NAV_LINKS = [
  { 
    href: 'javascript:void(0)',  
    label: 'Fixtures',   
    page: 'fixtures',
    bnav: true,  
    onclick: "switchTab('fixtures')", 
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"/></svg>' 
  },
  { 
    href: 'javascript:void(0)',     
    label: 'Player Stats',
    page: 'stats',     
    bnav: true,

    onclick: "switchTab('stats')",    
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.21 15.89A10 10 0 118 2.83M22 12A10 10 0 0012 2v10z"/></svg>' 
  },
  { 
    href: 'javascript:void(0)', 
    label: 'Calculate',  
    page: 'calculate', 
    bnav: true,
    onclick: "switchTab('calculate')",
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6" y2="6"/><line x1="6" y1="18" x2="6" y2="18"/></svg>' 
  },
  { 
    href: 'javascript:void(0)',  
    label: 'Override',   
    page: 'override',  
    bnav: true,
    onclick: "switchTab('override')", 
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' 
  },
  { 
    href: 'javascript:void(0)',     
    label: 'Teams',      
    page: 'teams',     
    bnav: true,
    onclick: "switchTab('teams')",    
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>' 
  },
  {
    href: 'javascript:void(0)',
    label: 'Blogs',
    page: 'blogs',
    onclick: "switchTab('blogs')",
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>'
  }
];

async function doLogout(){await Auth.signOut();}

async function init(){
  var sess=await Auth.requireAuth(); 
  if(!sess) return;
  await initNavbar('fixtures', ADMIN_NAV_LINKS);
  if(!Auth.isAdmin(sess.user)){window.location.href='dashboard.html';return;}
  buildTeamDropdowns();
  await loadAll();
}

// Audit Fix #17: loadAll populates override dropdowns immediately on page load
async function loadAll(){
  await Promise.all([loadPlayers(),loadMatches(),loadTeams(),loadAdminStats()]);
}

function buildTeamDropdowns(){
  var opts='<option value="">— Select —</option>'+TEAMS.map(function(t){return '<option value="'+t+'">'+t+'</option>';}).join('');
  ['m-team1','m-team2'].forEach(function(id){var e=document.getElementById(id);if(e)e.innerHTML=opts;});
  document.getElementById('m-winner').innerHTML='<option value="">— No Result Yet —</option>'+TEAMS.map(function(t){return '<option value="'+t+'">'+t+'</option>';}).join('');
}

function onTeamChange(which){
  var map={home:['m-team1','logo-home'],away:['m-team2','logo-away'],winner:['m-winner','logo-winner']};
  var pair=map[which]; var sel=document.getElementById(pair[0]); var img=document.getElementById(pair[1]);
  var name=sel?sel.value:''; var logo=tLogo(name);
  if(logo&&name){img.src=logo;img.style.display='';sel.classList.add('has-logo');}
  else{img.style.display='none';sel.classList.remove('has-logo');}
  if(which==='home'||which==='away') syncWinnerDropdown();
}

function syncWinnerDropdown(){
  var t1=document.getElementById('m-team1').value, t2=document.getElementById('m-team2').value;
  var cur=document.getElementById('m-winner').value;
  var opts='<option value="">— No Result Yet —</option>';
  if(t1) opts+='<option value="'+t1+'">'+t1+'</option>';
  if(t2) opts+='<option value="'+t2+'">'+t2+'</option>';
  if(!t1&&!t2) opts='<option value="">— No Result Yet —</option>'+TEAMS.map(function(t){return '<option value="'+t+'">'+t+'</option>';}).join('');
  document.getElementById('m-winner').innerHTML=opts;
  document.getElementById('m-winner').value=cur;
  onTeamChange('winner');
}

async function loadAdminStats(){
  try{
    var matches=await API.fetchMatches({limit:74});
    var locked=matches.filter(function(m){return m.is_locked;}).length;
    var lb=await API.fetchLeaderboard();
    document.getElementById('admin-stats').innerHTML=
      '<div class="stat-chip" style="animation-delay:0s"><div class="stat-chip-val">'+matches.length+'</div><div class="stat-chip-lbl">Fixtures</div></div>'+
      '<div class="stat-chip gold" style="animation-delay:.07s"><div class="stat-chip-val" style="color:var(--gold);">'+locked+'</div><div class="stat-chip-lbl">Completed</div></div>'+
      '<div class="stat-chip cyan" style="animation-delay:.14s"><div class="stat-chip-val" style="color:var(--cyan);">'+lb.length+'</div><div class="stat-chip-lbl">Teams</div></div>';
  }catch(e){}
}

async function loadPlayers(){
  _allPlayers=await API.fetchAllPlayers();
  var pomSel=document.getElementById('m-pom');
  if(pomSel) pomSel.innerHTML='<option value="">— Select Player —</option>'+_allPlayers.map(function(p){return '<option value="'+p.id+'">'+p.name+' · '+(p.ipl_team||'?')+'</option>';}).join('');
  var statSel=document.getElementById('stats-player-select');
  if(statSel) statSel.innerHTML='<option value="">— Select player —</option>'+_allPlayers.map(function(p){return '<option value="'+p.id+'">'+p.name+' · '+(p.ipl_team||'?')+(p.is_overseas?' 🌏':'')+'</option>';}).join('');
}

async function loadMatches(){
  _allMatches=await API.fetchMatches({limit:74});
  renderFixtureList();
  // Populate all match dropdowns including override-match (Audit Fix #17)
  ['stats-match-select','calc-match-select','override-match'].forEach(function(id){
    var sel=document.getElementById(id); if(!sel) return;
    var cur=sel.value;
    sel.innerHTML='<option value="">— Select match —</option>'+_allMatches.map(function(m){
      return '<option value="'+m.id+'">M'+(m.match_no||'')+'  · '+UI.esc(tShort(m.team1)+' vs '+tShort(m.team2))+' · '+UI.shortDate(m.match_date)+'</option>';
    }).join('');
    if(cur) sel.value=cur;
  });
}

function renderFixtureList(){
  var cont=document.getElementById('fixtures-list');
  if(!_allMatches.length){cont.innerHTML='<div style="padding:20px;text-align:center;color:var(--text3);font-size:13px;">No fixtures — click ⚡ Load IPL 2026</div>';return;}
  cont.innerHTML=_allMatches.map(function(m,i){
    var c1=tCode(m.team1),c2=tCode(m.team2);
    var col1=c1&&TCOLS[c1]?TCOLS[c1]:'var(--text2)', col2=c2&&TCOLS[c2]?TCOLS[c2]:'var(--text2)';
    var l1=tLogo(m.team1),l2=tLogo(m.team2);
    var dateStr=m.match_date?new Date(m.match_date).toLocaleDateString('en-IN',{day:'2-digit',month:'short'}):'—';
    var sCls=m.is_locked?(m.winner?'status-done':'status-locked'):'status-open';
    var sTxt=m.is_locked?(m.winner?'Done':'Locked'):'Open';
    return '<div class="fixture-row" onclick="editMatch(\''+m.id+'\')" style="animation:row-in .22s ease '+(.025*i)+'s both;">'+
      '<span class="fixture-num">'+(m.match_no||i+1)+'</span>'+
      '<div class="fx-teams">'+
        (l1?'<img src="'+l1+'" style="width:16px;height:16px;object-fit:contain;flex-shrink:0;" onerror="this.style.display=\'none\'">':'')+
        '<span class="fx-team-name" style="color:'+col1+';">'+UI.esc(tShort(m.team1))+'</span>'+
        '<span class="fixture-vs">VS</span>'+
        '<span class="fx-team-name" style="color:'+col2+';">'+UI.esc(tShort(m.team2))+'</span>'+
        (l2?'<img src="'+l2+'" style="width:16px;height:16px;object-fit:contain;flex-shrink:0;" onerror="this.style.display=\'none\'">':'')+
      '</div>'+
      '<span class="fixture-date">'+dateStr+'</span>'+
      (m.venue?'<span class="fixture-venue">'+UI.esc(m.venue)+'</span>':'')+
      '<span class="match-status '+sCls+'" style="font-size:11px;">'+sTxt+'</span>'+
      '<button class="btn btn-ghost btn-sm fixture-edit" onclick="event.stopPropagation();editMatch(\''+m.id+'\')" style="font-size:11px;padding:3px 8px;">Edit</button>'+
    '</div>';
  }).join('');
}

async function loadIPLFixtures(event){
  UI.showConfirm({
    icon: '⚡', title: 'Load IPL Fixtures?',
    msg: 'Insert all 20 IPL 2026 Part 1 fixtures?\nExisting fixtures with same match_no will be skipped.',
    okLabel: 'Load 20 Matches', okClass: 'btn-accent',
    onOk: async function() {
      var btn=event.target; if(btn._busy) return; btn._busy=true; btn.disabled=true; btn.innerHTML='<span class="btn-spin"></span> Loading…';
      var loaded=0, skipped=0;
      try{
        for(var i=0;i<IPL_FIXTURES.length;i++){
          var f=IPL_FIXTURES[i];
          if(_allMatches.find(function(m){return m.match_no===f.no;})){skipped++;continue;}
          var isoDate=new Date(f.date+'T'+f.time+':00+05:30').toISOString();
          await API.upsertMatch({match_title:'Match '+f.no+' · '+tShort(f.home)+' vs '+tShort(f.away),match_no:f.no,team1:f.home,team2:f.away,venue:f.venue,match_date:isoDate,is_locked:false});
          loaded++;
        }
        UI.toast('Loaded '+loaded+' fixtures'+(skipped?' · '+skipped+' skipped':''),'success');
        await loadMatches(); await loadAdminStats();
      }catch(e){UI.toast('Load failed: '+e.message,'error');}
      btn._busy=false; btn.disabled=false; btn.innerHTML='⚡ Load IPL 2026';
    }
  });
}

function clearMatchForm(){
  document.getElementById('edit-match-id').value=''; document.getElementById('edit-badge-wrap').style.display='none';
  ['m-no','m-target'].forEach(function(id){var e=document.getElementById(id);if(e)e.value='';});
  ['m-team1','m-team2','m-winner','m-venue','m-pom'].forEach(function(id){var e=document.getElementById(id);if(e)e.value='';});
  document.getElementById('m-date').value=''; document.getElementById('m-time').value='19:30'; document.getElementById('m-autolock').value='15';
  ['logo-home','logo-away','logo-winner'].forEach(function(id){var e=document.getElementById(id);if(e){e.style.display='none';e.parentElement&&e.parentElement.querySelector&&e.parentElement.querySelector('.form-select')&&e.parentElement.querySelector('.form-select').classList.remove('has-logo');}});
  buildTeamDropdowns();
}

function editMatch(matchId){
  var m=_allMatches.find(function(x){return x.id===matchId;}); if(!m) return;
  document.getElementById('edit-match-id').value=m.id;
  document.getElementById('edit-badge-wrap').style.display=''; document.getElementById('edit-badge-text').textContent='Editing M'+(m.match_no||'');
  document.getElementById('m-no').value=m.match_no||'';
  buildTeamDropdowns();
  document.getElementById('m-team1').value=m.team1||''; document.getElementById('m-team2').value=m.team2||'';
  if(m.match_date){
    var dt=new Date(m.match_date);
    document.getElementById('m-date').value=dt.toLocaleDateString('sv',{timeZone:'Asia/Kolkata'});
    document.getElementById('m-time').value=String(dt.getHours()).padStart(2,'0')+':'+String(dt.getMinutes()).padStart(2,'0');
  }
  document.getElementById('m-venue').value=m.venue||''; document.getElementById('m-target').value=m.actual_target||'';
  document.getElementById('m-autolock').value=m.auto_lock_mins||15;
  syncWinnerDropdown(); document.getElementById('m-winner').value=m.winner||''; onTeamChange('winner');
  var pom=document.getElementById('m-pom'); if(pom&&m.player_of_match) pom.value=m.player_of_match;
  onTeamChange('home'); onTeamChange('away');
  document.getElementById('m-no').scrollIntoView({behavior:'smooth',block:'nearest'});
}

async function saveMatch(){
  var id=document.getElementById('edit-match-id').value, team1=document.getElementById('m-team1').value, team2=document.getElementById('m-team2').value;
  if(!team1||!team2){UI.toast('Select both teams','warn');return;}
  var date=document.getElementById('m-date').value, time=document.getElementById('m-time').value||'19:30', no=parseInt(document.getElementById('m-no').value||0)||null;
  var match={
    match_title:'Match '+(no||'')+' · '+tShort(team1)+' vs '+tShort(team2), match_no:no, team1:team1, team2:team2,
    venue:document.getElementById('m-venue').value, auto_lock_mins:parseInt(document.getElementById('m-autolock').value||15),
    match_date:date?new Date(date+'T'+time+':00+05:30').toISOString():null,
    actual_target:parseInt(document.getElementById('m-target').value||0)||null, winner:document.getElementById('m-winner').value||null,
    player_of_match:document.getElementById('m-pom').value||null, is_locked:!!document.getElementById('m-winner').value,
  };
  if(id) match.id=id;
  try{await API.upsertMatch(match); UI.toast('Fixture saved!','success'); clearMatchForm(); await loadMatches(); await loadAdminStats();}
  catch(e){UI.toast('Save failed: '+e.message,'error');}
}

// Audit Fix #17: loadTeams populates override-team select on every loadAll() call
async function loadTeams(){
  var lb=await API.fetchLeaderboard(); _allTeamsData=lb;
  // Populate override select immediately — works regardless of which tab is active
  var overrideSel=document.getElementById('override-team');
  if(overrideSel) overrideSel.innerHTML='<option value="">— Select team —</option>'+lb.map(function(r){return '<option value="'+r.fantasy_team_id+'">'+UI.esc(r.team?r.team.team_name:'—')+'</option>';}).join('');
  var tbody=document.getElementById('teams-tbody');
  if(!tbody) return;
  if(!lb.length){tbody.innerHTML='<tr><td colspan="5" class="empty-state">No teams yet</td></tr>';return;}
  tbody.innerHTML=lb.map(function(r){
    var logo=tLogo(r.team?r.team.team_name:''); var code=tCode(r.team?r.team.team_name:''); var col=code&&TCOLS[code]?TCOLS[code]:'var(--text)';
    return '<tr><td class="rank">'+r.rank+'</td>'+
      '<td><div style="display:flex;align-items:center;gap:9px;">'+(logo?'<img src="'+logo+'" style="width:22px;height:22px;object-fit:contain;" onerror="this.style.display=\'none\'">':'')+
      '<span style="font-family:var(--f-ui);font-weight:400;font-size:14px;color:'+col+';">'+UI.esc(r.team?r.team.team_name:'—')+'</span></div></td>'+
      '<td style="color:var(--text2);">'+UI.esc(r.team?r.team.owner_name||'—':'—')+'</td>'+
      '<td>'+r.matches_played+'</td><td class="pts">'+r.total_points+'</td></tr>';
  }).join('');
}

function switchTab(tab) {
  // 1. Hide all panels and remove active state from buttons
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.sb-link').forEach(l => l.classList.remove('active'));
  document.querySelectorAll('.bnav-link').forEach(l => l.classList.remove('active'));

  // 2. Show the selected panel
  const panel = document.getElementById('tab-' + tab);
  if (panel) panel.classList.add('active');

  // 3. Mark the buttons/icons as active
  // This finds the mobile icon and highlights it
  const mobileIcon = document.querySelector(`.bnav-link[onclick*="${tab}"]`);
  if (mobileIcon) mobileIcon.classList.add('active');
  
  const sidebarLink = document.querySelector(`.sb-link[onclick*="${tab}"]`);
  if (sidebarLink) sidebarLink.classList.add('active');

  // 4. Special logic for specific tabs
  if (tab === 'blogs') loadBlogList();
  
  // 5. Scroll to top on mobile
  window.scrollTo(0, 0);
}

// ── Stats ──────────────────────────────────────────────────────
async function onStatsMatchChange(){
  var matchId=document.getElementById('stats-match-select').value;
  document.getElementById('stats-form-card').style.display='none';
  if(!matchId) return;
  await loadSavedStats(matchId);
}

async function loadSavedStats(matchId){
  var card=document.getElementById('saved-stats-card'), list=document.getElementById('saved-stats-list');
  card.style.display='none';
  try{
    var stats=await API.fetchPlayerStats(matchId); if(!stats.length) return;
    card.style.display='';
    list.innerHTML=stats.map(function(s){
      var p=s.player||{}, est=API.calcBattingPoints(s)+API.calcBowlingPoints(s)+API.calcFieldingPoints(s);
      var logo=tLogo(p.ipl_team||''); var code=tCode(p.ipl_team||''); var col=code&&TCOLS[code]?TCOLS[code]:'var(--text)';
      return '<div class="stats-saved-row">'+
        (logo?'<img src="'+logo+'" style="width:22px;height:22px;object-fit:contain;" onerror="this.style.display=\'none\'">':'')+
        '<div style="flex:1;"><div style="font-family:var(--f-ui);font-weight:400;font-size:14px;color:'+col+';">'+UI.esc(p.name||'—')+'</div></div>'+
        '<div style="font-size:12px;color:var(--text2);font-family:var(--f-mono);">R:'+(s.runs||0)+' W:'+(s.wickets||0)+' C:'+(s.catches||0)+'</div>'+
        '<div style="font-family:var(--f-display);font-weight:600;font-size:18px;color:var(--accent);min-width:44px;text-align:right;">'+Math.round(est)+'</div>'+
      '</div>';
    }).join('');
  }catch(e){}
}

function prefillStats(){
  var pid=document.getElementById('stats-player-select').value;
  if(!pid){document.getElementById('stats-form-card').style.display='none';return;}
  var player=_allPlayers.find(function(p){return p.id===pid;});
  var logo=player?tLogo(player.ipl_team||''):''; var code=player?tCode(player.ipl_team||''):''; var col=code&&TCOLS[code]?TCOLS[code]:'var(--text)';
  var logoEl=document.getElementById('stats-team-logo');
  if(logoEl&&logo){logoEl.src=logo;logoEl.style.display='';}else if(logoEl) logoEl.style.display='none';
  var spl=document.getElementById('logo-stats-player');
  if(spl&&logo){spl.src=logo;spl.style.display='';document.getElementById('stats-player-select').classList.add('has-logo');}
  document.getElementById('stats-player-name').textContent=player?player.name:'—';
  document.getElementById('stats-player-name').style.color=col;
  document.getElementById('stats-player-chips').innerHTML=(player?UI.roleBadge(player.role):'')+(player&&player.is_overseas?'<span class="role-tag rt-os" style="font-size:10px;margin-left:4px;">OS</span>':'');
  document.getElementById('stat-match-id').value=document.getElementById('stats-match-select').value;
  document.getElementById('stat-player-id').value=pid;
  clearStatsForm(false); document.getElementById('stats-form-card').style.display='';
}

function clearStatsForm(hide){
  if(hide===undefined) hide=true;
  ['s-runs','s-balls','s-fours','s-sixes','s-wickets','s-overs','s-runsc','s-maidens','s-catches','s-runouts','s-stumpings'].forEach(function(id){var e=document.getElementById(id);if(e)e.value='';});
  document.getElementById('s-notout').value='';
  if(hide) document.getElementById('stats-form-card').style.display='none';
  recalcLive();
}

function getStatsObj(){
  return{
    runs:parseInt(UI.el('s-runs')&&UI.el('s-runs').value||0),
    balls_faced:parseInt(UI.el('s-balls')&&UI.el('s-balls').value||0),
    fours:parseInt(UI.el('s-fours')&&UI.el('s-fours').value||0),
    sixes:parseInt(UI.el('s-sixes')&&UI.el('s-sixes').value||0),
    not_out:UI.el('s-notout')&&UI.el('s-notout').value==='true',
    wickets:parseInt(UI.el('s-wickets')&&UI.el('s-wickets').value||0),
    overs_bowled:parseFloat(UI.el('s-overs')&&UI.el('s-overs').value||0),
    runs_conceded:parseInt(UI.el('s-runsc')&&UI.el('s-runsc').value||0),
    maidens:parseInt(UI.el('s-maidens')&&UI.el('s-maidens').value||0),
    catches:parseInt(UI.el('s-catches')&&UI.el('s-catches').value||0),
    run_outs:parseInt(UI.el('s-runouts')&&UI.el('s-runouts').value||0),
    stumpings:parseInt(UI.el('s-stumpings')&&UI.el('s-stumpings').value||0)
  };
}
function recalcLive(){
  var s=getStatsObj(); var pts=API.calcBattingPoints(s)+API.calcBowlingPoints(s)+API.calcFieldingPoints(s);
  var el=UI.el('live-pts'); if(el) el.textContent=Math.round(pts);
}
async function saveStats(){
  var matchId=UI.el('stat-match-id').value, playerId=UI.el('stat-player-id').value;
  if(!matchId||!playerId){UI.toast('Select match and player first','warn');return;}
  var s=getStatsObj(); s.match_id=matchId; s.player_id=playerId;
  try{await API.upsertPlayerStats(s);UI.toast('Stats saved!','success');await loadSavedStats(matchId);}
  catch(e){UI.toast('Save failed: '+e.message,'error');}
}

// ── CSV Upload — Audit Fix #18: player_name → UUID lookup ─────
function onCSVDrop(event){event.preventDefault();event.currentTarget.classList.remove('drag-over');var file=event.dataTransfer.files[0];if(file)processCSVFile(file);}
function onCSVFile(event){var file=event.target.files[0];if(file)processCSVFile(file);}

async function processCSVFile(file){
  var matchId=UI.el('stats-match-select').value;
  if(!matchId){UI.toast('Select a match first','warn');return;}
  var text=await file.text();
  var preview=document.getElementById('csv-preview');
  try{
    var rawRows=API.parseStatsCsv(text,matchId);
    // Resolve player names to IDs where player_id is missing/empty
    var resolved=[], errors=[];
    for(var i=0;i<rawRows.length;i++){
      var r=rawRows[i];
      if(!r.player_id&&r.player_name){
        // Fuzzy match: case-insensitive includes
        var name=(r.player_name||'').trim().toLowerCase();
        var match=_allPlayers.find(function(p){return p.name.toLowerCase()===name;})
                ||_allPlayers.find(function(p){return p.name.toLowerCase().includes(name)||name.includes(p.name.toLowerCase().split(' ').pop());});
        if(match){r.player_id=match.id; r._resolved_name=match.name;}
        else{errors.push('Row '+(i+2)+': could not find player "'+r.player_name+'"');}
      }
      if(r.player_id) resolved.push(r);
    }
    // Clean up helper columns
    resolved.forEach(function(r){delete r.player_name; delete r._resolved_name;});
    // Validate UUIDs
    var uuidRe=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    resolved=resolved.filter(function(r){
      if(!uuidRe.test(r.player_id)){errors.push('Invalid UUID skipped: '+r.player_id);return false;}
      return true;
    });

    preview.style.display='';
    preview.innerHTML=
      (errors.length?'<div class="csv-status-err" style="font-size:12px;margin-bottom:8px;background:var(--red-dim);border:1px solid rgba(255,77,109,.25);border-radius:6px;padding:8px 12px;">⚠ '+errors.length+' row(s) skipped:<br>'+errors.map(UI.esc).join('<br>')+'</div>':'')+
      '<div style="font-size:13px;color:var(--text2);margin-bottom:8px;">Ready to upload <strong>'+resolved.length+'</strong> rows.</div>'+
      '<div class="table-wrap" style="max-height:180px;overflow-y:auto;"><table class="data-table"><thead><tr><th>Player</th><th>R</th><th>W</th><th>C</th></tr></thead><tbody>'+
      resolved.slice(0,6).map(function(r){
        var p=_allPlayers.find(function(p){return p.id===r.player_id;});
        return '<tr><td style="font-size:12px;">'+(p?UI.esc(p.name):UI.esc(String(r.player_id).substring(0,8))+'…')+'</td><td>'+r.runs+'</td><td>'+r.wickets+'</td><td>'+r.catches+'</td></tr>';
      }).join('')+
      '</tbody></table></div>'+
      (resolved.length?'<button class="btn btn-accent btn-sm" style="margin-top:10px;" onclick=\'uploadCSVStats('+JSON.stringify(resolved).replace(/</g,'\\u003c').replace(/'/g,'\\u0027')+')\'>Upload '+resolved.length+' rows</button>':'');
  }catch(e){UI.toast('CSV parse failed: '+e.message,'error');}
}

async function uploadCSVStats(rows){
  try{
    await API.bulkUpsertPlayerStats(rows);
    UI.toast('Uploaded '+rows.length+' stat rows!','success');
    document.getElementById('csv-preview').style.display='none';
    document.getElementById('csv-file-input').value='';
    await loadSavedStats(UI.el('stats-match-select').value);
  }catch(e){UI.toast('Upload failed: '+e.message,'error');}
}

// ── Calculate ──────────────────────────────────────────────────
function addLog(msg,type){
  var log=UI.el('calc-log'); if(!log) return;
  var line=document.createElement('div'); line.className='calc-log-line '+(type||'');
  line.textContent='['+new Date().toLocaleTimeString('en-IN')+'] '+msg;
  log.appendChild(line); log.scrollTop=log.scrollHeight;
}

async function calculatePoints(){
  var matchId=UI.el('calc-match-select').value; if(!matchId){UI.toast('Select a match first','warn');return;}
  var match=_allMatches.find(function(m){return m.id===matchId;});
  var teamCount=_allTeamsData.length||'all';
  
  UI.showConfirm({
    icon: '🧾', title: 'Calculate Points?',
    msg: 'Calculate points for '+(match?(match.team1+' vs '+match.team2):matchId)+'?',
    consequence: 'This will score '+teamCount+' team(s) and lock the match.',
    okLabel: 'Calculate & Lock', okClass: 'btn-accent',
    onOk: async function() {
      var btn=UI.el('calc-btn'); if(btn._busy) return; btn._busy=true; btn.disabled=true; btn.innerHTML='<span class="btn-spin"></span> Calculating…';
      UI.el('calc-log').innerHTML=''; addLog('Starting calculation…');
      try{
        var results=await API.calculateMatchPoints(matchId,addLog);
        addLog('Calculated '+results.length+' teams.','good'); addLog('Leaderboard refreshed · Match locked ✓','good');
        UI.toast('Points calculated & match locked!','success');
        await Promise.all([loadMatches(),loadAdminStats(),loadTeams()]);
      }catch(e){addLog('ERROR: '+e.message,'error');UI.toast('Calculation failed: '+e.message,'error');}
      btn._busy=false; btn.disabled=false; btn.innerHTML='⚡ Calculate &amp; Lock';
    }
  });
}

async function recalculate(){
  var matchId=UI.el('calc-match-select').value; if(!matchId){UI.toast('Select a match first','warn');return;}
  var match=_allMatches.find(function(m){return m.id===matchId;});
  var teamCount=_allTeamsData.length||'all';
  
  UI.showConfirm({
    icon: '↻', title: 'Danger: Recalculate?',
    msg: 'RECALCULATE: '+(match?(match.team1+' vs '+match.team2):matchId)+'?',
    consequence: 'This will DELETE existing points for '+teamCount+' team(s) and redo from scratch. Cannot be undone.',
    okLabel: 'Recalculate All', okClass: 'btn-danger',
    onOk: async function() {
      var btn=UI.el('recalc-btn'); if(btn._busy) return; btn._busy=true; btn.disabled=true; btn.innerHTML='<span class="btn-spin"></span> Recalculating…';
      UI.el('calc-log').innerHTML=''; addLog('Deleting existing points…');
      try{
        var results=await API.recalculateMatch(matchId,addLog);
        addLog('Done — '+results.length+' teams recalculated.','good');
        UI.toast('Recalculation complete!','success');
        await Promise.all([loadMatches(),loadAdminStats(),loadTeams()]);
      }catch(e){addLog('ERROR: '+e.message,'error');UI.toast('Recalculation failed: '+e.message,'error');}
      btn._busy=false; btn.disabled=false; btn.innerHTML='↻ Recalculate (delete &amp; redo)';
    }
  });
}

// ── Override ──────────────────────────────────────────────────
async function submitOverride(){
  var matchId=UI.el('override-match').value, teamId=UI.el('override-team').value;
  var adj=parseInt(UI.el('override-adj').value||0), reason=UI.el('override-reason').value.trim();
  if(!matchId||!teamId){UI.toast('Select match and team','warn');return;}
  if(!adj){UI.toast('Enter a non-zero adjustment','warn');return;}
  if(!reason){UI.toast('Enter a reason','warn');return;}
  var matchName=_allMatches.find(function(m){return m.id===matchId;}); var matchLabel=matchName?(matchName.team1+' vs '+matchName.team2):matchId;
  var teamName=_allTeamsData.find(function(r){return r.fantasy_team_id===teamId;}); var teamLabel=teamName&&teamName.team?teamName.team.team_name:teamId;
  
  UI.showConfirm({
    icon: '⚖️', title: 'Apply Points Override?',
    msg: 'Team: ' + teamLabel + '\nMatch: ' + matchLabel + '\nAdjustment: ' + (adj>0?'+':'') + adj + ' pts',
    consequence: 'Reason: ' + reason,
    okLabel: 'Apply Override', okClass: 'btn-accent',
    onOk: async function() {
      try{
        await API.overridePoints(matchId,teamId,adj,reason);
        document.getElementById('override-log').innerHTML='<div class="override-confirm mt-8">✓ Override applied: '+(adj>0?'+':'')+adj+' pts to '+UI.esc(teamLabel)+' · "'+UI.esc(reason)+'"</div>';
        UI.toast('Override applied!','success');
        UI.el('override-adj').value=''; UI.el('override-reason').value='';
        await loadTeams();
      }catch(e){UI.toast('Override failed: '+e.message,'error');}
    }
  });
}

// ── Blogs admin ───────────────────────────────────────────────
var _blogFilter = 'all';
function filterBlogList(status){
  _blogFilter=status;
  ['all','draft','pub'].forEach(function(s){
    var btn=document.getElementById('bfilter-'+s);
    if(btn) btn.className='btn btn-sm '+(status===s||(status==='published'&&s==='pub')?'btn-accent':'btn-ghost');
  });
  loadBlogList();
}

async function loadBlogList(){
  var cont=document.getElementById('blog-admin-list');
  try{
    var opts={limit:50,publishedOnly:false};
    if(_blogFilter==='draft') opts.status='draft';
    else if(_blogFilter==='published') opts.status='published';
    var blogs=await API.fetchBlogs(opts);
    if(!blogs.length){cont.innerHTML='<div style="padding:20px;color:var(--text3);font-size:13px;">No posts — create one or use AI Generate!</div>';return;}
    var catColors={preview:'#38d9f5',tips:'#c8f135',announcement:'#f5c842',recap:'#a78bfa',general:'#94a3b8'};
    var statusColors={draft:'var(--gold)',review:'var(--cyan)',published:'var(--green)'};
    cont.innerHTML=blogs.map(function(b,i){
      var col=catColors[b.category]||'#94a3b8';
      var sCls='status-'+(b.status==='published'?'done':b.status==='review'?'upcoming':'locked');
      return '<div class="fixture-row" onclick="editBlogAdmin(\'' + b.id + '\')" style="animation:row-in .22s ease '+(.04*i)+'s both;">'+
        '<div style="flex:1;min-width:0;"><div style="font-family:var(--f-ui);font-weight:400;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+
          (b.ai_generated?'🤖 ':'')+UI.esc(b.title)+'</div>'+
        '<div style="display:flex;gap:6px;margin-top:2px;flex-wrap:wrap;">'+
          '<span style="background:'+col+'22;color:'+col+';font-family:var(--f-ui);font-size:10px;font-weight:600;padding:1px 6px;border-radius:3px;">'+UI.esc(b.category)+'</span>'+
          '<span class="match-status '+sCls+'" style="font-size:10px;">'+UI.esc(b.status||'draft')+'</span>'+
          '<span style="font-size:11px;color:var(--text3);">'+UI.shortDate(b.created_at)+'</span>'+
          '<span style="font-size:11px;color:var(--text3);">'+b.views+' views</span>'+
        '</div></div>'+
        '<button class="btn btn-ghost btn-sm fixture-edit" onclick="event.stopPropagation();editBlogAdmin(\''+b.id+'\')" style="font-size:11px;padding:3px 8px;">Edit</button>'+
      '</div>';
    }).join('');
  }catch(e){cont.innerHTML='<div style="padding:14px;color:var(--red);font-size:13px;">'+UI.esc(e.message)+'</div>';}
}

function clearBlogForm(){
  UI.el('blog-id').value=''; UI.el('b-title').value=''; UI.el('b-excerpt').value='';
  UI.el('b-category').value='general'; UI.el('b-content').value=''; UI.el('b-published').checked=false;
  var del=UI.el('del-blog-btn'); if(del) del.style.display='none';
  var pub=UI.el('pub-blog-btn'); if(pub) pub.style.display='none';
}

async function editBlogAdmin(blogId){
  try{
    var b=await API.fetchBlog(blogId,true); if(!b) return;
    UI.el('blog-id').value=b.id; UI.el('b-title').value=b.title;
    UI.el('b-excerpt').value=b.excerpt||''; UI.el('b-category').value=b.category||'general';
    UI.el('b-content').value=b.content; UI.el('b-published').checked=!!b.is_published;
    var del=UI.el('del-blog-btn'); if(del) del.style.display='';
    var pub=UI.el('pub-blog-btn');
    if(pub) pub.style.display=(b.status!=='published'?'':'none');
  }catch(e){UI.toast('Load failed: '+e.message,'error');}
}

async function saveBlogAdmin(){
  var id=UI.el('blog-id').value, title=UI.el('b-title').value.trim(), content=UI.el('b-content').value.trim();
  if(!title||!content){UI.toast('Title and content required','warn');return;}
  var isPublished=UI.el('b-published').checked;
  var blog={title,content,excerpt:UI.el('b-excerpt').value.trim()||null,category:UI.el('b-category').value,is_published:isPublished,status:isPublished?'published':'draft'};
  if(id) blog.id=id;
  try{await API.upsertBlog(blog);UI.toast('Post saved!','success');clearBlogForm();await loadBlogList();}
  catch(e){UI.toast('Save failed: '+e.message,'error');}
}

async function publishBlogAdmin(){
  var id=UI.el('blog-id').value; if(!id) return;
  var title=UI.el('b-title').value;
  
  UI.showConfirm({
    icon: '🚀', title: 'Publish Blog Post?',
    msg: 'Approve and publish "' + title + '"?',
    consequence: 'This will make the post visible to all users immediately.',
    okLabel: 'Publish Now', okClass: 'btn-accent',
    onOk: async function() {
      try{
        await API.publishBlog(id,'admin');
        UI.toast('Blog published!','success');
        clearBlogForm(); await loadBlogList();
      }catch(e){UI.toast('Publish failed: '+e.message,'error');}
    }
  });
}

async function deleteBlogAdmin(){
  var id=UI.el('blog-id').value; if(!id) return;
  UI.showConfirm({
    icon: '🗑️', title: 'Delete Blog Post?',
    msg: 'Are you sure you want to delete this post permanently?',
    consequence: 'This action cannot be undone.',
    okLabel: 'Delete Forever', okClass: 'btn-danger',
    onOk: async function() {
      try{await API.deleteBlog(id);UI.toast('Post deleted','warn');clearBlogForm();await loadBlogList();}
      catch(e){UI.toast('Delete failed: '+e.message,'error');}
    }
  });
}

function showAIGen(){
  var panel=document.getElementById('ai-gen-panel');
  if(panel) panel.style.display=panel.style.display==='none'?'':'none';
}

async function generateAIBlog(){
  var title=document.getElementById('ai-title').value.trim();
  var cat=document.getElementById('ai-category').value;
  var ctx=document.getElementById('ai-context').value.trim();
  if(!title){UI.toast('Enter a title / topic','warn');return;}
  var btn=document.getElementById('ai-gen-btn');
  var icon=document.getElementById('ai-gen-icon');
  if(btn._busy)return; btn._busy=true; btn.disabled=true; icon.textContent='⏳';
  try{
    var blog=await API.generateAIBlog({title,category:cat,context:ctx});
    UI.el('blog-id').value=blog.id;
    UI.el('b-title').value=blog.title;
    UI.el('b-excerpt').value=blog.excerpt||'';
    UI.el('b-category').value=blog.category||'general';
    UI.el('b-content').value=blog.content;
    UI.el('b-published').checked=false;
    document.getElementById('ai-gen-panel').style.display='none';
    var pub=UI.el('pub-blog-btn'); if(pub) pub.style.display='';
    var del=UI.el('del-blog-btn'); if(del) del.style.display='';
    await loadBlogList();
    UI.toast('AI draft created — review and approve to publish!','success',5000);
  }catch(e){UI.toast('AI generation failed: '+e.message,'error');}
  btn._busy=false; btn.disabled=false; icon.textContent='✨';
}

// ── Audit log ─────────────────────────────────────────────────
async function loadAuditLog(){
  var tbody=document.getElementById('audit-log-tbody'); if(!tbody) return;
  var filter=document.getElementById('log-filter')&&document.getElementById('log-filter').value||null;
  try{
    var logs=await API.fetchActionLog({limit:100,actionType:filter||null});
    if(!logs.length){tbody.innerHTML='<tr><td colspan="5" class="empty-state">No log entries</td></tr>';return;}
    var typeColors={'stat_entry':'#60a5fa','match_edit':'#c8f135','adjustment':'#f5c842','injury_set':'#f87171','replacement_created':'#38d9f5','blog_published':'#34d399'};
    tbody.innerHTML=logs.map(function(l){
      var col=typeColors[l.action_type]||'var(--text2)';
      return '<tr>'+
        '<td style="font-size:11px;color:var(--text3);white-space:nowrap;">'+UI.shortDate(l.created_at)+'</td>'+
        '<td><span style="background:'+col+'22;color:'+col+';font-size:10px;font-weight:400;padding:2px 7px;border-radius:3px;font-family:var(--f-ui);">'+UI.esc(l.action_type)+'</span></td>'+
        '<td style="font-size:12px;">'+UI.esc(l.entity_type)+'</td>'+
        '<td style="font-size:10px;color:var(--text3);font-family:var(--f-mono);">'+UI.esc((l.entity_id||'').substring(0,12))+'…</td>'+
        '<td style="font-size:12px;">'+UI.esc(l.performed_by||'admin')+'</td>'+
      '</tr>';
    }).join('');
    // Show undo button if stat entries are visible
    var undoWrap=document.getElementById('undo-last-wrap');
    if(undoWrap) undoWrap.style.display=logs.some(function(l){return l.action_type==='stat_entry';})?'':'none';
  }catch(e){tbody.innerHTML='<tr><td colspan="5" style="color:var(--red);padding:12px;">'+UI.esc(e.message)+'</td></tr>';}
}


// ── Responsive ────────────────────────────────────────────────
function fixGrids(){
  var narrow=window.innerWidth<720;
  var ids=['fixtures-grid','calc-grid','blogs-grid'];
  ids.forEach(function(id){
    var g=document.getElementById(id);
    if(g) g.style.gridTemplateColumns=narrow?'1fr':'1fr 1fr';
  });
}
window.addEventListener('resize',()=>fixGrids()); 
fixGrids();

init();