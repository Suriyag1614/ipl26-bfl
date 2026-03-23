'use strict';
var _squad=[], _playerPts={}, _filter='', _myTeamId=null, _myTeam=null;
var _repTarget=null, _repSelectedId=null, _confirmCb=null, _allPlayers=[];

function safeArr(v){return Array.isArray(v)?v:(v?[v]:[]);}
function fbUrl(n){return 'https://ui-avatars.com/api/?name='+encodeURIComponent(n||'P')+'&background=1a2035&color=c8f135&size=128';}
function imgTag(src,name,cls){return '<img class="'+(cls||'')+'" src="'+UI.esc(src||fbUrl(name))+'" data-fb="'+UI.esc(fbUrl(name))+'" alt="'+UI.esc(name||'')+'" onerror="this.onerror=null;this.src=this.dataset.fb">';}


async function init(){
  var sess=await Auth.requireAuth(); if(!sess)return;
  if(Auth.isAdmin(sess.user)){window.location.href='admin.html';return;}
  await initNavbar('squad');
  _myTeam=await Auth.fetchTeam(sess.user.id);
  if(!_myTeam){UI.toast('Team not found','error');return;}
  _myTeamId=_myTeam.id;
  _allPlayers=await API.fetchAllPlayers();
  await loadSquad();
  loadPointsByPlayer();
}

async function loadSquad(){
  try{
    _squad=safeArr(await API.fetchSquad(_myTeamId));
    renderSquad(); renderSummary(); renderRoleBreakdown(); renderInjuryBanner(); renderReplacements();
  }catch(e){
    UI.toast('Could not load squad: '+e.message,'error');
    document.getElementById('player-grid').innerHTML='<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">!</div><div class="empty-state-text">'+UI.esc(e.message)+'</div></div>';
  }
}

async function loadPointsByPlayer(){
  try{
    var logs=safeArr(await API.fetchPointsBreakdown(_myTeamId));
    logs.forEach(function(l){
      safeArr(l.breakdown&&l.breakdown.players).forEach(function(p){
        if(!_playerPts[p.name]) _playerPts[p.name]={pts:0,pom:0,pot:0};
        _playerPts[p.name].pts+=(p.final||0);
        if(p.isPom) _playerPts[p.name].pom++;
        if(p.isPot) _playerPts[p.name].pot++;
      });
    });
    renderSquad();
  }catch(e){}
}

function setFilter(role){
  _filter=role;
  var order=['','Batter','Bowler','All-Rounder','Wicket-Keeper'];
  document.querySelectorAll('.filter-tab').forEach(function(b,i){b.classList.toggle('active',order[i]===role);});
  renderSquad();
}

function renderInjuryBanner(){
  var inj=_squad.filter(function(s){return s.player&&s.player.is_injured;});
  var w=document.getElementById('injury-banner-wrap');
  if(!inj.length){w.innerHTML='';return;}
  var names=inj.map(function(s){return s.player.name+(s.player.injury_note?' ('+s.player.injury_note+')':'');}).join(', ');
  w.innerHTML='<div class="injury-banner"><span style="font-size:20px;">&#x1F3E5;</span>'+
    '<div><div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;font-size:15px;color:var(--red);">Injured Players</div>'+
    '<div style="font-size:13px;color:var(--text2);margin-top:2px;">'+UI.esc(names)+' &mdash; set replacements on their player cards.</div></div></div>';
}

function renderReplacements(){
  var reps=_squad.filter(function(s){return s.replacement;});
  var card=document.getElementById('replacements-card');
  if(!reps.length){card.style.display='none';return;}
  card.style.display='';
  document.getElementById('replacements-list').innerHTML=reps.map(function(sp){
    var r=sp.replacement;
    return '<div class="stats-saved-row" style="justify-content:space-between;">'+
      '<div><div style="font-family:var(--f-ui);font-weight:800;font-size:14px;">'+UI.esc(sp.player.name)+'</div>'+
      '<div style="font-size:12px;color:var(--text2);">Replaced by: <strong style="color:var(--cyan);">'+UI.esc(r.replacement&&r.replacement.name||'&mdash;')+'</strong></div></div>'+
      '<button class="btn btn-ghost btn-sm" onclick="confirmRemoveRep(\''+r.id+'\')">Remove</button></div>';
  }).join('');
}

function confirmRemoveRep(repId){
  UI.showConfirm({icon:'&#x21A9;&#xFE0F;',title:'Remove Replacement?',msg:'The original player will be used for calculations.',consequence:'Takes effect for future matches only.',okLabel:'Remove',okClass:'btn-danger',
    onOk:async function(){
      try{await API.deactivateReplacement(repId);UI.toast('Replacement removed','warn');await loadSquad();}
      catch(e){UI.toast(e.message,'error');}
    }
  });
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
    var p=sp.player||{},isCap=!!sp.is_captain,isVC=!!sp.is_vc;
    var isInjured=!!(p.is_injured), hasRep=!!(sp.replacement);
    var color=C[(p.ipl_team||'').replace(/\s+/g,'').toUpperCase()]||'#f0b429';
    var pRow=_playerPts[p.name]||{pts:0,pom:0,pot:0};
    var pts=Math.round(pRow.pts);
    var displayName=(isInjured&&hasRep&&sp.replacement.replacement)?sp.replacement.replacement.name:p.name||'Player';
    var displayImg=(isInjured&&hasRep&&sp.replacement.replacement)?sp.replacement.replacement.image_url:p.image_url;
    var badges=UI.roleBadge(p.role);
    if(p.is_overseas) badges+=' <span class="role-tag rt-os" style="font-size:9px;">OS</span>';
    if(isCap) badges+=' <span class="badge badge-gold" style="font-size:10px;">2x</span>';
    if(isVC)  badges+=' <span class="badge badge-cyan"  style="font-size:10px;">1.5x</span>';
    if(pRow.pom) badges+=' <span class="badge-pom" title="PoM Winner">PoM '+(pRow.pom>1?pRow.pom:'')+'</span>';
    if(pRow.pot) badges+=' <span class="badge-pot" title="Player of Tournament">PoT</span>';

    var statusBadges='';
    if(isInjured) statusBadges+='<span class="badge-injured">&#x1F3E5; Injured</span> ';
    if(hasRep)    statusBadges+='<span class="badge-replacement">&#x1F504; '+UI.esc(sp.replacement.replacement&&sp.replacement.replacement.name||'')+'</span>';
    
    var cardCls='player-card'+(isCap?' captain':isVC?' vice-cap':'')+(isInjured&&!hasRep?' injured':'')+(hasRep?' replaced':'')+
                (pRow.pom?' pom-highlight':'')+(pRow.pot?' pot-highlight':'');
    var pd=UI.esc(JSON.stringify({id:p.id,name:p.name||'',role:p.role||''}));
    return '<div class="'+cardCls+'" style="--ipl-color:'+color+';animation-delay:'+(i*0.05)+'s"'+
      (p.injury_note?' title="'+UI.esc('Injured: '+p.injury_note)+'"':'')+'>' +
      (pRow.pot?'<div class="captain-badge" style="background:var(--purple);color:#fff;">PoT Legend</div>':
       pRow.pom?'<div class="captain-badge" style="background:var(--gold);color:#000;">PoM Champ</div>':
       isCap?'<div class="captain-badge">C Captain</div>':isVC?'<div class="captain-badge vc-badge">VC Vice</div>':'') +
      imgTag(displayImg, displayName, 'player-avatar') +
      '<div class="player-name">'+UI.esc(displayName)+'</div>' +
      (isInjured&&hasRep?'<div style="font-size:10px;color:var(--text3);text-decoration:line-through;margin-bottom:2px;">'+UI.esc(p.name||'')+'</div>':'') +
      '<div class="player-ipl">'+UI.esc(p.ipl_team||'&mdash;')+'</div>' +
      '<div style="display:flex;align-items:center;justify-content:center;gap:4px;flex-wrap:wrap;">'+badges+'</div>' +
      (statusBadges?'<div style="display:flex;flex-wrap:wrap;gap:3px;justify-content:center;margin-top:6px;">'+statusBadges+'</div>':'') +
      (pts>0?'<div class="player-pts-row"><span style="color:var(--text2)">Season</span><span style="font-family:var(--f-mono);font-weight:700;color:var(--accent)">'+pts+'</span></div>':'') +
      (isInjured?'<button class="btn btn-sm" style="margin-top:8px;width:100%;background:rgba(56,217,245,.12);color:var(--cyan);border:1px solid rgba(56,217,245,.25);font-size:11px;" onclick="openRepModal(\''+pd+'\');">'+(hasRep?'&#x2194; Change':'+ Set Replacement')+'</button>':'') +
    '</div>';
  }).join('');
}

function renderSummary(){
  var cap=_squad.find(function(s){return s.is_captain;}),vc=_squad.find(function(s){return s.is_vc;});
  var os=_squad.filter(function(s){return s.player&&s.player.is_overseas;}).length;
  var inj=_squad.filter(function(s){return s.player&&s.player.is_injured;}).length;
  var el=document.getElementById('squad-summary'); if(!el)return;
  var items=[{lbl:'Players',val:_squad.length,unit:'/12'},{lbl:'Captain',val:(cap&&cap.player)?cap.player.name:'&mdash;',plain:true},{lbl:'VC',val:(vc&&vc.player)?vc.player.name:'&mdash;',plain:true},{lbl:'Overseas',val:os,unit:'/4'}];
  if(inj) items.push({lbl:'Injured',val:inj,accent:'var(--red)'});
  el.innerHTML='<div style="display:flex;gap:20px;flex-wrap:wrap;align-items:center;">'+items.map(function(it,i){
    var sep=i?'<div style="width:1px;height:32px;background:var(--border);flex-shrink:0;"></div>':'';
    var valHtml=it.plain?'<div style="font-family:var(--f-display);font-weight:700;font-size:15px;">'+UI.esc(String(it.val))+'</div>':
      '<div style="font-family:var(--f-display);font-weight:900;font-size:22px;color:'+(it.accent||'var(--accent)')+';">'+it.val+(it.unit?'<span style="font-size:13px;color:var(--text2);">'+it.unit+'</span>':'')+'</div>';
    return sep+'<div><div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);font-family:var(--f-ui);font-weight:700;margin-bottom:2px;">'+it.lbl+'</div>'+valHtml+'</div>';
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
    var n=counts[role],min=mins[role],met=n>=min;
    return '<div style="flex:1;min-width:100px;"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px;">'+
      '<span style="font-family:var(--f-ui);font-weight:700;color:var(--text2);">'+labels[role]+'</span>'+
      '<span style="font-family:var(--f-mono);font-weight:700;color:'+(met?'var(--text)':'var(--red)')+';">'+n+'<span style="color:var(--text3);font-weight:400;">/'+min+'+</span></span>'+
      '</div><div style="height:5px;background:var(--bg3);border-radius:3px;overflow:hidden;">'+
      '<div style="height:100%;background:'+(met?colors[role]:'var(--red)')+';border-radius:3px;width:'+Math.min(100,(n/4)*100)+'%;transition:width 1s ease;"></div></div></div>';
  }).join('');
}

function openRepModal(playerDataStr){
  try{ _repTarget=JSON.parse(playerDataStr.replace(/&quot;/g,'"')); }
  catch(e){ UI.toast('Error opening modal','error'); return; }
  _repSelectedId=null;
  document.getElementById('rep-modal-sub').textContent=_repTarget.name+' is injured. Pick a same-role ('+_repTarget.role+') replacement:';
  document.getElementById('rep-reason').value='';
  var squadIds=new Set(_squad.map(function(s){return s.player&&s.player.id;}));
  var available=_allPlayers.filter(function(pl){return pl.role===_repTarget.role&&!squadIds.has(pl.id)&&!pl.is_injured&&pl.id!==_repTarget.id;});
  document.getElementById('rep-player-list').innerHTML=!available.length
    ?'<div style="color:var(--text3);font-size:13px;padding:12px 0;">No eligible '+_repTarget.role+'s available.</div>'
    :available.map(function(pl){
        return '<div class="rp-row" id="rprow-'+pl.id+'" onclick="selectRep(\''+pl.id+'\')">'+
          '<div style="width:34px;height:34px;border-radius:50%;background:var(--bg3);overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;">'+
            (pl.image_url?'<img src="'+UI.esc(pl.image_url)+'" style="width:34px;height:34px;object-fit:cover;" onerror="this.style.display=\'none\'">':'<span>'+UI.esc((pl.name||'P')[0])+'</span>')+
          '</div>'+
          '<div style="flex:1;"><div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;font-size:14px;">'+UI.esc(pl.name)+'</div>'+
          '<div style="font-size:11px;color:var(--text2);">'+UI.esc(pl.ipl_team||'')+(pl.is_overseas?' &#x1F30F;':'')+'</div></div>'+
          UI.roleBadge(pl.role)+'</div>';
      }).join('');
  document.getElementById('rep-modal').style.display='flex';
}
function closeRepModal(){document.getElementById('rep-modal').style.display='none';_repTarget=null;_repSelectedId=null;}
function selectRep(pid){
  _repSelectedId=pid;
  document.querySelectorAll('.rp-row').forEach(function(r){r.classList.remove('selected');});
  var row=document.getElementById('rprow-'+pid); if(row) row.classList.add('selected');
}
async function submitReplacement(){
  if(!_repSelectedId){UI.toast('Select a replacement player first','warn');return;}
  if(!_repTarget){UI.toast('No target player','error');return;}
  var reason=document.getElementById('rep-reason').value.trim();
  var rep=_allPlayers.find(function(p){return p.id===_repSelectedId;});
  closeRepModal();
  UI.showConfirm({icon:'&#x1F504;',title:'Confirm Replacement',
    msg:'Replace '+_repTarget.name+' with '+(rep?rep.name:'selected player')+'?',
    consequence:'Points will use replacement stats until removed.',okLabel:'Set Replacement',okClass:'btn-accent',
    onOk:async function(){
      try{
        await API.createReplacement({teamId:_myTeamId,originalPlayerId:_repTarget.id,replacementPlayerId:_repSelectedId,reason:reason||null});
        UI.toast('Replacement set!','success'); await loadSquad();
      }catch(e){UI.toast(e.message,'error');}
    }
  });
}

async function exportSquadPDF(){
  try{
    var result=await sb.from('team_players').select('sold_price,is_retained,is_rtm,player:players(name,role,ipl_team,is_overseas,base_price)').eq('team_id',_myTeamId);
    if(result.error) throw result.error;
    var rows=result.data||[];
    var list=rows.sort(function(a,b){
      var sqA=_squad.find(function(s){return s.player&&s.player.name===(a.player&&a.player.name);});
      var sqB=_squad.find(function(s){return s.player&&s.player.name===(b.player&&b.player.name);});
      var rA=sqA?(sqA.is_captain?0:sqA.is_vc?1:2):2,rB=sqB?(sqB.is_captain?0:sqB.is_vc?1:2):2;
      return rA!==rB?rA-rB:((a.player&&a.player.name)||'').localeCompare((b.player&&b.player.name)||'');
    });
    var totalSpent=list.reduce(function(s,r){return s+Number(r.sold_price||0);},0);
    var os=list.filter(function(r){return r.player&&r.player.is_overseas;}).length;
    var rtn=list.filter(function(r){return r.is_retained;}).length;
    var rowsHtml=list.map(function(tp,i){
      var p=tp.player||{};
      var sqP=_squad.find(function(s){return s.player&&s.player.name===p.name;});
      var tags=[tp.is_retained?'RTN':'',tp.is_rtm?'RTM':'',p.is_overseas?'OS':''].filter(Boolean).join(' ');
      var cap=sqP&&sqP.is_captain,vc=sqP&&sqP.is_vc;
      return '<tr'+(tp.is_retained?' style="background:#fffbeb"':'')+'><td>'+(i+1)+'</td>'+
        '<td><strong>'+UI.esc(p.name||'')+'</strong>'+(tags?'<br><small style="color:#888">'+tags+'</small>':'')+'</td>'+
        '<td>'+UI.esc(p.role||'')+'</td><td>'+UI.esc(p.ipl_team||'')+'</td>'+
        '<td style="text-align:center">'+(cap?'C':vc?'VC':'')+'</td>'+
        '<td>Rs.'+(p.base_price||0)+'</td><td style="font-weight:700;color:#b7791f">Rs.'+Number(tp.sold_price||0).toFixed(2)+'</td></tr>';
    }).join('');
    var parts=['<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'+UI.esc(_myTeam.team_name)+'</title>',
      '<style>body{font-family:Arial,sans-serif;font-size:13px;padding:20px}h1{font-size:18px}table{width:100%;border-collapse:collapse}',
      'th{background:#1a1a2e;color:#c8f135;padding:7px 9px;text-align:left;font-size:10px}td{padding:6px 9px;border-bottom:1px solid #eee}</style></head><body>',
      '<h1>'+UI.esc(_myTeam.team_name)+'</h1><p style="font-size:12px;color:#666">BFL IPL 2026 &middot; '+new Date().toLocaleString('en-IN')+'</p>',
      '<p>Players: '+list.length+'/12 &nbsp; OS: '+os+'/4 &nbsp; Retained: '+rtn+' &nbsp; Spent: Rs.'+totalSpent.toFixed(1)+'Cr</p>',
      '<table><thead><tr><th>#</th><th>Player</th><th>Role</th><th>IPL</th><th>Cap</th><th>Base</th><th>Paid</th></tr></thead><tbody>'+rowsHtml+'</tbody></table></body></html>'];
    var blob=new Blob([parts.join('')],{type:'text/html'});
    var url=URL.createObjectURL(blob);
    var w=window.open(url,'_blank');
    if(!w){UI.toast('Allow popups','warn');return;}
    setTimeout(function(){URL.revokeObjectURL(url);},60000);
    UI.toast('PDF opened &mdash; Ctrl+P to print','success',5000);
  }catch(e){UI.toast('PDF failed: '+e.message,'error');}
}
init();