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
    '<div><div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:400;font-size:15px;color:var(--red);">Injured Players</div>'+
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
      '<div><div style="font-family:var(--f-ui);font-weight:400;font-size:14px;">'+UI.esc(sp.player.name)+'</div>'+
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
    var p=sp.player||{},isCap=!!sp.is_captain,isVC=!!sp.is_vc,isImpact=!!sp.is_impact;
    var isInjured=!!(p.is_injured), hasRep=!!(sp.replacement);
    var color=C[(p.ipl_team||'').replace(/\s+/g,'').toUpperCase()]||'#f0b429';
    var pRow=_playerPts[p.name]||{pts:0,pom:0,pot:0};
    var pts=UI.fmtPts(pRow.pts);
    var displayName=(isInjured&&hasRep&&sp.replacement.replacement)?sp.replacement.replacement.name:p.name||'Player';
    var displayImg=(isInjured&&hasRep&&sp.replacement.replacement)?sp.replacement.replacement.image_url:p.image_url;
    var badges=UI.roleBadge(p.role);
    if(p.is_overseas) badges+=' <span class="role-tag rt-os" style="font-size:9px;">OS</span>';
    if(isCap) badges+=' <span class="badge badge-gold" style="font-size:10px;">2x</span>';
    if(isVC)  badges+=' <span class="badge badge-cyan"  style="font-size:10px;">1.5x</span>';
    if(isImpact) badges+=' <span class="badge badge-impact" style="font-size:10px;">IMPACT</span>';
    if(pRow.pom) badges+=' <span class="badge-pom" title="PoM Winner">PoM '+(pRow.pom>1?pRow.pom:'')+'</span>';
    if(pRow.pot) badges+=' <span class="badge-pot" title="Player of Tournament">PoT</span>';

    var statusBadges='';
    if(isInjured) statusBadges+='<span class="badge-injured">&#x1F3E5; Injured</span> ';
    if(hasRep)    statusBadges+='<span class="badge-replacement">&#x1F504; '+UI.esc(sp.replacement.replacement&&sp.replacement.replacement.name||'')+'</span>';
    
    var cardCls='player-card'+(isCap?' captain':isVC?' vice-cap':'')+(isImpact?' impact':'')+(isInjured&&!hasRep?' injured':'')+(hasRep?' replaced':'')+
                (pRow.pom?' pom-highlight':'')+(pRow.pot?' pot-highlight':'');
    var pd=UI.esc(JSON.stringify({id:p.id,name:p.name||'',role:p.role||''}));
    return '<div class="'+cardCls+'" style="--ipl-color:'+color+';animation-delay:'+(i*0.05)+'s"'+
      (p.injury_note?' title="'+UI.esc('Injured: '+p.injury_note)+'"':'')+'>' +
      (pRow.pot?'<div class="captain-badge" style="background:var(--purple);color:#fff;">PoT Legend</div>':
       pRow.pom?'<div class="captain-badge" style="background:var(--gold);color:#000;">PoM Champ</div>':
       isCap?'<div class="captain-badge">C Captain</div>':isVC?'<div class="captain-badge vc-badge">VC Vice</div>':
       isImpact?'<div class="impact-role-badge">⚡ IMPACT</div>':'') +
      imgTag(displayImg, displayName, 'player-avatar') +
      '<div class="player-name">'+UI.esc(displayName)+'</div>' +
      (isInjured&&hasRep?'<div style="font-size:10px;color:var(--text3);text-decoration:line-through;margin-bottom:2px;">'+UI.esc(p.name||'')+'</div>':'') +
      '<div class="player-ipl">'+UI.esc(p.ipl_team||'&mdash;')+'</div>' +
      '<div style="display:flex;align-items:center;justify-content:center;gap:4px;flex-wrap:wrap;">'+badges+'</div>' +
      (statusBadges?'<div style="display:flex;flex-wrap:wrap;gap:3px;justify-content:center;margin-top:6px;">'+statusBadges+'</div>':'') +
      (pts!==0?'<div class="player-pts-row"><span style="color:var(--text2)">Season</span><span style="font-family:var(--f-mono);font-weight:600;color:var(--accent)">'+pts+'</span></div>':'') +
      (isInjured?'<button class="btn btn-sm" style="margin-top:8px;width:100%;background:rgba(56,217,245,.12);color:var(--cyan);border:1px solid rgba(56,217,245,.25);font-size:11px;" onclick="openRepModal(\''+pd+'\');">'+(hasRep?'&#x2194; Change':'+ Set Replacement')+'</button>':'') +
    '</div>';
  }).join('');
}

function renderSummary(){
  var cap=_squad.find(function(s){return s.is_captain;}),vc=_squad.find(function(s){return s.is_vc;}),impact=_squad.find(function(s){return s.is_impact;});
  var os=_squad.filter(function(s){return s.player&&s.player.is_overseas;}).length;
  var inj=_squad.filter(function(s){return s.player&&s.player.is_injured;}).length;
  var el=document.getElementById('squad-summary'); if(!el)return;
  var items=[{lbl:'Players',val:_squad.length,unit:'/12'},{lbl:'Captain',val:(cap&&cap.player)?cap.player.name:'&mdash;',plain:true},{lbl:'VC',val:(vc&&vc.player)?vc.player.name:'&mdash;',plain:true},{lbl:'Impact',val:(impact&&impact.player)?impact.player.name:'&mdash;',plain:true},{lbl:'Overseas',val:os,unit:'/4'}];
  if(inj) items.push({lbl:'Injured',val:inj,accent:'var(--red)'});
  el.innerHTML='<div style="display:flex;gap:20px;flex-wrap:wrap;align-items:center;">'+items.map(function(it,i){
    var sep=i?'<div style="width:1px;height:32px;background:var(--border);flex-shrink:0;"></div>':'';
    var valHtml=it.plain?'<div style="font-family:var(--f-display);font-weight:600;font-size:15px;">'+UI.esc(String(it.val))+'</div>':
      '<div style="font-family:var(--f-display);font-weight:600;font-size:22px;color:'+(it.accent||'var(--accent)')+';">'+it.val+(it.unit?'<span style="font-size:13px;color:var(--text2);">'+it.unit+'</span>':'')+'</div>';
    return sep+'<div><div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);font-family:var(--f-ui);font-weight:600;margin-bottom:2px;">'+it.lbl+'</div>'+valHtml+'</div>';
  }).join('')+'</div>';
}

function renderRoleBreakdown() {
  var counts = { Batter:0, Bowler:0, 'All-Rounder':0, 'Wicket-Keeper':0 };
  _squad.forEach(function(sp) { if (sp.player && sp.player.role) counts[sp.player.role]++; });
  
  var labels = { Batter:'BAT', Bowler:'BOWL', 'All-Rounder':'AR', 'Wicket-Keeper':'WK' };
  var colors = { Batter:'#f87171', Bowler:'#60a5fa', 'All-Rounder':'#34d399', 'Wicket-Keeper':'#fbbf24' };
  
  // Ideal ranges for a 11-12 player squad per user request
  var ideals = { Batter: [3, 5], Bowler: [3, 5], 'All-Rounder': [2, 5], 'Wicket-Keeper': [1, 3] };
  
  var el = document.getElementById('role-bars'); if (!el) return;
  
  var totalStrength = 0;
  var roleHtml = Object.keys(counts).map(function(role) {
    var n = counts[role];
    var range = ideals[role];
    var score = 0;
    
    if (n >= range[0] && n <= range[1]) score = 100;
    else if (n < range[0]) score = Math.round((n / range[0]) * 100);
    else score = Math.round((range[1] / n) * 100); // Penalty for over-stacking
    
    totalStrength += score;
    var isLow = n < range[0], isHigh = n > range[1];
    var statusTxt = isLow ? 'Low' : isHigh ? 'Heavy' : 'Balanced';
    var statusCol = isLow ? 'var(--red)' : isHigh ? '#f59e0b' : 'var(--accent)';

    return `
      <div style="flex:1; min-width:140px; background:var(--bg2); padding:12px; border-radius:10px; border:1px solid var(--border);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span style="font-family:var(--f-ui); font-weight:400; font-size:12px; color:var(--text2);">${labels[role]}</span>
          <span style="font-family:var(--f-mono); font-weight:600; font-size:14px; color:${statusCol};">${n} <small style="color:var(--text3); font-weight:400; font-size:10px;">(${range[0]}-${range[1]})</small></span>
        </div>
        <div style="height:6px; background:var(--bg3); border-radius:3px; overflow:hidden; margin-bottom:6px;">
          <div style="height:100%; background:${colors[role]}; width:${Math.min(100, (n/6)*100)}%; transition:width 1s cubic-bezier(0.34, 1.56, 0.64, 1);"></div>
        </div>
        <div style="font-size:10px; font-weight:600; color:var(--text3); text-transform:uppercase; letter-spacing:0.5px;">${statusTxt}</div>
      </div>
    `;
  }).join('');

  var avgStrength = Math.round(totalStrength / 4);
  var strengthCol = avgStrength > 85 ? 'var(--accent)' : avgStrength > 60 ? '#f59e0b' : 'var(--red)';

  el.parentElement.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:16px;">
      <div class="card-title" style="margin:0;">Team Balance Analysis</div>
      <div style="text-align:right;">
        <div style="font-size:10px; text-transform:uppercase; color:var(--text3); font-weight:600;">Overall Strength</div>
        <div style="font-family:var(--f-display); font-size:24px; font-weight:600; color:${strengthCol}; line-height:1;">${avgStrength}%</div>
      </div>
    </div>
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:12px;" id="role-bars">
      ${roleHtml}
    </div>
  `;
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
          '<div style="flex:1;"><div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:400;font-size:14px;">'+UI.esc(pl.name)+'</div>'+
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

async function exportSquadPDF() {
  try {
    var result = await sb.from('squad_players').select('is_captain,is_vc,is_impact,player:players(*)').eq('fantasy_team_id', _myTeamId);
    if (result.error) throw result.error;
    var list = (result.data || []).sort(function(a, b) {
      var rA = a.is_captain ? 0 : a.is_vc ? 1 : a.is_impact ? 2 : 3,
        rB = b.is_captain ? 0 : b.is_vc ? 1 : b.is_impact ? 2 : 3;
      return rA !== rB ? rA - rB : ((a.player && a.player.name) || '').localeCompare((b.player && b.player.name) || '');
    });

    var teamName = (_myTeam && _myTeam.team_name) || 'My Squad';
    var ownerName = (_myTeam && _myTeam.owner_name) || UI.getOwnerName(teamName);
    
    // Fix: Calculate total points from individual player scores to ensure accuracy
    var totalPts = list.reduce(function(sum, sp) {
      var pName = (sp.player && sp.player.name) || '';
      return sum + ((_playerPts[pName] && _playerPts[pName].pts) || 0);
    }, 0);

    var roleText = function(role) {
      if (role === 'Batter') return 'Batter';
      if (role === 'Bowler') return 'Bowler';
      if (role === 'Wicket-Keeper') return 'Wicket-Keeper';
      if (role === 'All-Rounder') return 'All-Rounder';
      return role || '—';
    };

    var C = { CSK: '#fdb913', MI: '#004ba0', RCB: '#da1818', KKR: '#6a1bac', SRH: '#f26522', DC: '#004c93', PBKS: '#ed1b24', RR: '#ea1a85', GT: '#1c2c5b', LSG: '#ff002b', SURA: '#1a3a8a' };
    var teamColor = C[(teamName || '').replace(/\s+/g, '').toUpperCase()] || '#1a1a2e';

    var docHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>BFL Squad - ${UI.esc(teamName)}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Barlow+Condensed:wght@700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; padding: 0; margin: 0; color: #1e293b; background: #f8fafc; line-height: 1.5; }
        .page { background: #fff; max-width: 900px; margin: 0 auto; box-shadow: 0 10px 25px rgba(0,0,0,0.05); min-height: 100vh; }
        .branding-bar { height: 6px; background: linear-gradient(90deg, ${teamColor}, #f0b429); }
        .header { background: #1a1a2e; color: #fff; padding: 40px; display: flex; justify-content: space-between; align-items: center; position: relative; overflow: hidden; }
        .header::after { content: 'BFL'; position: absolute; right: -20px; top: -20px; font-size: 160px; font-weight: 900; color: rgba(255,255,255,0.03); font-family: 'Barlow Condensed'; }
        .team-name { font-size: 36px; font-weight: 800; color: #fff; margin: 0; text-transform: uppercase; letter-spacing: -1px; font-family: 'Barlow Condensed'; }
        .owner-info { margin-top: 4px; color: #94a3b8; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; }
        .total-box { text-align: right; background: rgba(255,255,255,0.05); padding: 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); }
        .total-lbl { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #f0b429; margin-bottom: 5px; }
        .total-val { font-size: 42px; font-weight: 800; color: #fff; line-height: 1; font-family: 'Barlow Condensed'; }
        
        .content { padding: 40px; }
        .stats-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 40px; }
        .stat-card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 16px; transition: transform 0.2s; }
        .stat-card:hover { transform: translateY(-2px); border-color: ${teamColor}; }
        .stat-v { font-size: 24px; font-weight: 800; color: #1e293b; display: block; }
        .stat-l { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; margin-top: 4px; font-weight: 600; }

        table { width: 100%; border-collapse: separate; border-spacing: 0 8px; margin-top: -8px; }
        th { text-align: left; padding: 12px 20px; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; }
        td { padding: 16px 20px; background: #fff; border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        td:first-child { border-left: 1px solid #f1f5f9; border-radius: 12px 0 0 12px; }
        td:last-child { border-right: 1px solid #f1f5f9; border-radius: 0 12px 12px 0; }
        
        .p-info { display: flex; align-items: center; gap: 12px; }
        .p-name { font-weight: 700; color: #0f172a; font-size: 15px; }
        .p-team { font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; }
        .role-pill { font-size: 11px; padding: 4px 10px; border-radius: 6px; background: #f1f5f9; font-weight: 700; color: #475569; display: inline-block; }
        .pts-badge { font-family: 'Barlow Condensed', sans-serif; font-size: 18px; font-weight: 700; color: ${teamColor}; }
        .pts-badge.neg { color: #ef4444; }
        
        .badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 800; margin-left: 8px; vertical-align: middle; }
        .badge.c { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
        .badge.vc { background: #e0f2fe; color: #075985; border: 1px solid #bae6fd; }
        .badge.imp { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }

        .footer { padding: 40px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #f1f5f9; background: #fafafa; }
        @media print { body { background: #fff; } .page { box-shadow: none; max-width: 100%; } }
    </style>
</head>
<body>
    <div class="page">
        <div class="branding-bar"></div>
        <div class="header">
            <div>
                <h1 class="team-name">${UI.esc(teamName)}</h1>
                <div class="owner-info">Manager: ${UI.esc(ownerName)}</div>
            </div>
            <div class="total-box">
                <div class="total-lbl">Season Points</div>
                <div class="total-val">${UI.fmtPts(totalPts)}</div>
            </div>
        </div>

        <div class="content">
            <div class="stats-summary">
                <div class="stat-card">
                    <span class="stat-v">${list.length}</span>
                    <span class="stat-l">Players</span>
                </div>
                <div class="stat-card">
                    <span class="stat-v">${list.filter(function(r) { return r.player && r.player.is_overseas; }).length}</span>
                    <span class="stat-l">Overseas</span>
                </div>
                <div class="stat-card">
                    <span class="stat-v">${list.filter(function(r) { return r.is_captain || r.is_vc; }).length}</span>
                    <span class="stat-l">Leaders</span>
                </div>
                <div class="stat-card">
                    <span class="stat-v">${UI.fmtPts(totalPts / Math.max(1, list.length))}</span>
                    <span class="stat-l">Avg Pts</span>
                </div>
              </div>

            <table>
                <thead>
                    <tr>
                        <th style="width:40px;text-align:center;">#</th>
                        <th>Player Details</th>
                        <th>Role</th>
                        <th style="text-align:right;">Points</th>
                    </tr>
                </thead>
                <tbody>
                    ${list.map(function(sqP, i) {
                      var p = sqP.player || {};
                      var pName = p.name || '—';
                      var pPts = (_playerPts[pName] && _playerPts[pName].pts) || 0;
                      var role = roleText(p.role);
                      var rowColor = i % 2 === 0 ? '#fff' : '#fafafa';
                      return `
                        <tr>
                            <td style="text-align:center;color:#94a3b8;font-weight:700;">${i + 1}</td>
                            <td>
                                <div class="p-info">
                                    <div>
                                        <div class="p-name">
                                            ${UI.esc(pName)} ${p.is_overseas ? '✈️' : ''}
                                            ${sqP.is_captain ? '<span class="badge c">C</span>' : sqP.is_vc ? '<span class="badge vc">VC</span>' : sqP.is_impact ? '<span class="badge imp">IMP</span>' : ''}
                                        </div>
                                        <div class="p-team">${UI.esc(p.ipl_team || '—')}</div>
                                    </div>
                                </div>
                            </td>
                            <td><span class="role-pill">${UI.esc(role)}</span></td>
                            <td style="text-align:right;"><span class="pts-badge ${pPts < 0 ? 'neg' : ''}">${UI.fmtPts(pPts)}</span></td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>

        <div class="footer">
            <strong>BFL FANTASY CRICKET LEAGUE</strong><br>
            Official Team Squad Report • Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}<br>
            <span style="display:inline-block;margin-top:10px;padding:4px 12px;background:#f1f5f9;border-radius:20px;color:#64748b;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:1px;">Verified Authentic</span>
        </div>
    </div>
</body>
</html>`;

    var blob = new Blob([docHtml], { type: 'text/html' });
    var url = URL.createObjectURL(blob);
    var w = window.open(url, '_blank');
    if (!w) { UI.toast('Allow popups to open PDF', 'warn'); return; }
    UI.toast('Exported! Press Ctrl+P to save as PDF', 'success', 5000);
  } catch (e) {
    UI.toast('Export failed: ' + e.message, 'error');
  }
}
init();
