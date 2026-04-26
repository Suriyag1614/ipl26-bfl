
// Fantasy Leaderboard State
var _flData = [], _flPage = 1, _flSort = { col: 'points', asc: false }, _flPerPage = 15;

async function init() {
  var sess = await Auth.requireAuth(); if(!sess) return;
  if(Auth.isAdmin(sess.user)){window.location.href='admin.html';return;}

  // Identify active tab from URL param
  var params = new URLSearchParams(window.location.search);
  var activeTab = params.get('tab') || 'pred-summary';

  await initNavbar('summary'); // Highlight the Season Analytics link in the sidebar

  // Load prerequisites
  try {
    _matches = await API.fetchMatches();
    _teams = await API.fetchAllTeamPoints();

    // Build player squad map for Fantasy Leaderboard
    var squadData = await API.fetchSquadPlayersAll();
    squadData.forEach(function(sp) {
      if (!sp.is_released) _playerSquadMap[sp.player_id] = { team_name: sp.fantasy_team?.team_name };
    });
  } catch(e) {}

  switchTab(activeTab);
}

async function loadPredictionsSummary() {
  var teamWins = $id('pred-team-wins');
  var targetDist = $id('pred-target-dist');
  if (!teamWins || !targetDist) return;
  teamWins.innerHTML = '<div class="skel skel-row"></div>';
  targetDist.innerHTML = '<div class="skel skel-row"></div>';
  try {
    var preds = safeArr(await API.fetchAllPredictionsAllMatches());
    var completedMatches = _matches.filter(function(m) { return (m.status === 'completed' || m.status === 'processed') && !m.is_abandoned; });
    var teamCounts = {};
    var targetScores = [];
    var validPredsCount = 0;

    preds.forEach(function(p) {
      var match = completedMatches.find(function(m) { return String(m.id) === String(p.match_id); });
      if (!match) return;

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
      teamWins.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px;">' + teamList.map(function(t) {
        var cnt = teamCounts[t];
        var pct = Math.round(cnt / validPredsCount * 100);
        return '<div style="display:flex;align-items:center;gap:10px;"><span style="width:50px;font-weight:800;font-family:var(--f-ui);font-size:12px;">' + UI.tShort(t) + '</span><div style="flex:1;background:var(--bg3);height:20px;border-radius:4px;overflow:hidden;"><div style="width:' + pct + '%;background:var(--accent);height:100%;"></div></div><span style="width:60px;text-align:right;color:var(--text2);font-size:11px;">' + cnt + ' (' + pct + '%)</span></div>';
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
        return '<div style="display:flex;align-items:center;gap:10px;"><span style="width:70px;font-size:12px;">' + r + '</span><div style="flex:1;background:var(--bg3);height:14px;border-radius:3px;overflow:hidden;"><div style="width:' + pct + '%;background:var(--purple);height:100%;"></div></div><span style="width:40px;text-align:right;color:var(--text2);font-size:11px;">' + cnt + '</span></div>';
      }).join('') + '</div>';
    }
  } catch(e) { teamWins.innerHTML = '<div style="color:var(--red);padding:12px;">' + UI.esc(e.message) + '</div>'; }
}

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
    var matches = _matches.filter(function(m) { return (m.status === 'completed' || m.status === 'processed') && !m.is_abandoned; });
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
       return '<div style="display:flex;align-items:center;gap:10px;font-size:12px;"><span style="width:80px;">M' + m.match.match_no + '</span><div style="flex:1;background:var(--bg3);height:20px;border-radius:3px;overflow:hidden;"><div style="width:' + m.pct + '%;background:' + color + ';height:100%;"></div></div><span style="width:50px;text-align:center;color:' + color + ';">' + m.correct + '/' + m.total + '</span></div>';
    }).join('') + '</div>';
    var totalCorrect = matchStats.reduce(function(s,m) { return s + m.correct; }, 0);
    var totalPreds = matchStats.reduce(function(s,m) { return s + m.total; }, 0);
    var overallPct = totalPreds > 0 ? Math.round(totalCorrect / totalPreds * 100) : 0;
    overall.innerHTML = '<div class="kpi-grid" style="grid-template-columns:repeat(2,1fr);">' +
      '<div class="kpi-chip"><div class="kpi-label">Overall Acc.</div><div class="kpi-value" style="color:var(--accent);">' + overallPct + '%</div></div>' +
      '<div class="kpi-chip"><div class="kpi-label">Total Correct</div><div class="kpi-value" style="color:var(--green);">' + totalCorrect + '</div></div>' +
      '<div class="kpi-chip"><div class="kpi-label">Total Preds</div><div class="kpi-value">' + totalPreds + '</div></div>' +
      '<div class="kpi-chip"><div class="kpi-label">Matches</div><div class="kpi-value">' + matchStats.length + '</div></div>' +
      '</div>';
    var teamStats = {};
    var teamMap = {};
    _teams.forEach(function(t) { teamMap[t.id] = t.team_name; });
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
      teamLeaderboard.innerHTML = teamList.length ? '<div style="display:flex;flex-direction:column;gap:10px;font-size:12px;">' + teamList.map(function(t, i) {
        var color = t.pct >= 70 ? 'var(--green)' : t.pct >= 40 ? 'var(--gold)' : 'var(--red)';
        return '<div style="display:flex;align-items:center;gap:8px;"><span style="width:20px;font-weight:900;color:var(--text3);">' + (i+1) + '</span><span style="flex:1;font-weight:600;">' + UI.esc(UI.tShort(t.name)) + '</span><span style="color:' + color + ';font-weight:700;">' + t.pct + '% (' + t.correct + '/' + t.total + ')</span></div>';
      }).join('') + '</div>' : '<div class="empty-state">No team data</div>';
    }
  } catch(e) { byMatch.innerHTML = '<div style="color:var(--red);padding:12px;">' + UI.esc(e.message) + '</div>'; }
}

async function loadMatchPredictionsPanel() {
  var sel = document.getElementById('mp-team-select'); if(!sel) return;
  sel.innerHTML = '<option value="">— Select BFL Team —</option>' + _teams.map(function(t){ return '<option value="'+t.id+'">'+UI.tShort(t.team_name)+'</option>'; }).join('');
}

async function loadTeamMatchPredictions() {
  var list = $id('team-preds-list'), stats = $id('team-preds-stats');
  var teamId = $id('mp-team-select').value;
  if(!teamId){ list.innerHTML = '<div class="empty-state" style="padding:20px;">Select a BFL Team</div>'; return; }
  list.innerHTML = '<div class="skel skel-row"></div>';
  stats.innerHTML = '';
  try {
    var preds = safeArr(await API.fetchAllPredictionsAllMatches());
    var teamPreds = preds.filter(function(p){ return p.fantasy_team_id === teamId; });
    var teamInfo = await API.fetchAllTeamPoints();
    var tInfo = teamInfo.find(function(t) { return t.id === teamId; });

    if(!teamPreds.length){ list.innerHTML = '<div class="empty-state" style="padding:20px;">No predictions by this team.</div>'; return; }

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
      return '<div style="padding:12px 16px;border-bottom:1px solid var(--border);animation:row-in .2s ease ' + (i*.02) + 's both;">' +
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
      if (match.actual_target && p.target_score && (match.status === 'completed' || match.status === 'processed') && !match.is_abandoned) {
        totalDiff += Math.abs((p.target_score||0) - (match.actual_target||0));
        diffCount++;
      }
      if (match.status === 'abandoned') { abandonedCount++; }
      else if (match.winner && p.predicted_winner === match.winner) { correctCount++; currentStreak++; maxStreak = Math.max(maxStreak, currentStreak); currentWrongStreak = 0; }
      else if ((match.status === 'completed' || match.status === 'processed') && !match.is_abandoned) { incorrectCount++; currentWrongStreak++; maxWrong = Math.max(maxWrong, currentWrongStreak); currentStreak = 0; }
      else { currentStreak = 0; currentWrongStreak = 0; }
    });
    var completedCount = correctCount + incorrectCount;
    var accuracy = completedCount > 0 ? Math.round(correctCount / completedCount * 100) : 0;
    var avgDiff = diffCount > 0 ? Math.round(totalDiff / diffCount) : 0;
    var teamCode = tInfo ? UI.tCode(tInfo.team_name) : '';
    var logoUrl = teamCode ? 'images/teams/' + teamCode + 'outline.png' : '';

    stats.innerHTML = '<div style="position:relative;padding:16px;border-radius:var(--radius-md);">' +
      (logoUrl ? '<img src="' + logoUrl + '" style="position:absolute;right:-10px;bottom:-10px;width:120px;opacity:0.1;pointer-events:none;">' : '') +
      '<div class="kpi-grid" style="grid-template-columns:repeat(2,1fr);position:relative;z-index:1;">' +
      '<div class="kpi-chip"><div class="kpi-label">Total Preds</div><div class="kpi-value">' + teamPreds.length + '</div></div>' +
      '<div class="kpi-chip"><div class="kpi-label">Accuracy</div><div class="kpi-value" style="color:var(--cyan);">' + (completedCount > 0 ? accuracy + '%' : '-') + '</div></div>' +
      '<div class="kpi-chip"><div class="kpi-label">Correct</div><div class="kpi-value" style="color:var(--green);">' + correctCount + '</div></div>' +
      '<div class="kpi-chip"><div class="kpi-label">Incorrect</div><div class="kpi-value" style="color:var(--red);">' + incorrectCount + '</div></div>' +
      '<div class="kpi-chip"><div class="kpi-label">Avg Target Diff</div><div class="kpi-value" style="color:var(--gold);">' + (diffCount > 0 ? '±' + avgDiff : '-') + '</div></div>' +
      '<div class="kpi-chip"><div class="kpi-label">Best Streak</div><div class="kpi-value" style="color:var(--green);">' + maxStreak + '</div></div>' +
      '</div></div>';
  } catch(e) { list.innerHTML = '<div style="color:var(--red);padding:12px;">' + UI.esc(e.message) + '</div>'; }
}

async function loadFantasyLeaderboard() {
  var container = $id('fantasy-leaderboard-container');
  if (!container) return;
  container.innerHTML = '<div class="skel skel-card" style="height:200px;margin-bottom:20px;"></div><div class="skel skel-row" style="margin:12px;"></div><div class="skel skel-row" style="margin:12px;"></div>';
  try {
    var stats = safeArr(await API.fetchAllPlayerStats());
    var completedMatches = _matches.filter(function(m) { return (m.status === 'completed' || m.status === 'processed') && !m.is_abandoned; });
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

        // Calculate season best for this player
        var pStats = stats.filter(function(s){ return s.player_id === pid && completedMatchIds.includes(s.match_id); });
        var bestMatch = null;
        var maxMatchPts = -1;
        pStats.forEach(function(s) {
          var mpts = API.calcBattingPoints(s) + API.calcBowlingPoints(s) + API.calcFieldingPoints(s);
          if (mpts > maxMatchPts) {
            maxMatchPts = mpts;
            bestMatch = s;
          }
        });

        _flData.push({
          id: pid,
          name: p.name,
          role: p.role,
          ipl_team: p.ipl_team,
          bfl_team: squad ? squad.team_name : null,
          points: playerPoints[pid],
          matches: playerMatches[pid],
          image_url: p.image_url,
          season_best: bestMatch ? {
            pts: maxMatchPts,
            match_id: bestMatch.match_id,
            match_no: _matches.find(m => m.id === bestMatch.match_id)?.match_no,
            match_title: _matches.find(m => m.id === bestMatch.match_id)?.match_title,
            t1: _matches.find(m => m.id === bestMatch.match_id)?.team1,
            t2: _matches.find(m => m.id === bestMatch.match_id)?.team2
          } : null
        });
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
  } catch(e) {
    var container = $id('fantasy-leaderboard-container');
    if (container) container.innerHTML = '<div style="color:var(--red);padding:24px;text-align:center;">' + UI.esc(e.message) + '</div>';
  }
}

function populateFlFilters() {
  var iplTeamSel = $id('fl-ipl-team');
  var bflTeamSel = $id('fl-bfl-team');
  var iplTeamOptions = ['CHENNAI SUPER KINGS','DELHI CAPITALS','GUJARAT TITANS','KOLKATA KNIGHT RIDERS','LUCKNOW SUPER GIANTS','MUMBAI INDIANS','PUNJAB KINGS','RAJASTHAN ROYALS','ROYAL CHALLENGERS BENGALURU','SUNRISERS HYDERABAD','SUPREMERAJAS'];

  if (iplTeamSel) {
    var currentIplVal = iplTeamSel.value;
    iplTeamSel.innerHTML = '<option value="">All IPL Teams</option>' + iplTeamOptions.map(function(t) { return '<option value="'+t+'">'+t+'</option>'; }).join('');
    if (currentIplVal) iplTeamSel.value = currentIplVal;
  }

  if (bflTeamSel) {
    var bflTeamOptions = [...new Set(_flData.map(function(p) { return p.bfl_team; }).filter(Boolean))].sort();
    var currentBflVal = bflTeamSel.value;
    bflTeamSel.innerHTML = '<option value="">All BFL Teams</option>' + bflTeamOptions.map(function(t) { return '<option value="'+t+'">'+t+'</option>'; }).join('');
    if (currentBflVal) bflTeamSel.value = currentBflVal;
  }
}

function filterFantasyLeaderboard() {
  var q = ($id('fl-search')?.value || '').toLowerCase();
  var iplTeam = $id('fl-ipl-team')?.value || '';
  var role = $id('fl-role')?.value || '';
  var bflTeam = $id('fl-bfl-team')?.value || '';

  var roleMap = { 'BAT': ['BAT','BATTING','BATTER'], 'BOW': ['BOW','BOWLING','BOWLER'], 'AR': ['AR','ALLROUNDER','ALL-ROUNDER'], 'WK': ['WK','WICKETKEEPER','WICKET-KEEPER','WICKET KEEPER'] };
  var roleVals = roleMap[role] || [role];

  var filtered = _flData.filter(function(p) {
    if (q && !(p.name||'').toLowerCase().includes(q)) return false;

    // Normalize IPL teams using tCode for robust matching
    if (iplTeam && UI.tCode(p.ipl_team) !== UI.tCode(iplTeam)) return false;

    if (role && (p.role||'').toUpperCase() !== role.toUpperCase()) {
       // Check mapping for role abbreviations
       var pRole = (p.role||'').toUpperCase();
       if (!roleVals.some(function(rv) { return pRole.includes(rv); })) return false;
    }
    if (bflTeam && (p.bfl_team||'').toUpperCase() !== bflTeam.toUpperCase()) return false;
    return true;
  });
  sortFlData(filtered);
  renderFlTable(filtered);
}

function sortFantasyLeaderboard(col) {
  if (_flSort.col === col) {
    _flSort.asc = !_flSort.asc;
  } else {
    _flSort.col = col;
    _flSort.asc = false; // Default to Descending for points/average
  }
  filterFantasyLeaderboard();
}

function sortFlData(list) {
  var asc = _flSort.asc, col = _flSort.col;
  list.forEach(function(p) { p.average = p.matches > 0 ? Math.round(p.points/p.matches*10)/10 : 0; });
  list.sort(function(a, b) {
    var av = a[col], bv = b[col];
    if (typeof av === 'string') av = (av || '').toLowerCase();
    if (typeof bv === 'string') bv = (bv || '').toLowerCase();
    return asc ? (av > bv ? 1 : -1) : (bv > av ? 1 : -1);
  });
}

function renderFlTable(list) {
  var container = $id('fantasy-leaderboard-container'); if (!container) return;
  var total = list.length, pages = Math.ceil(total / _flPerPage), start = (_flPage - 1) * _flPerPage;
  var pageData = list.slice(start, start + _flPerPage);
  if ($id('fl-info')) $id('fl-info').textContent = total > 0 ? 'Showing ' + (start + 1) + '-' + Math.min(start + _flPerPage, total) + ' of ' + total + ' players' : 'No players';

  var html = '';

  // Rank 1 Featured Card (only on page 1)
  if (_flPage === 1 && pageData.length > 0 && start === 0) {
    var p0 = pageData[0];
    var p0NameParts = p0.name.split(' ');
    var p0First = p0NameParts[0], p0Last = p0NameParts.slice(1).join(' ');
    var bflCode = p0.bfl_team ? (UI.tCode(p0.bfl_team) || 'BFL') : 'BFL';
    var bflLogo = UI.getTeamLogo(p0.bfl_team) || 'images/bfl/bfl-logo.png';
    var avg = p0.matches > 0 ? (p0.points / p0.matches).toFixed(1) : '0';

    html += '<div class="fl-featured-card">' +
      '<div class="fl-featured-img-wrap"><img src="' + (p0.image_url || 'images/players/placeholder.png') + '" class="fl-featured-img" onerror="this.src=\'images/bfl/bfl-logo.png\'"></div>' +
      '<div class="fl-featured-info">' +
        '<div class="fl-leader-badge"><span class="fl-leader-badge-text">Leader</span></div>' +
        '<div class="fl-featured-name"><span>' + UI.esc(p0First) + '</span><strong>' + UI.esc(p0Last) + '</strong></div>' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">' +
          '<img src="' + bflLogo + '" style="width:36px;height:36px;object-fit:contain;">' +
          '<span style="font-weight:800;font-size:16px;color:var(--accent);text-transform:uppercase;letter-spacing:1px;">' + UI.esc(p0.bfl_team || 'Free Agent') + '</span>' +
        '</div>' +
        '<div class="fl-featured-stats-v">' +
          '<div class="fl-featured-stat-v"><div class="fl-fstat-lbl">Total Fantasy Points</div><div class="fl-fstat-val">' + p0.points + '</div></div>' +
          '<div class="fl-featured-stat-v"><div class="fl-fstat-lbl">Average Fantasy Points</div><div class="fl-fstat-val">' + avg + '</div></div>' +
          '<div class="fl-featured-stat-v"><div class="fl-fstat-lbl">Matches Played</div><div class="fl-fstat-val">' + p0.matches + '</div></div>' +
          (p0.season_best ?
            '<div class="fl-featured-stat-v">' +
              '<div><div class="fl-fstat-lbl">Season Best</div><div class="fl-fstat-sub">M' + (p0.season_best.match_no || '?') + ' · ' + UI.tShort(p0.season_best.t1) + ' vs ' + UI.tShort(p0.season_best.t2) + '</div></div>' +
              '<div class="fl-fstat-val">' + p0.season_best.pts + ' <span style="font-size:14px;font-weight:400;">pts</span></div>' +
            '</div>' : '') +
        '</div>' +
      '</div>' +
    '</div>';

    // Remove Rank 1 from the list for the rows below
    pageData = pageData.slice(1);
    start++;
  }

  // ICC Header (appears after featured card if on page 1, or at the top if on subsequent pages)
  html += '<div class="fl-icc-header">' +
    '<div class="fl-pos">Pos</div>' +
    '<div class="fl-team">BFL Team</div>' +
    '<div class="fl-player">Player</div>' +
    '<div class="fl-rating">Total FP</div>' +
    '<div class="fl-best">Season Best</div>' +
  '</div>';

  html += pageData.map(function(p, i) {
    var rank = start + i + 1;
    var nameParts = p.name.split(' ');
    var fName = nameParts[0], lName = nameParts.slice(1).join(' ');
    var bflLogo = UI.getTeamLogo(p.bfl_team) || 'images/bfl/bfl-logo.png';
    var sb = p.season_best;
    var sbHtml = sb ? '<strong>' + sb.pts + 'pts</strong>' +
      '<span>M' + (sb.match_no || '?') + ' · ' + UI.tShort(sb.t1) + ' vs ' + UI.tShort(sb.t2) + '</span>' : '—';

    return '<div class="fl-icc-row" style="animation: fade-up .3s ease ' + (i * 0.05) + 's both;">' +
      '<div class="fl-pos">' + (rank < 10 ? '0' + rank : rank) + ' <span class="fl-trend">•</span></div>' +
      '<div class="fl-team"><img src="' + bflLogo + '" class="fl-team-logo" title="' + UI.esc(p.bfl_team || 'BFL') + '"></div>' +
      '<div class="fl-player fl-player-cell">' +
        '<div class="fl-name"><span>' + UI.esc(fName) + '</span><strong>' + UI.esc(lName) + '</strong></div>' +
      '</div>' +
      '<div class="fl-rating">' + p.points + '</div>' +
      '<div class="fl-best">' +
        '<span class="fl-best-pts">' + (sb ? sb.pts + ' pts' : '—') + '</span>' +
        '<span class="fl-best-meta">' + (sb ? 'M' + (sb.match_no || '?') + ' · ' + UI.tShort(sb.t1) + ' vs ' + UI.tShort(sb.t2) : '—') + '</span>' +
      '</div>' +
    '</div>';
  }).join('');

  container.innerHTML = html;
  renderFlPagination(total, pages);
}

function renderFlPagination(total, pages) {
  var el = $id('fl-pagination'); if(!el) return;
  if(pages<=1){ el.innerHTML=''; return; }
  var html = '<button class="btn btn-ghost btn-sm" onclick="setFlPage('+Math.max(1,_flPage-1)+')">‹</button>';
  for(var i=1; i<=pages; i++){
    if(i===1 || i===pages || (i>=_flPage-1 && i<=_flPage+1))
      html += '<button class="btn '+(i===_flPage?'btn-accent':'btn-ghost')+' btn-sm" onclick="setFlPage('+i+')">'+i+'</button>';
    else if(i===2 || i===pages-1) html += '<span>…</span>';
  }
  html += '<button class="btn btn-ghost btn-sm" onclick="setFlPage('+Math.min(pages,_flPage+1)+')">›</button>';
  el.innerHTML = html;
}
function setFlPage(p){ _flPage=p; filterFantasyLeaderboard(); }

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
        '<td style="font-weight:600;">' + UI.esc(UI.tShort(t.team_name)) + '</td>' +
        '<td>' + (captain ? UI.esc(captain.player?.name || '-') : '-') + '</td>' +
        '<td>' + (vc ? UI.esc(vc.player?.name || '-') : '-') + '</td>' +
        '<td>' + (impact ? UI.esc(impact.player?.name || '-') : '-') + '</td>' +
        '<td>' + playerCount + '</td>' +
      '</tr>';
    }).join('');
  } catch(e) { tbody.innerHTML = '<tr><td colspan="6" style="color:var(--red);padding:12px;">' + UI.esc(e.message) + '</td></tr>'; }
}

async function loadPowerRankings() {
  var tbody = $id('power-rankings-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5"><div class="skel skel-row" style="margin:8px;"></div></td></tr>';
  try {
    var teams = safeArr(await API.fetchAllTeamPoints());
    var preds = safeArr(await API.fetchAllPredictionsAllMatches());
    var matches = _matches.filter(function(m) { return (m.status === 'completed' || m.status === 'processed') && !m.is_abandoned; });
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

function resetFantasyLeaderboard(){
  document.getElementById('fl-search').value = '';
  document.getElementById('fl-ipl-team').value = '';
  document.getElementById('fl-role').value = '';
  document.getElementById('fl-bfl-team').value = '';
  _flPage = 1; filterFantasyLeaderboard();
}

async function renderPointsSummary() {
  function sortPtsRows(rows, col, asc) {
    return rows.slice().sort(function(a, b) {
      var av = a[col], bv = b[col];
      if (typeof av === 'string') av = (av || '').toLowerCase();
      if (typeof bv === 'string') bv = (bv || '').toLowerCase();
      if (col === 'team_name') {
        return asc ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return asc ? (av - bv) : (bv - av);
    });
  }
  
  try {
    var leaderboard = safeArr(await API.fetchLeaderboard());
    var allTeams = safeArr(await API.fetchAllTeamPoints());
    var seasonSquadTotal = 0, seasonPredTotal = 0, seasonBonusTotal = 0;
    
    // Build team data map
    var teamDataMap = {};
    allTeams.forEach(function(t) {
      teamDataMap[t.id] = {
        team_name: t.team_name,
        total_points: t.total_points || 0,
        squad_points: t.squad_points || 0,
        prediction_points: t.prediction_points || 0,
        batting_pts: 0,
        bowling_pts: 0,
        fielding_pts: 0,
        bonus_pts: t.bonus_pts || 0,
        target_pts: 0,
        winner_pts: 0
      };
    });
    
    // Fetch ALL points_log entries in bulk (no team filter) to aggregate Bat/Bowl/Fld per team
    var allLogs = safeArr(await API.fetchAllPointsLogAllTeams());
    var teamSquadBreakdown = {};
    allLogs.forEach(function(log) {
      if (!log.fantasy_team_id) return;
      if (!teamSquadBreakdown[log.fantasy_team_id]) {
        teamSquadBreakdown[log.fantasy_team_id] = { bat:0, bowl:0, fld:0, bonus:0 };
      }
      teamSquadBreakdown[log.fantasy_team_id].bat += (log.batting_pts || 0);
      teamSquadBreakdown[log.fantasy_team_id].bowl += (log.bowling_pts || 0);
      teamSquadBreakdown[log.fantasy_team_id].fld += (log.fielding_pts || 0);
      teamSquadBreakdown[log.fantasy_team_id].bonus += (log.bonus_pts || 0);
    });
    // Assign squad breakdown from bulk points log
    Object.keys(teamSquadBreakdown).forEach(function(tid) {
      if (teamDataMap[tid]) {
        teamDataMap[tid].batting_pts = teamSquadBreakdown[tid].bat;
        teamDataMap[tid].bowling_pts = teamSquadBreakdown[tid].bowl;
        teamDataMap[tid].fielding_pts = teamSquadBreakdown[tid].fld;
        teamDataMap[tid].bonus_pts = teamSquadBreakdown[tid].bonus;
        // Compute squad_points as sum of components
        teamDataMap[tid].squad_points = teamSquadBreakdown[tid].bat + teamSquadBreakdown[tid].bowl + teamSquadBreakdown[tid].fld;
      }
    });
    
    // Compute prediction breakdown from all predictions
    var predBreakdown = {};
    var allPreds = safeArr(await API.fetchAllPredictionsAllMatches());
    var completedMatches = _matches.filter(function(m) { 
      return (m.status === 'completed' || m.status === 'processed') && !m.is_abandoned; 
    });
    var completedMatchIds = completedMatches.map(m => m.id);
    allPreds.forEach(function(p) {
      if (!p.fantasy_team_id || !completedMatchIds.includes(p.match_id)) return;
      if (!predBreakdown[p.fantasy_team_id]) {
        predBreakdown[p.fantasy_team_id] = { target: 0, winner: 0 };
      }
      var match = _matches.find(m => m.id === p.match_id);
      if (match && match.winner && p.predicted_winner === match.winner) {
        predBreakdown[p.fantasy_team_id].winner += 25;
      }
      if (match && match.actual_target && p.target_score) {
        var diff = Math.abs(p.target_score - match.actual_target);
        var tp = 0;
        if (diff === 0) tp = 250;
        else if (diff === 1) tp = 150;
        else if (diff <= 5) tp = 100;
        else if (diff <= 10) tp = 50;
        predBreakdown[p.fantasy_team_id].target += tp;
      }
    });
    // Assign prediction breakdown
    Object.keys(predBreakdown).forEach(function(tid) {
      if (teamDataMap[tid]) {
        teamDataMap[tid].target_pts = predBreakdown[tid].target;
        teamDataMap[tid].winner_pts = predBreakdown[tid].winner;
      } else {
        if (!teamDataMap[tid]) teamDataMap[tid] = {};
        teamDataMap[tid].target_pts = predBreakdown[tid].target;
        teamDataMap[tid].winner_pts = predBreakdown[tid].winner;
      }
    });
    
    // Recalculate season totals after all assignments
    seasonSquadTotal = 0; seasonPredTotal = 0; seasonBonusTotal = 0;
    Object.keys(teamDataMap).forEach(function(tid) {
      var t = teamDataMap[tid];
      var derivedSquad = (t.batting_pts || 0) + (t.bowling_pts || 0) + (t.fielding_pts || 0);
      seasonSquadTotal += derivedSquad;
      seasonPredTotal += ((t.target_pts || 0) + (t.winner_pts || 0));
      seasonBonusTotal += (t.bonus_pts || 0);
    });
    
    var allSeasonTotal = seasonSquadTotal + seasonPredTotal + seasonBonusTotal;
    
    // Calculate each team's total season points
    Object.keys(teamDataMap).forEach(function(tid) {
      var t = teamDataMap[tid];
      var squadPts = (t.batting_pts || 0) + (t.bowling_pts || 0) + (t.fielding_pts || 0);
      var predPts = (t.target_pts || 0) + (t.winner_pts || 0);
      var bonusPts = t.bonus_pts || 0;
      teamDataMap[tid].team_total = squadPts + predPts + bonusPts;
      teamDataMap[tid].squad_total = squadPts;
      teamDataMap[tid].pred_total = predPts;
    });
    
    // Sort teams based on current sort column - Squad table uses _ptsSortSquad, Pred table uses _ptsSortPred
    var sortedSquadTeams = sortPtsRows(Object.values(teamDataMap), _ptsSortSquad.col, _ptsSortSquad.asc);
    var sortedPredTeams = sortPtsRows(Object.values(teamDataMap), _ptsSortPred.col, _ptsSortPred.asc);
    
    // Render Squad Points Table Headers with sort indicators
    var squadTable = document.querySelector('#tab-points-summary .card:first-child table');
    if (squadTable) {
      var squadHeaders = squadTable.querySelector('thead tr');
      if (squadHeaders) {
        var arrowSquad = function(col) { return _ptsSortSquad.col === col ? (_ptsSortSquad.asc ? ' ▲' : ' ▼') : ''; };
        squadHeaders.innerHTML = '<th style="text-align:left;cursor:pointer;user-select:none;" onclick="_ptsSortBy(\'squad\',\'team_name\')">Team' + arrowSquad('team_name') + '</th>' +
          '<th style="text-align:right;cursor:pointer;user-select:none;" onclick="_ptsSortBy(\'squad\',\'batting_pts\')">Batting' + arrowSquad('batting_pts') + '</th>' +
          '<th style="text-align:right;cursor:pointer;user-select:none;" onclick="_ptsSortBy(\'squad\',\'bowling_pts\')">Bowling' + arrowSquad('bowling_pts') + '</th>' +
          '<th style="text-align:right;cursor:pointer;user-select:none;" onclick="_ptsSortBy(\'squad\',\'fielding_pts\')">Fielding' + arrowSquad('fielding_pts') + '</th>' +
          '<th style="text-align:right;cursor:pointer;user-select:none;" onclick="_ptsSortBy(\'squad\',\'squad_total\')">Squad Total' + arrowSquad('squad_total') + '</th>' +
          '<th style="text-align:right;cursor:pointer;user-select:none;" onclick="_ptsSortBy(\'squad\',\'team_total\')">Season Total' + arrowSquad('team_total') + '</th>';
      }
    }
    
// Render Squad Points Table
    var squadTbody = document.getElementById('points-squad-tbody');
    if (squadTbody) {
      if (!sortedSquadTeams.length) {
        squadTbody.innerHTML = '<tr><td colspan="6" class="empty-state">No team data available</td></tr>';
      } else {
        squadTbody.innerHTML = sortedSquadTeams.map(function(t) {
          var batPts = t.batting_pts || 0;
          var bowlPts = t.bowling_pts || 0;
          var fldPts = t.fielding_pts || 0;
          var squadPts = batPts + bowlPts + fldPts;
          var teamTotal = t.team_total || 0;
          var squadShare = teamTotal > 0 ? Math.round((squadPts / teamTotal) * 100) : 0;
          var batPct = squadPts > 0 ? Math.round((batPts / squadPts) * 100) : 0;
          var bowlPct = squadPts > 0 ? Math.round((bowlPts / squadPts) * 100) : 0;
          var fldPct = squadPts > 0 ? Math.round((fldPts / squadPts) * 100) : 0;
          
          return '<tr>' +
            '<td style="font-weight:800;">' + UI.esc(UI.tShort(t.team_name)) + '</td>' +
            '<td><div class="pts-cell"><span class="pts-value" style="color:#f87171;">' + UI.fmtPts(batPts) + '</span><span class="pts-pct">' + (batPct || 0) + '%</span></div></td>' +
            '<td><div class="pts-cell"><span class="pts-value" style="color:#60a5fa;">' + UI.fmtPts(bowlPts) + '</span><span class="pts-pct">' + (bowlPct || 0) + '%</span></div></td>' +
            '<td><div class="pts-cell"><span class="pts-value" style="color:#34d399;">' + UI.fmtPts(fldPts) + '</span><span class="pts-pct">' + (fldPct || 0) + '%</span></div></td>' +
            '<td><div class="pts-cell"><span class="pts-value" style="color:var(--cyan);">' + UI.fmtPts(squadPts) + '</span><span class="pts-pct">' + (squadShare || 0) + '%</span></div></td>' +
            '<td class="total-cell"><div class="pts-cell"><span class="pts-value" style="color:var(--accent);">' + UI.fmtPts(teamTotal) + '</span></div></td>' +
          '</tr>';
        }).join('');
      }
    }
    
    // Render Prediction Points Table
    var predTable = document.querySelector('#tab-points-summary .card:nth-child(2) table');
    if (predTable) {
      var predHeaders = predTable.querySelector('thead tr');
      if (predHeaders) {
        var arrowPred = function(col) { return _ptsSortPred.col === col ? (_ptsSortPred.asc ? ' ▲' : ' ▼') : ''; };
        predHeaders.innerHTML = '<th style="text-align:left;cursor:pointer;user-select:none;" onclick="_ptsSortBy(\'pred\',\'team_name\')">Team' + arrowPred('team_name') + '</th>' +
          '<th style="text-align:right;cursor:pointer;user-select:none;" onclick="_ptsSortBy(\'pred\',\'target_pts\')">Target' + arrowPred('target_pts') + '</th>' +
          '<th style="text-align:right;cursor:pointer;user-select:none;" onclick="_ptsSortBy(\'pred\',\'winner_pts\')">Winner' + arrowPred('winner_pts') + '</th>' +
          '<th style="text-align:right;cursor:pointer;user-select:none;" onclick="_ptsSortBy(\'pred\',\'pred_total\')">Pred Total' + arrowPred('pred_total') + '</th>' +
          '<th style="text-align:right;cursor:pointer;user-select:none;" onclick="_ptsSortBy(\'pred\',\'bonus_pts\')">Bonus' + arrowPred('bonus_pts') + '</th>' +
          '<th style="text-align:right;cursor:pointer;user-select:none;" onclick="_ptsSortBy(\'pred\',\'team_total\')">Season Total' + arrowPred('team_total') + '</th>';
      }
    }
    
    var predTbody = document.getElementById('points-pred-tbody');
    if (predTbody) {
      if (!sortedPredTeams.length) {
        predTbody.innerHTML = '<tr><td colspan="7" class="empty-state">No team data available</td></tr>';
      } else {
        predTbody.innerHTML = sortedPredTeams.map(function(t) {
          var targetPts = t.target_pts || 0;
          var winnerPts = t.winner_pts || 0;
          var predPts = targetPts + winnerPts;
          var bonusPts = t.bonus_pts || 0;
          var predShare = allSeasonTotal > 0 ? Math.round(((predPts + bonusPts) / allSeasonTotal) * 100) : 0;
          var teamTotal = t.team_total || 0;
          var predShare = teamTotal > 0 ? Math.round((predPts / teamTotal) * 100) : 0;
          var bonusShare = teamTotal > 0 ? Math.round((bonusPts / teamTotal) * 100) : 0;
          
          return '<tr>' +
            '<td style="font-weight:700;font-size:14px;">' + UI.esc(UI.tShort(t.team_name)) + '</td>' +
            '<td><div class="pts-cell"><span class="pts-value" style="color:#f87171;">' + UI.fmtPts(targetPts) + '</span><span class="pts-pct">' + (targetPts > 0 && predPts > 0 ? Math.round((targetPts/predPts)*100) : 0) + '%</span></div></td>' +
            '<td><div class="pts-cell"><span class="pts-value" style="color:#60a5fa;">' + UI.fmtPts(winnerPts) + '</span><span class="pts-pct">' + (winnerPts > 0 && predPts > 0 ? Math.round((winnerPts/predPts)*100) : 0) + '%</span></div></td>' +
            '<td><div class="pts-cell"><span class="pts-value" style="color:var(--cyan);">' + UI.fmtPts(predPts) + '</span><span class="pts-pct">' + (predShare || 0) + '%</span></div></td>' +
            '<td><div class="pts-cell"><span class="pts-value" style="color:var(--purple);">' + UI.fmtPts(bonusPts) + '</span><span class="pts-pct">' + (bonusShare || 0) + '%</span></div></td>' +
            '<td class="total-cell"><div class="pts-cell"><span class="pts-value" style="color:var(--accent);">' + UI.fmtPts(teamTotal) + '</span></div></td>' +
          '</tr>';
        }).join('');
      }
    }
  } catch(e) {
    console.warn('Points summary error:', e);
    var squadTbody = document.getElementById('points-squad-tbody');
    var predTbody = document.getElementById('points-pred-tbody');
    if (squadTbody) squadTbody.innerHTML = '<tr><td colspan="6" class="empty-state">Error loading data</td></tr>';
    if (predTbody) predTbody.innerHTML = '<tr><td colspan="6" class="empty-state">Error loading data</td></tr>';
  }
}

async function renderTeamInsights() {
  var tbody = document.getElementById('ti-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="13" class="empty-state">Loading…</td></tr>';
  
  try {
    var allLogs = safeArr(await API.fetchAllPointsLogAllTeams());
    var allTeams = safeArr(await API.fetchAllTeamPoints());
    var matches = _matches.filter(function(m) { return m.status === 'completed' || m.status === 'processed'; });
    
    // Build team insights data
    var teamData = {};
    allTeams.forEach(function(t) {
      teamData[t.id] = {
        team_name: t.team_name,
        team_short: UI.tShort(t.team_name),
        logs: [],
        total: t.total_points || 0
      };
    });
    
    // Aggregate points by team - only for completed/processed matches
    allLogs.forEach(function(log) {
      var teamId = log.fantasy_team_id;
      var matchId = log.match_id;
      
      if (!teamId || !matchId) return;
      var match = matches.find(function(m) { return String(m.id) === String(matchId); });
      if (!match) return;
      if (match.status !== 'completed' && match.status !== 'processed') return;
      if (!teamData[teamId]) return;
      teamData[teamId].logs.push({
        match_id: matchId,
        match_no: match?.match_no,
        match_label: match ? 'M' + (match.match_no || '?') + ' · ' + UI.tShort(match.team1) + ' vs ' + UI.tShort(match.team2) : 'M?',
        team1: match?.team1,
        team2: match?.team2,
        batting: log.batting_pts || 0,
        bowling: log.bowling_pts || 0,
        fielding: log.fielding_pts || 0,
        squad: (log.batting_pts || 0) + (log.bowling_pts || 0) + (log.fielding_pts || 0),
        pred: log.prediction_points || 0,
        bonus: log.bonus_pts || 0,
        total: log.total_points || 0
      });
    });
    
    // Calculate insights
    var insights = Object.values(teamData).map(function(t) {
      var logs = t.logs;
      var matches_played = logs.length;
      var squad = logs.reduce(function(s, l) { return s + l.squad; }, 0);
      var pred = logs.reduce(function(s, l) { return s + l.pred; }, 0);
      var bonus = logs.reduce(function(s, l) { return s + l.bonus; }, 0);
      var total = squad + pred + bonus;
      var avg = matches_played > 0 ? Math.round(total / matches_played) : 0;
      
      // Find lowest and highest
      var sorted = logs.slice().sort(function(a, b) { return a.total - b.total; });
      var lowest = sorted[0] || null;
      var highest = sorted[sorted.length - 1] || null;
      
      // Count thresholds
      var below25 = logs.filter(function(l) { return l.total < 25; }).length;
      var over250 = logs.filter(function(l) { return l.total >= 250; }).length;
      var over500 = logs.filter(function(l) { return l.total >= 500; }).length;
      var over1000 = logs.filter(function(l) { return l.total >= 1000; }).length;
      
      return {
        team_name: t.team_name,
        team_short: t.team_short,
        matches: matches_played,
        squad: squad,
        pred: pred,
        bonus: bonus,
        total: total,
        avg: avg,
        lowest: lowest,
        highest: highest,
        below25: below25,
        over250: over250,
        over500: over500,
        over1000: over1000
      };
    });
    
    // Sort
    var col = _tiSort.col;
    var asc = _tiSort.asc;
    insights.sort(function(a, b) {
      var av = a[col];
      var bv = b[col];
      if (col === 'team_name') {
        return asc ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      if (col === 'lowest' || col === 'highest') {
        av = a[col] ? a[col].total : (col === 'lowest' ? Infinity : -Infinity);
        bv = b[col] ? b[col].total : (col === 'lowest' ? Infinity : -Infinity);
      }
      return asc ? av - bv : bv - av;
    });
    
    // Update headers with arrows
    var arrow = function(c) { return _tiSort.col === c ? (_tiSort.asc ? ' ▲' : ' ▼') : ''; };
    var thead = document.getElementById('ti-thead');
    if (thead) {
      thead.innerHTML = '<tr>' +
        '<th class="th-sortable" onclick="_tiSortBy(\'team_name\')">Team' + arrow('team_name') + '</th>' +
        '<th class="th-sortable" onclick="_tiSortBy(\'matches\')">MP' + arrow('matches') + '</th>' +
        '<th class="th-sortable" onclick="_tiSortBy(\'squad\')">Squad' + arrow('squad') + '</th>' +
        '<th class="th-sortable" onclick="_tiSortBy(\'pred\')">Pred' + arrow('pred') + '</th>' +
        '<th class="th-sortable" onclick="_tiSortBy(\'bonus\')">Bonus' + arrow('bonus') + '</th>' +
        '<th class="th-sortable ti-total" onclick="_tiSortBy(\'total\')">Total' + arrow('total') + '</th>' +
        '<th class="th-sortable" onclick="_tiSortBy(\'avg\')">Avg' + arrow('avg') + '</th>' +
        '<th class="th-sortable" onclick="_tiSortBy(\'lowest\')">Lowest' + arrow('lowest') + '</th>' +
        '<th class="th-sortable" onclick="_tiSortBy(\'highest\')">Highest' + arrow('highest') + '</th>' +
        '<th class="th-sortable" onclick="_tiSortBy(\'below25\')">&lt;25' + arrow('below25') + '</th>' +
        '<th class="th-sortable" onclick="_tiSortBy(\'over250\')">250+' + arrow('over250') + '</th>' +
        '<th class="th-sortable" onclick="_tiSortBy(\'over500\')">500+' + arrow('over500') + '</th>' +
        '<th class="th-sortable" onclick="_tiSortBy(\'over1000\')">1000+' + arrow('over1000') + '</th>' +
      '</tr>';
    }
    
    // Render rows
    if (!insights.length) {
      tbody.innerHTML = '<tr><td colspan="13" class="empty-state">No team data available</td></tr>';
      return;
    }
    
    tbody.innerHTML = insights.map(function(t) {
      var lowestHtml = t.lowest 
        ? '<span class="ti-num ti-low">' + t.lowest.total + '</span><span class="ti-match">' + t.lowest.match_label.split('·')[0] + '</span>'
        : '—';
      var highestHtml = t.highest 
        ? '<span class="ti-num ti-high">' + t.highest.total + '</span><span class="ti-match">' + t.highest.match_label.split('·')[0] + '</span>'
        : '—';
      
      return '<tr>' +
        '<td class="ti-team">' + UI.esc(t.team_short) + '</td>' +
        '<td class="ti-num">' + t.matches + '</td>' +
        '<td class="ti-num">' + UI.fmtPts(t.squad) + '</td>' +
        '<td class="ti-num">' + UI.fmtPts(t.pred) + '</td>' +
        '<td class="ti-num">' + UI.fmtPts(t.bonus) + '</td>' +
        '<td class="ti-num ti-total">' + UI.fmtPts(t.total) + '</td>' +
        '<td class="ti-num">' + UI.fmtPts(t.avg) + '</td>' +
        '<td>' + lowestHtml + '</td>' +
        '<td>' + highestHtml + '</td>' +
        '<td><span class="ti-badge ti-badge-red">' + t.below25 + '</span></td>' +
        '<td><span class="ti-badge ti-badge-gold">' + t.over250 + '</span></td>' +
        '<td><span class="ti-badge ti-badge-green">' + t.over500 + '</span></td>' +
        '<td><span class="ti-badge ti-badge-cyan">' + t.over1000 + '</span></td>' +
      '</tr>';
    }).join('');
    
    // Load and render team stats cards (batting, bowling, fielding)
    await renderTeamStatsCards(teamData);
    
  } catch(e) {
    console.warn('Team insights error:', e);
    tbody.innerHTML = '<tr><td colspan="13" class="empty-state">Error loading data</td></tr>';
  }
}

async function renderTeamStatsCards(teamDataMap, tableType) {
  try {
    // Show skeleton loaders immediately
    var batTbody = document.getElementById('batting-stats-tbody');
    var bowlTbody = document.getElementById('bowling-stats-tbody');
    var fieldTbody = document.getElementById('fielding-stats-tbody');
    if (batTbody) batTbody.innerHTML = '<tr><td colspan="9" class="empty-state" style="padding:40px;"><div class="skel skel-row" style="margin:8px;"></div><div class="skel skel-row" style="margin:8px;"></div><div class="skel skel-row" style="margin:8px;"></div></td></tr>';
    if (bowlTbody) bowlTbody.innerHTML = '<tr><td colspan="8" class="empty-state" style="padding:40px;"><div class="skel skel-row" style="margin:8px;"></div><div class="skel skel-row" style="margin:8px;"></div><div class="skel skel-row" style="margin:8px;"></div></td></tr>';
    if (fieldTbody) fieldTbody.innerHTML = '<tr><td colspan="4" class="empty-state" style="padding:40px;"><div class="skel skel-row" style="margin:8px;"></div><div class="skel skel-row" style="margin:8px;"></div><div class="skel skel-row" style="margin:8px;"></div></td></tr>';

    var allPlayerStats = safeArr(await API.fetchAllPlayerStats());
    var squadData = safeArr(await API.fetchSquadPlayersAll());

    // Store for re-rendering on sort
    window._lastTeamDataMap = teamDataMap;

    // Build match ID -> match_no mapping from _matches
    var matchIdToNo = {};
    _matches.forEach(function(m) {
      if (m.id && m.match_no != null) {
        matchIdToNo[String(m.id)] = Number(m.match_no);
      }
    });
    var assignments = {};
    squadData.forEach(function(sp) {
      if (!sp.player_id || !sp.fantasy_team_id) return;
      var pid = sp.player_id;
      if (!assignments[pid]) assignments[pid] = [];
      var startNo = sp.start_match_id ? (matchIdToNo[String(sp.start_match_id)] || 0) : 0;
      var endNo = sp.end_match_id ? (matchIdToNo[String(sp.end_match_id)] || Infinity) : Infinity;
      assignments[pid].push({
        teamId: sp.fantasy_team_id,
        start: startNo,
        end: endNo
      });
    });
    Object.keys(assignments).forEach(function(pid) {
      assignments[pid].sort(function(a, b) { return a.start - b.start; });
    });

    // Initialize aggregates
    var aggregates = {};
    Object.keys(teamDataMap).forEach(function(tid) {
      aggregates[tid] = {
        team_name: teamDataMap[tid].team_name,
        team_short: teamDataMap[tid].team_short,
        runs: 0, balls_faced: 0, fours: 0, sixes: 0, fifties: 0, hundreds: 0, not_outs: 0, innings: 0,
        wickets: 0, maidens: 0, runs_conceded: 0, overs: 0, three_fers: 0, five_fers: 0,
        catches: 0, run_outs: 0, stumpings: 0
      };
    });

    function findTeam(playerId, matchIdStr) {
      var list = assignments[playerId];
      if (!list) return null;
      var matchNo = matchIdToNo[matchIdStr];
      if (matchNo === undefined) return null;
      for (var i = 0; i < list.length; i++) {
        var a = list[i];
        if (matchNo >= a.start && matchNo <= a.end) return a.teamId;
      }
      return null;
    }

    // Aggregate
    allPlayerStats.forEach(function(ps) {
      var matchId = ps.match_id;
      if (!matchId) return;
      var matchIdStr = String(matchId);
      var playerId = ps.player_id;
      var teamId = findTeam(playerId, matchIdStr);
      if (!teamId || !aggregates[teamId]) return;
      var agg = aggregates[teamId];

      var runs = Number(ps.runs || 0);
      var balls = Number(ps.balls_faced || 0);
      agg.runs += runs; agg.balls_faced += balls; agg.fours += Number(ps.fours || 0); agg.sixes += Number(ps.sixes || 0);
      if (runs > 0 || balls > 0) agg.innings++;
      if (ps.not_out) agg.not_outs++;
      if (runs >= 50 && runs < 100) agg.fifties++;
      if (runs >= 100) agg.hundreds++;

      var wickets = Number(ps.wickets || 0);
      agg.wickets += wickets; agg.maidens += Number(ps.maidens || 0);
      agg.runs_conceded += Number(ps.runs_conceded || 0);
      agg.overs += API.getTrueOvers(ps.overs_bowled);
      if (wickets >= 3 && wickets < 5) agg.three_fers++;
      if (wickets >= 5) agg.five_fers++;

      agg.catches += Number(ps.catches || 0);
      agg.run_outs += Number(ps.run_outs || 0);
      agg.stumpings += Number(ps.stumpings || 0);
    });

    // Build list
    var teamStatsList = Object.values(aggregates).map(function(t) {
      var sr = t.balls_faced > 0 ? Math.round((t.runs / t.balls_faced) * 100 * 10) / 10 : 0;
      var avg = (t.innings - t.not_outs) > 0 ? Math.round((t.runs / (t.innings - t.not_outs)) * 10) / 10 : (t.runs > 0 ? t.runs : 0);
      var bowlAvg = t.wickets > 0 ? Math.round((t.runs_conceded / t.wickets) * 10) / 10 : 0;
      var eco = t.overs > 0 ? Math.round((t.runs_conceded / t.overs) * 10) / 10 : 0;
      return {
        team_name: t.team_name, team_short: t.team_short,
        batting: { runs: t.runs, balls_faced: t.balls_faced, fours: t.fours, sixes: t.sixes, sr: sr, avg: avg, fifties: t.fifties, hundreds: t.hundreds },
        bowling: { wickets: t.wickets, maidens: t.maidens, runs_conceded: t.runs_conceded, avg: bowlAvg, economy: eco, three_fers: t.three_fers, five_fers: t.five_fers },
        fielding: { catches: t.catches, run_outs: t.run_outs, stumpings: t.stumpings }
      };
    });

    // Determine which table to render based on tableType or global sort state
    var sortStates = {
      batting: _battingSort,
      bowling: _bowlingSort,
      fielding: _fieldingSort
    };

    // Render all tables, each with its own sort (or only the specified one if tableType provided)
    var tablesToRender = tableType ? [tableType] : ['batting', 'bowling', 'fielding'];

    // Batting
    if (tablesToRender.includes('batting')) {
      var batSort = _battingSort;
      var sortedBatting = teamStatsList.slice().sort(function(a, b) {
        var av = a.batting[batSort.col], bv = b.batting[batSort.col];
        if (batSort.col === 'team_short') return batSort.asc ? av.localeCompare(bv) : bv.localeCompare(av);
        return batSort.asc ? av - bv : bv - av;
      });
      updateBattingHeaders(batSort);
      if (batTbody) batTbody.innerHTML = sortedBatting.map(function(t) {
        return '<tr><td class="ti-team-col">' + UI.esc(t.team_short) + '</td><td class="stat-num' + (t.batting.runs > 0 ? ' high' : '') + '">' + UI.fmtPts(t.batting.runs) + '</td><td class="stat-num">' + UI.fmtPts(t.batting.balls_faced) + '</td><td>' + UI.fmtPts(t.batting.fours) + '</td><td>' + UI.fmtPts(t.batting.sixes) + '</td><td class="stat-num">' + t.batting.sr + '</td><td class="stat-num">' + t.batting.avg + '</td><td><span class="ti-badge ti-badge-gold">' + t.batting.fifties + '</span></td><td><span class="ti-badge ti-badge-cyan">' + t.batting.hundreds + '</span></td></tr>';
      }).join('') + '<tr class="total-row"><td>Totals</td><td>' + UI.fmtPts(teamStatsList.reduce((s,t) => s + t.batting.runs,0)) + '</td><td>' + UI.fmtPts(teamStatsList.reduce((s,t) => s + t.batting.balls_faced,0)) + '</td><td>' + UI.fmtPts(teamStatsList.reduce((s,t) => s + t.batting.fours,0)) + '</td><td>' + UI.fmtPts(teamStatsList.reduce((s,t) => s + t.batting.sixes,0)) + '</td><td>—</td><td>—</td><td>' + UI.fmtPts(teamStatsList.reduce((s,t) => s + t.batting.fifties,0)) + '</td><td>' + UI.fmtPts(teamStatsList.reduce((s,t) => s + t.batting.hundreds,0)) + '</td></tr>';
    }

    // Bowling
    if (tablesToRender.includes('bowling')) {
      var bowlSort = _bowlingSort;
      var sortedBowling = teamStatsList.slice().sort(function(a, b) {
        var av = a.bowling[bowlSort.col], bv = b.bowling[bowlSort.col];
        if (bowlSort.col === 'team_short') return bowlSort.asc ? av.localeCompare(bv) : bv.localeCompare(av);
        return bowlSort.asc ? av - bv : bv - av;
      });
      updateBowlingHeaders(bowlSort);
      if (bowlTbody) bowlTbody.innerHTML = sortedBowling.map(function(t) {
        return '<tr><td class="ti-team-col">' + UI.esc(t.team_short) + '</td><td class="stat-num' + (t.bowling.wickets > 0 ? ' high' : '') + '">' + UI.fmtPts(t.bowling.wickets) + '</td><td>' + UI.fmtPts(t.bowling.maidens) + '</td><td class="stat-num">' + UI.fmtPts(t.bowling.runs_conceded) + '</td><td class="stat-num">' + t.bowling.avg + '</td><td class="stat-num">' + t.bowling.economy + '</td><td><span class="ti-badge ti-badge-gold">' + t.bowling.three_fers + '</span></td><td><span class="ti-badge ti-badge-cyan">' + t.bowling.five_fers + '</span></td></tr>';
      }).join('') + '<tr class="total-row"><td>Totals</td><td>' + UI.fmtPts(teamStatsList.reduce((s,t) => s + t.bowling.wickets,0)) + '</td><td>' + UI.fmtPts(teamStatsList.reduce((s,t) => s + t.bowling.maidens,0)) + '</td><td>' + UI.fmtPts(teamStatsList.reduce((s,t) => s + t.bowling.runs_conceded,0)) + '</td><td>—</td><td>—</td><td>' + UI.fmtPts(teamStatsList.reduce((s,t) => s + t.bowling.three_fers,0)) + '</td><td>' + UI.fmtPts(teamStatsList.reduce((s,t) => s + t.bowling.five_fers,0)) + '</td></tr>';
    }

    // Fielding
    if (tablesToRender.includes('fielding')) {
      var fieldSort = _fieldingSort;
      var sortedFielding = teamStatsList.slice().sort(function(a, b) {
        var av = a.fielding[fieldSort.col], bv = b.fielding[fieldSort.col];
        if (fieldSort.col === 'team_short') return fieldSort.asc ? av.localeCompare(bv) : bv.localeCompare(av);
        return fieldSort.asc ? av - bv : bv - av;
      });
      updateFieldingHeaders(fieldSort);
      if (fieldTbody) fieldTbody.innerHTML = sortedFielding.map(function(t) {
        return '<tr><td class="ti-team-col">' + UI.esc(t.team_short) + '</td><td class="stat-num' + (t.fielding.catches > 0 ? ' high' : '') + '">' + UI.fmtPts(t.fielding.catches) + '</td><td>' + UI.fmtPts(t.fielding.run_outs) + '</td><td>' + UI.fmtPts(t.fielding.stumpings) + '</td></tr>';
      }).join('') + '<tr class="total-row"><td>Totals</td><td>' + UI.fmtPts(teamStatsList.reduce((s,t) => s + t.fielding.catches,0)) + '</td><td>' + UI.fmtPts(teamStatsList.reduce((s,t) => s + t.fielding.run_outs,0)) + '</td><td>' + UI.fmtPts(teamStatsList.reduce((s,t) => s + t.fielding.stumpings,0)) + '</td></tr>';
    }

  } catch(e) {
    console.warn('Team stats cards error:', e);
    var bat = document.getElementById('batting-stats-tbody');
    var bowl = document.getElementById('bowling-stats-tbody');
    var field = document.getElementById('fielding-stats-tbody');
    if (bat) bat.innerHTML = '<tr><td colspan="9" class="empty-state">Error loading</td></tr>';
    if (bowl) bowl.innerHTML = '<tr><td colspan="8" class="empty-state">Error loading</td></tr>';
    if (field) field.innerHTML = '<tr><td colspan="4" class="empty-state">Error loading</td></tr>';
  }
}

// Header arrow updaters
function updateBattingHeaders(sort) {
  var thead = document.querySelector('#batting-stats-tbody').previousElementSibling;
  if (!thead || !thead.rows || !thead.rows[0]) return;
  var arrow = function(c) { return sort.col === c ? (sort.asc ? ' ▲' : ' ▼') : ''; };
  var h = thead.rows[0];
  h.cells[0].innerHTML = 'Team' + arrow('team_short');
  h.cells[1].innerHTML = 'Runs' + arrow('runs');
  h.cells[2].innerHTML = 'Balls' + arrow('balls_faced');
  h.cells[3].innerHTML = '4s' + arrow('fours');
  h.cells[4].innerHTML = '6s' + arrow('sixes');
  h.cells[5].innerHTML = 'SR' + arrow('sr');
  h.cells[6].innerHTML = 'Avg' + arrow('avg');
  h.cells[7].innerHTML = '50s' + arrow('fifties');
  h.cells[8].innerHTML = '100s' + arrow('hundreds');
}
function updateBowlingHeaders(sort) {
  var thead = document.querySelector('#bowling-stats-tbody').previousElementSibling;
  if (!thead || !thead.rows || !thead.rows[0]) return;
  var arrow = function(c) { return sort.col === c ? (sort.asc ? ' ▲' : ' ▼') : ''; };
  var h = thead.rows[0];
  h.cells[0].innerHTML = 'Team' + arrow('team_short');
  h.cells[1].innerHTML = 'Wkts' + arrow('wickets');
  h.cells[2].innerHTML = 'Maid' + arrow('maidens');
  h.cells[3].innerHTML = 'Runs' + arrow('runs_conceded');
  h.cells[4].innerHTML = 'Avg' + arrow('avg');
  h.cells[5].innerHTML = 'Eco' + arrow('economy');
  h.cells[6].innerHTML = '3-F' + arrow('three_fers');
  h.cells[7].innerHTML = '5-F' + arrow('five_fers');
}
function updateFieldingHeaders(sort) {
  var thead = document.querySelector('#fielding-stats-tbody').previousElementSibling;
  if (!thead || !thead.rows || !thead.rows[0]) return;
  var arrow = function(c) { return sort.col === c ? (sort.asc ? ' ▲' : ' ▼') : ''; };
  var h = thead.rows[0];
  h.cells[0].innerHTML = 'Team' + arrow('team_short');
  h.cells[1].innerHTML = 'Catches' + arrow('catches');
  h.cells[2].innerHTML = 'Runouts' + arrow('run_outs');
  h.cells[3].innerHTML = 'Stumpings' + arrow('stumpings');
}

async function switchTab(tab) {
  var prevPanel = document.querySelector('.tab-panel.active');
  if (prevPanel && prevPanel.id !== 'tab-' + tab) {
    prevPanel.classList.add('leaving');
    await new Promise(r => setTimeout(r, 180));
    prevPanel.classList.remove('active', 'leaving');
  }

   var tabs=['pred-summary','accuracy','match-preds','points-summary','team-insights','fantasy-players','user-teams','power-rankings'];
  document.querySelectorAll('.tab-btn').forEach(function(b){
    var id = b.getAttribute('onclick').match(/'([^']+)'/)[1];
    b.classList.toggle('active', id === tab);
  });

  var panel=document.getElementById('tab-'+tab);
  if(panel) {
    panel.classList.add('active');
    // Trigger staggering if container exists
    var staggerCont = panel.querySelector('.stagger-load');
    if (staggerCont) {
        staggerCont.classList.remove('loaded');
        setTimeout(() => staggerCont.classList.add('loaded'), 50);
    }
  }

   // Specific tab loads
   if(tab==='pred-summary') loadPredictionsSummary();
   if(tab==='accuracy') loadPredictionAccuracy();
   if(tab==='match-preds') loadMatchPredictionsPanel();
   if(tab==='points-summary') renderPointsSummary();
   if(tab==='team-insights') renderTeamInsights();
   if(tab==='fantasy-players') loadFantasyLeaderboard();
   if(tab==='user-teams') loadUserTeams();
   if(tab==='power-rankings') loadPowerRankings();
}
init();
