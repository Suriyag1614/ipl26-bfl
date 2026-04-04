
'use strict';
var _squad=[], _playerPts={}, _filter='', _myTeamId=null, _myTeam=null;
function safeArr(v){return Array.isArray(v)?v:(v?[v]:[]);}
function fbUrl(n){return 'https://ui-avatars.com/api/?name='+encodeURIComponent(n||'P')+'&background=1a2035&color=c8f135&size=128';}
function imgTag(src,name,cls){return '<img class="'+( cls||'')+'" src="'+UI.esc(src||fbUrl(name))+'" data-fb="'+UI.esc(fbUrl(name))+'" alt="'+UI.esc(name||'')+'" onerror="this.onerror=null;this.src=this.dataset.fb">';}
async function init(){
  try {
    var sess=await Auth.requireAuth(); if(!sess)return;
    if(Auth.isAdmin(sess.user)){window.location.href='admin.html';return;}
    await initNavbar('squad');
    _myTeam=await Auth.fetchTeam(sess.user.id);
    if(!_myTeam){UI.toast('Team not found','error');return;}
    _myTeamId=_myTeam.id;
    await loadSquad();
    loadPointsByPlayer();
  } catch(err) {
    console.error('[init]', err);
    UI.toast('Initialization failed: ' + err.message, 'error');
  }
}
async function loadSquad(){
  try{
    var raw = await API.fetchSquad(_myTeamId);
    _squad=safeArr(raw);
    renderSquad(); renderSummary(); renderRoleBreakdown();
  }catch(e){
    console.error('[loadSquad]', e);
    UI.toast('Could not load squad: '+e.message,'error');
    var g=document.getElementById('player-grid');
    if(g) g.innerHTML='<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">!</div><div class="empty-state-text">'+UI.esc(e.message)+'</div></div>';
  }
}
async function loadPointsByPlayer(){
  try{
    var data = await API.fetchPointsBreakdown(_myTeamId);
    var logs = safeArr(data);
    logs.forEach(function(l){
      var players = safeArr(l.breakdown && l.breakdown.players);
      players.forEach(function(p){
        _playerPts[p.name] = (_playerPts[p.name]||0)+(p.final||0);
      });
    });
    renderSquad();
  }catch(e){ console.warn('[loadPointsByPlayer]', e); }
}
function setFilter(role){
  _filter=role;
  var order=['','Batter','Bowler','All-Rounder','Wicket-Keeper'];
  document.querySelectorAll('.filter-tab').forEach(function(b,i){
    b.classList.toggle('active', order[i]===role);
  });
  renderSquad();
}
function renderSquad(){
  var list=_filter?_squad.filter(function(s){return s.player&&s.player.role===_filter;}):_squad;
  var grid=document.getElementById('player-grid'); if(!grid)return;
  if(!list.length){
    grid.innerHTML='<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">!</div><div class="empty-state-text">'+(_squad.length?'No players in this category':'Squad is empty')+'</div></div>';
    return;
  }
  var C={CSK:'#fdb913',MI:'#004ba0',RCB:'#da1818',KKR:'#6a1bac',SRH:'#f26522',DC:'#004c93',PBKS:'#ed1b24',RR:'#ea1a85',GT:'#1c2c5b',LSG:'#ff002b',SURA:'#1a3a8a'};
  grid.innerHTML=list.map(function(sp,i){
    var p=sp.player||{}, isCap=!!sp.is_captain, isVC=!!sp.is_vc;
    var color=C[(p.ipl_team||'').replace(/\s+/g,'').toUpperCase()]||'#f0b429';
    var pts=Math.round(_playerPts[p.name]||0), name=p.name||'Player';
    var badges=UI.roleBadge(p.role);
    if(p.is_overseas) badges+=' <span class="role-tag rt-os" style="font-size:9px;">OS</span>';
    if(isCap) badges+=' <span class="badge badge-gold" style="font-size:10px;">2x</span>';
    if(isVC)  badges+=' <span class="badge badge-cyan" style="font-size:10px;">1.5x</span>';
    return '<div class="player-card '+(isCap?'captain':isVC?'vice-cap':'')+'" style="--ipl-color:'+color+';animation-delay:'+(i*0.05)+'s">'+
      (isCap?'<div class="captain-badge">C Captain</div>':isVC?'<div class="captain-badge vc-badge">VC Vice</div>':'')+ 
      imgTag(p.image_url, name, 'player-avatar')+
      '<div class="player-name">'+UI.esc(name)+'</div>'+
      '<div class="player-ipl">'+UI.esc(p.ipl_team||'—')+'</div>'+
      '<div style="display:flex;align-items:center;justify-content:center;gap:4px;flex-wrap:wrap;">'+badges+'</div>'+
      (pts>0?'<div class="player-pts-row"><span style="color:var(--text2)">Season</span><span style="font-family:var(--f-mono);font-weight:600;color:var(--accent)">'+pts+'</span></div>':'')+
    '</div>';
  }).join('');
}
function renderSummary(){
  var cap=_squad.find(function(s){return s.is_captain;}), vc=_squad.find(function(s){return s.is_vc;});
  var os=_squad.filter(function(s){return s.player&&s.player.is_overseas;}).length;
  var el=document.getElementById('squad-summary'); if(!el)return;
  var items = [
    {lbl:'Players',val:_squad.length,unit:'/12'},
    {lbl:'Captain',val:(cap&&cap.player)?cap.player.name:'—',plain:true},
    {lbl:'VC',val:(vc&&vc.player)?vc.player.name:'—',plain:true},
    {lbl:'Overseas',val:os,unit:'/4'}
  ];
  el.innerHTML='<div style="display:flex;gap:20px;flex-wrap:wrap;align-items:center;">'+
    items.map(function(it,i){
      var sep=i?'<div style="width:1px;height:32px;background:var(--border);flex-shrink:0;"></div>':''
      var valHtml=it.plain?'<div style="font-family:var(--f-display);font-weight:600;font-size:15px;">'+UI.esc(String(it.val))+'</div>':
        '<div style="font-family:var(--f-display);font-weight:600;font-size:22px;color:var(--accent);">'+it.val+(it.unit?'<span style="font-size:13px;color:var(--text2);">'+it.unit+'</span>':'')+'</div>';
      return sep+'<div><div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);font-family:var(--f-ui);font-weight:600;margin-bottom:2px;">'+it.lbl+'</div>'+valHtml+'</div>';
    }).join('')+'</div>';
}
function renderRoleBreakdown(){
  var counts={Batter:0,Bowler:0,'All-Rounder':0,'Wicket-Keeper':0};
  _squad.forEach(function(sp){if(sp.player&&sp.player.role)counts[sp.player.role]=(counts[sp.player.role]||0)+1;});
  var labels={Batter:'BAT',Bowler:'BOWL','All-Rounder':'AR','Wicket-Keeper':'WK'};
  var colors={Batter:'#f87171',Bowler:'#60a5fa','All-Rounder':'#34d399','Wicket-Keeper':'#fbbf24'};
  var mins={Batter:2,Bowler:3,'All-Rounder':2,'Wicket-Keeper':1};
  var el=document.getElementById('role-bars'); if(!el)return;
  el.innerHTML=Object.keys(counts).map(function(role){
    var n=counts[role], min=mins[role], met=n>=min;
    return '<div style="flex:1;min-width:100px;">'+
      '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px;">'+
        '<span style="font-family:var(--f-ui);font-weight:600;color:var(--text2);">'+labels[role]+'</span>'+
        '<span style="font-family:var(--f-mono);font-weight:600;color:'+(met?'var(--text)':'var(--red)')+'">'+n+'<span style="color:var(--text3);font-weight:400;">/'+min+'+</span></span>'+
      '</div>'+
      '<div style="height:5px;background:var(--bg3);border-radius:3px;overflow:hidden;">'+
        '<div style="height:100%;background:'+(met?colors[role]:'var(--red)')+';border-radius:3px;width:'+Math.min(100,(n/4)*100)+'%;transition:width 1s ease;"></div>'+
      '</div></div>';
  }).join('');
}
async function exportSquadPDF(){
  try{
    var list=_squad.slice().sort(function(a,b){
      var rA=a.is_captain?0:a.is_vc?1:2, rB=b.is_captain?0:b.is_vc?1:2;
      return rA!==rB?rA-rB:((a.player&&a.player.name)||'').localeCompare((b.player&&b.player.name)||'');
    });
    var os=list.filter(function(r){return r.player&&r.player.is_overseas;}).length;
    var rowsHtml=list.map(function(sqP,i){
      var p=sqP.player||{};
      var tags=[p.is_overseas?'OS':''].filter(Boolean).join(' ');
      var cap=sqP.is_captain, vc=sqP.is_vc;
      return '<tr><td>'+(i+1)+'</td>' +
        '<td><strong>'+UI.esc(p.name||'')+'</strong>'+(tags?'<br><small style="color:#888">'+tags+'</small>':'')+'</td>' +
        '<td>'+UI.esc(p.role||'')+'</td><td>'+UI.esc(p.ipl_team||'')+'</td>' +
        '<td style="text-align:center;font-weight:bold;color:#b7791f">'+(cap?'Captain':vc?'Vice Captain':'')+'</td></tr>';
    }).join('');
    var teamName = (_myTeam && _myTeam.team_name) || 'My Squad';
    var htmlStr = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'+UI.esc(teamName)+'</title>'+
      '<style>body{font-family:Arial,sans-serif;font-size:13px;padding:20px}h1{font-size:18px}table{width:100%;border-collapse:collapse}'+
      'th{background:#1a1a2e;color:#f0b429;padding:7px 9px;text-align:left;font-size:10px}td{padding:6px 9px;border-bottom:1px solid #eee}</style></head><body>'+
      '<h1>'+UI.esc(teamName)+'</h1>'+
      '<p style="font-size:12px;color:#666">BFL IPL 2026 &middot; '+new Date().toLocaleString('en-IN')+'</p>'+
      '<p>Players: '+list.length+'/12 &nbsp; OS: '+os+'/4</p>'+
      '<table><thead><tr><th>#</th><th>Player</th><th>Role</th><th>IPL</th><th>Status</th></tr></thead><tbody>'+rowsHtml+'</tbody></table>'+
      '</body></html>';
    var blob=new Blob([htmlStr], {type:'text/html'});
    var url=URL.createObjectURL(blob);
    var w=window.open(url,'_blank');
    if(!w){UI.toast('Allow popups to open PDF','warn');return;}
    setTimeout(function(){URL.revokeObjectURL(url);},60000);
    UI.toast('PDF opened &mdash; press Ctrl+P to print','success',5000);
  }catch(e){UI.toast('PDF failed: '+e.message,'error');}
}
init();
