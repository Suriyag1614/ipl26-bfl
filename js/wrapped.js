/* js/wrapped.js — IPL26 Season Highlights Logic */
'use strict';

let _wrappedData = null;
let _currentSlide = 0;
const _totalSlides = 10; // 10 slides in total
let _slideInterval = null;
const _slideDuration = 7500; // 7.5 seconds per slide
let _progressElapsed = 0;
let _isPaused = false;

// 1. Data Fetching & Page Initializer
async function initWrapped() {
  const loader = document.getElementById('wrapped-loader');
  const errorView = document.getElementById('wrapped-error');
  const storyWrap = document.getElementById('story-wrap');

  try {
    const sess = await Auth.requireAuth();
    if (!sess) return;

    const team = await Auth.fetchTeam(sess.user.id);
    if (!team) {
      throw new Error("No fantasy team found for this user.");
    }

    loader.style.display = 'flex';
    _wrappedData = await API.fetchSeasonWrappedData(team.id);

    if (!_wrappedData || !_wrappedData.leaderboard) {
      throw new Error("Season stats are not compiled yet. Play some matches first!");
    }

    // Compile Highlights Data
    const journey = computeJourney(_wrappedData);
    const squadStory = computeSquadStory(_wrappedData);
    const captainStory = computeCaptainStory(_wrappedData);
    const mvpStory = computeMVPDependency(_wrappedData);
    const predStory = computePredictionStory(_wrappedData);
    const reportCard = computeTeamReportCard(_wrappedData, squadStory, predStory);
    const achievements = computeRecordsAchievements(_wrappedData, journey, squadStory, predStory);
    const truth = computeUnexpectedTruth(_wrappedData, squadStory, mvpStory, captainStory);
    const legacy = computeLegacy(_wrappedData, journey, captainStory, mvpStory);

    // Bind data to slides
    renderJourneySlide(journey);
    renderSquadStorySlide(squadStory);
    renderCaptainSlide(captainStory);
    renderMVPSlide(mvpStory);
    renderPredictionSlide(predStory);
    renderReportCardSlide(reportCard);
    renderAchievementsSlide(achievements);
    renderTruthSlide(truth);
    renderVerdictSlide(_wrappedData);
    renderLegacySlide(legacy);

    // Create progress indicator segments
    buildProgressBars();

    // Hide loader, show story deck
    loader.style.display = 'none';
    storyWrap.style.display = 'flex';

    // Start timer progression
    startSlideTimer();
    showSlide(0);

    // Bind inputs
    bindNavEvents();

  } catch (err) {
    console.error('[Wrapped]', err);
    loader.style.display = 'none';
    errorView.style.display = 'flex';
    document.getElementById('wrapped-error-msg').textContent = err.message || 'Error compiling season highlights.';
  }
}

// 2. Calculations Engine

function computeJourney(data) {
  const myTeamId = data.leaderboard.fantasy_team_id;
  const matchNoMap = {};
  data.allMatches.forEach(m => { matchNoMap[m.id] = m.match_no; });

  // Map each team's score per match number
  const teamPointsByMatchNo = {}; // fantasy_team_id -> { match_no -> points }
  data.allPointsLogs.forEach(log => {
    const mNo = matchNoMap[log.match_id];
    if (!mNo) return;
    if (!teamPointsByMatchNo[log.fantasy_team_id]) teamPointsByMatchNo[log.fantasy_team_id] = {};
    teamPointsByMatchNo[log.fantasy_team_id][mNo] = Number(log.squad_points || 0) + Number(log.prediction_points || 0);
  });

  const allTeamIds = Object.keys(teamPointsByMatchNo);
  const activeMatchNos = [...new Set(data.allPointsLogs.map(l => matchNoMap[l.match_id]).filter(Boolean))].sort((a, b) => a - b);

  let rankHistory = [];
  let pointsProgression = [];
  let teamCumulatives = {};
  allTeamIds.forEach(id => { teamCumulatives[id] = 0; });

  activeMatchNos.forEach(mNo => {
    allTeamIds.forEach(id => {
      teamCumulatives[id] += (teamPointsByMatchNo[id][mNo] || 0);
    });

    const standings = Object.entries(teamCumulatives)
      .map(([id, pts]) => ({ id, pts }))
      .sort((a, b) => b.pts - a.pts);

    const myIndex = standings.findIndex(s => s.id === myTeamId);
    const myRank = myIndex !== -1 ? myIndex + 1 : 999;

    rankHistory.push({ matchNo: mNo, rank: myRank });
    pointsProgression.push({ label: 'M' + mNo, value: teamCumulatives[myTeamId] || 0 });
  });

  const myLogs = [...data.pointsLog].sort((a, b) => (a.match?.match_no || 0) - (b.match?.match_no || 0));
  const peakMatch = myLogs.reduce((max, l) => ((l.total_points || 0) > (max.total_points || 0) ? l : max), { total_points: 0 });
  const worstMatch = myLogs.reduce((min, l) => ((l.total_points || 9999) < (min.total_points || 9999) ? l : min), { total_points: 9999 });

  const ranks = rankHistory.map(h => h.rank);
  const highestRank = ranks.length ? Math.min(...ranks) : '--';
  const lowestRank = ranks.length ? Math.max(...ranks) : '--';

  let biggestClimb = 0;
  let biggestFall = 0;
  for (let i = 1; i < rankHistory.length; i++) {
    const diff = rankHistory[i - 1].rank - rankHistory[i].rank;
    if (diff > 0) biggestClimb = Math.max(biggestClimb, diff);
    if (diff < 0) biggestFall = Math.max(biggestFall, Math.abs(diff));
  }

  // Journey Title
  let title = 'The Chase';
  if (scoresArray(myLogs).length >= 4) {
    const scores = scoresArray(myLogs);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const stdDev = Math.sqrt(scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / scores.length);
    const firstHalf = scores.slice(0, Math.floor(scores.length / 2)).reduce((a, b) => a + b, 0);
    const secondHalf = scores.slice(Math.floor(scores.length / 2)).reduce((a, b) => a + b, 0);

    if (secondHalf > firstHalf * 1.45) {
      title = 'The Comeback';
    } else if (stdDev / (mean || 1) > 0.45) {
      title = 'The Rollercoaster';
    } else if (mean > 220) {
      title = 'The Dominance';
    }
  }

  let narrative = '';
  const avgScore = myLogs.length > 0 ? myLogs.reduce((s, l) => s + Number(l.total_points || 0), 0) / myLogs.length : 0;
  const worstScore = worstMatch.total_points || 0;
  
  if (title === 'The Comeback') {
    narrative = `You weren't always on top—but when it mattered, you soared. Your season was a masterclass in momentum, with your second half crushing the first. Late charge dominance.`;
  } else if (title === 'The Rollercoaster') {
    if (avgScore < 150) {
      narrative = `Unpredictability was your curse, not your charm. Wild swings between highs and lows—but mostly lows—left your season chaotic and inconsistent.`;
    } else {
      narrative = `No two matches were alike. Explosive highs met crushing lows, keeping every moment unpredictable. Your season was a wild ride through the BFL landscape.`;
    }
  } else if (title === 'The Dominance') {
    narrative = `Consistency meets excellence. You maintained a relentless scoring pace throughout the season, rarely dipping below peak performance. This was sustained dominance.`;
  } else {
    if (avgScore < 140) {
      narrative = `Your squad was always hunting—but often hunting from the bottom. Constant rank fluctuations with a low average suggest tactical inconsistency throughout the season.`;
    } else if (biggestFall >= 5) {
      narrative = `Your leaderboard journey was marked by sudden collapses. Rank falls of ${biggestFall}+ positions point to critical mid-season errors that derailed your campaign.`;
    } else {
      narrative = `Your squad was always hunting. The leaderboard was your battlefield, and every match brought new tactical battles and rank fluctuations.`;
    }
  }

  return {
    progression: pointsProgression,
    bestMatch: peakMatch.match ? `M${peakMatch.match.match_no} (${Math.round(peakMatch.total_points)} pts)` : '--',
    worstMatch: worstMatch.match ? `M${worstMatch.match.match_no} (${Math.round(worstMatch.total_points)} pts)` : '--',
    rankRange: highestRank !== '--' ? `#${highestRank} to #${lowestRank}` : '--',
    climbFall: `Climb: +${biggestClimb} / Fall: -${biggestFall}`,
    title,
    narrative,
    peakMatchNo: peakMatch.match?.match_no || '--',
    peakMatchPoints: Math.round(peakMatch.total_points || 0)
  };
}

function scoresArray(logs) {
  return logs.map(l => l.total_points || 0);
}

function computeSquadStory(data) {
  // DNA point splits
  const logs = data.pointsLog || [];
  let totBat = 0, totBowl = 0, totFld = 0, totBon = 0;
  
  logs.forEach(l => {
    totBat += Number(l.batting_pts || 0);
    totBowl += Number(l.bowling_pts || 0);
    totFld += Number(l.fielding_pts || 0);
    totBon += Number(l.bonus_pts || 0);
  });

  const totSquad = totBat + totBowl + totFld + totBon || 1;
  const batPct = Math.round((totBat / totSquad) * 100);
  const bowlPct = Math.round((totBowl / totSquad) * 100);
  const fldPct = Math.round((totFld / totSquad) * 100);

  let strength = 'Balanced Unit';
  if (batPct > 45) {
    strength = 'Batting Powerhouse';
  } else if (bowlPct > 45) {
    strength = 'Bowling Factory';
  }

  const coverageScore = Math.max(40, Math.min(100, Math.round(100 - (Math.abs(batPct - 33) + Math.abs(bowlPct - 33) + Math.abs(fldPct - 33)) * 0.85)));
  const coverageLabel = coverageScore >= 80 ? 'Elite coverage across systems' : (coverageScore >= 65 ? 'Strong team balance' : 'Specialist-heavy system');

  // Parse Player Lookup Map
  const playerLookup = {};
  data.allPlayers.forEach(p => { playerLookup[p.id] = p; });

  // Sum runs, wickets, catches for players *while they were in user squad*
  const squadStatsMap = {};
  data.pointsLog.forEach(log => {
    const squadPlayerNames = new Set((log.breakdown?.players || []).map(p => p.effective_name || p.name));
    const matchId = log.match_id;
    
    const statsForMatch = data.allPlayerStats.filter(s => s.match_id === matchId);
    statsForMatch.forEach(s => {
      const player = playerLookup[s.player_id];
      if (!player) return;
      if (squadPlayerNames.has(player.name)) {
        if (!squadStatsMap[player.name]) squadStatsMap[player.name] = { runs: 0, wickets: 0, catches: 0 };
        squadStatsMap[player.name].runs += Number(s.runs || 0);
        squadStatsMap[player.name].wickets += Number(s.wickets || 0);
        squadStatsMap[player.name].catches += Number(s.catches || 0);
      }
    });
  });

  const runsLeader = Object.entries(squadStatsMap).sort((a, b) => b[1].runs - a[1].runs)[0];
  const wicketsLeader = Object.entries(squadStatsMap).sort((a, b) => b[1].wickets - a[1].wickets)[0];
  const catchesLeader = Object.entries(squadStatsMap).sort((a, b) => b[1].catches - a[1].catches)[0];

  let narrative = '';
  if (strength === 'Batting Powerhouse') {
    if (batPct > 55) {
      narrative = `Over-reliance on batting. With ${batPct}% of points from batting, you neglected bowling and fielding. This one-dimensional approach cost you critical matches.`;
    } else {
      narrative = `Your squad was built for explosive firepower. With ${batPct}% of points from batting, every match was about aggressive runs and quick fires. You played the attacking game.`;
    }
  } else if (strength === 'Bowling Factory') {
    if (bowlPct > 55) {
      narrative = `Bowling-only strategy backfired. With ${bowlPct}% of points from bowling, your batting was weak and couldn't chase totals when needed. Defensive bias wasn't enough.`;
    } else {
      narrative = `Defense was your strength. Your bowling-heavy squad (${bowlPct}% of points) relied on wickets and economy. You strangled opponents into submission.`;
    }
  } else {
    if (coverageScore < 50) {
      narrative = `Confused squad composition. Your balance between batting (${batPct}%), bowling (${bowlPct}%), and fielding (${fldPct}%) was neither strategic nor consistent. Poor squad building choices.`;
    } else {
      narrative = `A true all-rounder squad. Balanced across batting (${batPct}%), bowling (${bowlPct}%), and fielding (${fldPct}%), you adapted to every match scenario with tactical precision.`;
    }
  }

  return {
    batPct, bowlPct, fldPct, strength,
    coverageScore,
    coverageLabel,
    narrative,
    runsLeader: runsLeader ? `${runsLeader[0]} (${runsLeader[1].runs} runs)` : '--',
    wicketsLeader: wicketsLeader ? `${wicketsLeader[0]} (${wicketsLeader[1].wickets} wkts)` : '--',
    catchesLeader: catchesLeader ? `${catchesLeader[0]} (${catchesLeader[1].catches} catches)` : '--'
  };
}

function computeCaptainStory(data) {
  const capPlayer = data.squad.find(s => s.is_captain);
  if (!capPlayer) {
    return { name: '--', points: 0, pct: 0, rank: '--', narrative: 'No squad captain designated.' };
  }

  const capName = capPlayer.player?.name || '--';
  const capId = capPlayer.player_id;

  // Calculate Captain points in user squad (weighted by double captaincy multiplier)
  let capPointsInUserTeam = 0;
  data.pointsLog.forEach(log => {
    const players = log.breakdown?.players || [];
    const pRecord = players.find(p => p.name === capName || p.effective_name === capName);
    if (pRecord) {
      capPointsInUserTeam += Number(pRecord.final || 0);
    }
  });

  const totalPoints = data.leaderboard?.total_points || 1;
  const contribPct = Math.round((capPointsInUserTeam / totalPoints) * 100);

  // League-wide Captain points ranking
  const playerPointsMap = {};
  data.allPlayerStats.forEach(s => {
    const pId = s.player_id;
    if (!playerPointsMap[pId]) playerPointsMap[pId] = 0;
    playerPointsMap[pId] += (API.calcBattingPoints(s) + API.calcBowlingPoints(s) + API.calcFieldingPoints(s));
  });

  const captainLeaderboard = data.allCaptains.map(c => {
    const pts = playerPointsMap[c.player_id] || 0;
    return { teamId: c.fantasy_team_id, name: c.player?.name, points: pts };
  }).sort((a, b) => b.points - a.points);

  const myCapIndex = captainLeaderboard.findIndex(c => c.teamId === data.leaderboard.fantasy_team_id);
  const capRank = myCapIndex !== -1 ? (myCapIndex + 1) : '--';

  let narrative = '';
  if (capRank === 1) {
    narrative = `Inspired captain choice. Your selection of ${capName} generated ${Math.round(capPointsInUserTeam)} double-points and ranked #${capRank}—the league's best captaincy decision. Masterclass.`;
  } else if (capRank <= 3) {
    narrative = `An inspired choice. Your captain ${capName} generated ${Math.round(capPointsInUserTeam)} double-points for your squad, ranking #${capRank} among all BFL leaders. Faith rewarded.`;
  } else if (capRank <= 10) {
    narrative = `Solid captain choice. ${capName} contributed ${Math.round(capPointsInUserTeam)} double-points and ranked #${capRank}—respectable, though not exceptional. A reliable pick.`;
  } else if (capRank >= captainLeaderboard.length * 0.75 && capRank !== '--') {
    narrative = `Poor captaincy decision. ${capName} ranked #${capRank} out of ${captainLeaderboard.length} with only ${Math.round(capPointsInUserTeam)} double-points. This was a critical error that cost you dearly.`;
  } else if (capPointsInUserTeam < 50) {
    narrative = `Failed captain gamble. ${capName} generated just ${Math.round(capPointsInUserTeam)} double-points—a major disappointment that cascaded into poor season performance.`;
  } else {
    narrative = `The anchor. ${capName} led your squad through thick and thin, chipping in with ${Math.round(capPointsInUserTeam)} double-points and accounting for ${contribPct}% of your season score.`;
  }

  return { name: capName, points: Math.round(capPointsInUserTeam), pct: contribPct, rank: capRank !== '--' ? `#${capRank}` : '--', narrative };
}

function computeMVPDependency(data) {
  const playerMap = {};
  const playerLookup = {};
  let totalPts = 0;

  (data.allPlayers || []).forEach(p => {
    if (!p || !p.name) return;
    playerLookup[p.name] = p;
    if (p.effective_name) playerLookup[p.effective_name] = p;
  });

  data.pointsLog.forEach(log => {
    const players = log.breakdown?.players || [];
    players.forEach(p => {
      const name = p.name || p.effective_name;
      if (!name) return;
      if (!playerMap[name]) {
        const player = playerLookup[name];
        playerMap[name] = {
          name,
          role: p.role || 'Batter',
          team: p.ipl_team || '--',
          points: 0,
          peak: 0,
          peakMatch: null,
          imageUrl: player?.image_url || null
        };
      }
      const pts = Number(p.final || 0);
      playerMap[name].points += pts;
      totalPts += pts;
      if (pts > playerMap[name].peak) {
        playerMap[name].peak = pts;
        playerMap[name].peakMatch = log.match;
      }
    });
  });

  const mvpList = Object.values(playerMap).sort((a, b) => b.points - a.points);
  if (!mvpList.length) {
    return { name: 'None', role: 'Batter', team: '--', points: 0, pct: 0, bestMatch: '--', narrative: 'No player contributed points.' };
  }

  const mvp = mvpList[0];
  const pct = totalPts > 0 ? Math.round((mvp.points / totalPts) * 100) : 0;
  const bestMatch = mvp.peakMatch ? `M${mvp.peakMatch.match_no} (${Math.round(mvp.peak)} pts)` : '--';

  let narrative = '';
  if (pct >= 30) {
    narrative = `${mvp.name} carried the load—perhaps too much. Representing ${pct}% of your squad output, this ${mvp.role} was your sole lifeline. Without them, your season would have collapsed.`;
  } else if (pct >= 20) {
    narrative = `${mvp.name} was the cornerstone of your squad. Scoring ${Math.round(mvp.points)} points—representing ${pct}% of your total squad output—this ${mvp.role} delivered when it mattered most, peaking with a brilliant ${Math.round(mvp.peak)}-point display.`;
  } else if (pct >= 12) {
    narrative = `${mvp.name} led the charge with ${Math.round(mvp.points)} points (${pct}% of your output). A solid contributor but not a dominant force—your squad had balanced strength.`;
  } else if (mvp.points < 100) {
    narrative = `${mvp.name} was your top performer with only ${Math.round(mvp.points)} points—which tells you something about your squad's overall weakness this season.`;
  } else {
    narrative = `${mvp.name} accumulated ${Math.round(mvp.points)} points, but your squad was spread thin. No single standout performer meant reliance on collective mediocrity.`;
  }

  return { name: mvp.name, role: mvp.role, team: mvp.team, points: Math.round(mvp.points), pct, bestMatch, narrative, imageUrl: mvp.imageUrl };
}

function computePredictionStory(data) {
  const preds = data.predictions || [];
  const total = preds.length;
  if (!total) {
    return { accuracy: '0%', streak: '0', backedTeam: '--', upsetCalled: '--', identity: 'Observer' };
  }

  // Accuracy
  const correct = preds.filter(p => p.predicted_winner === p.match?.winner).length;
  const accuracy = Math.round((correct / total) * 100);

  // Streak
  const sortedPreds = [...preds].sort((a, b) => (a.match?.match_no || 0) - (b.match?.match_no || 0));
  let streak = 0, maxStreak = 0;
  sortedPreds.forEach(p => {
    if (p.predicted_winner === p.match?.winner) {
      streak++;
      maxStreak = Math.max(maxStreak, streak);
    } else {
      streak = 0;
    }
  });

  // Most backed team
  const backCounts = {};
  preds.forEach(p => {
    if (p.predicted_winner) backCounts[p.predicted_winner] = (backCounts[p.predicted_winner] || 0) + 1;
  });
  const topBacked = Object.entries(backCounts).sort((a,b) => b[1] - a[1])[0]?.[0] || '--';

  // Upset called (match correct prediction where winner was the underdog based on opponent higher rank at match date)
  // Fallback: search for correct prediction with target score diff <= 1
  let bestCallText = '--';
  const closeCalls = preds.filter(p => p.predicted_winner === p.match?.winner && p.match?.actual_target && Math.abs(API.getScaledPred(p, p.match) - p.match.actual_target) <= 1);
  if (closeCalls.length) {
    const cMatch = closeCalls[0].match;
    bestCallText = `M${cMatch.match_no} (${UI.tShort(cMatch.team1)} vs ${UI.tShort(cMatch.team2)})`;
  }

  // Identity classification & narrative
  let identity = 'The Risk Taker';
  let narrative = '';
  
  if (accuracy > 75) {
    identity = 'The Oracle';
    narrative = `You didn't just predict matches—you saw the future. With ${accuracy}% accuracy, your crystal ball was eerily accurate. Teams feared your foresight.`;
  } else if (accuracy > 65) {
    identity = 'The Oracle';
    narrative = `Your instincts were remarkably sharp. ${accuracy}% accuracy earned you a reputation as the BFL's prediction sage.`;
  } else if (accuracy > 55) {
    identity = 'The Strategist';
    narrative = `You cracked the code more often than not. ${accuracy}% accuracy shows solid prediction craft across diverse match scenarios.`;
  } else if (preds.length >= 10 && Object.values(backCounts).some(c => c / total >= 0.6)) {
    identity = 'The Loyalist';
    narrative = `You backed ${UI.tShort(topBacked)} through thick and thin. While loyalty is admirable, ${Math.round((Object.values(backCounts)[0] / total) * 100)}% of predictions favoring one team left you exposed to variance.`;
  } else if (closeCalls.length >= 2) {
    identity = 'The Upset Hunter';
    narrative = `Close matches were your playground. You called ${closeCalls.length} nail-biting wins, but missed the obvious ones more often.`;
  } else if (accuracy >= 50) {
    identity = 'The Optimist';
    narrative = `Fifty-fifty odds? You took them all on. At ${accuracy}% accuracy, you were essentially flipping a coin—lucky when it worked, painful when it didn't.`;
  } else if (accuracy >= 40) {
    identity = 'The Contrarian';
    narrative = `Only ${accuracy}% accuracy. Your predictions were often wrong—sometimes it felt like betting against conventional wisdom more than actual insight.`;
  } else {
    identity = 'The Miscalculator';
    narrative = `A dismal ${accuracy}% accuracy. Your predictions were unreliable at best. Consider studying match trends more carefully next season.`;
  }

  return { accuracy: accuracy + '%', streak: maxStreak + ' matches', backedTeam: topBacked !== '--' ? UI.tShort(topBacked) : '--', upsetCalled: bestCallText, identity, narrative };
}

function computeTeamReportCard(data, squadDNA, predStory) {
  const myTeamId = data.leaderboard.fantasy_team_id;

  // Aggregate league points by category: Squad points should exclude predictions and bonus; batting/bowling/fielding are squad subcomponents.
  const categorySums = {}; // team_id -> { squad, batting, bowling, fielding, prediction }
  data.allPointsLogs.forEach(l => {
    const tid = l.fantasy_team_id;
    if (!categorySums[tid]) categorySums[tid] = { squad: 0, batting: 0, bowling: 0, fielding: 0, prediction: 0 };
    categorySums[tid].squad += Number(l.squad_points || 0);
    categorySums[tid].batting += Number(l.batting_pts || 0);
    categorySums[tid].bowling += Number(l.bowling_pts || 0);
    categorySums[tid].fielding += Number(l.fielding_pts || 0);
    categorySums[tid].prediction += Number(l.prediction_points || 0);
  });

  const getRankAndGrade = (categoryKey) => {
    const sorted = Object.entries(categorySums)
      .map(([id, stats]) => ({ id, value: stats[categoryKey] }))
      .sort((a, b) => b.value - a.value);
    const index = sorted.findIndex(s => s.id === myTeamId);
    const rank = index !== -1 ? (index + 1) : 999;
    const total = sorted.length || 1;

    let grade = 'B';
    let label = `Rank #${rank}`;

    if (rank === 1) {
      grade = 'A+';
      label = 'League Best (#1)';
    } else if (rank <= 3) {
      grade = 'A';
      label = `Top 3 (#${rank})`;
    } else if (rank >= total - 2) {
      grade = 'D';
      label = `Bottom 3 (#${rank})`;
    } else {
      label = 'Mid-table';
    }

    const isHighlight = rank <= 3 || rank >= total - 2;
    return { rankLabel: label, grade, isHighlight };
  };

  const reportCards = [
    { name: 'Overall Squad Performance', ...getRankAndGrade('squad') },
    { name: 'Batting Performance', ...getRankAndGrade('batting') },
    { name: 'Bowling Performance', ...getRankAndGrade('bowling') },
    { name: 'Fielding Performance', ...getRankAndGrade('fielding') },
    { name: 'Predictions Performance', ...getRankAndGrade('prediction') }
  ];

  // Add narratives to each report card based on rank
  reportCards.forEach(card => {
    let narrative = '';
    if (card.rankLabel.includes('League Best')) {
      narrative = 'You dominated this category—simply unbeatable.';
    } else if (card.rankLabel.includes('Top 3')) {
      narrative = 'Elite territory. You ranked among the league\'s finest in this domain.';
    } else if (card.rankLabel.includes('Bottom 3')) {
      narrative = 'Room for improvement here—this was your weak point this season.';
    } else if (card.rankLabel.includes('Mid-table')) {
      narrative = 'Solid middle ground. You competed fairly but had peaks and valleys.';
    }
    card.narrative = narrative;
  });

  return reportCards;
}

function computeRecordsAchievements(data, journey, squadDNA, predStory) {
  const badges = data.badges || [];
  const myTeamId = data.leaderboard.fantasy_team_id;

  // League-wide max match score search
  const allLogs = data.allPointsLogs || [];
  const maxScoreInLeague = allLogs.reduce((max, l) => Math.max(max, l.total_points || 0), 0);
  const myLogs = data.pointsLog || [];
  const myMaxScore = myLogs.reduce((max, l) => Math.max(max, l.total_points || 0), 0);

  const candidateAchievements = [
    {
      id: 'high-scorer',
      earned: myMaxScore >= maxScoreInLeague && myMaxScore > 0,
      icon: '🔥',
      title: 'Apex Score',
      desc: 'Held the single highest match score in the entire BFL league.',
      concern: {
        icon: '📉',
        title: 'Low Peak Score',
        desc: `Your best match was only ${myMaxScore} points—weak for league competition.`
      }
    },
    {
      id: 'prediction-maestro',
      earned: parseInt(predStory.streak) >= 5,
      icon: '🧠',
      title: 'Pred Master',
      desc: 'Nailed 5+ correct winner predictions in a row.',
      concern: {
        icon: '🎲',
        title: 'Prediction Struggles',
        desc: `Highest streak was only ${predStory.streak}—struggled with consistency.`
      }
    },
    {
      id: 'bowling-dominator',
      earned: squadDNA.bowlPct >= 45,
      icon: '🏰',
      title: 'Wicket Warden',
      desc: 'Maintained a defensive bowling-heavy squad roster.',
      concern: {
        icon: '🏏',
        title: 'Bowling Neglect',
        desc: `Only ${squadDNA.bowlPct}% of points from bowling—defensive weakness.`
      }
    },
    {
      id: 'run-machine',
      earned: squadDNA.batPct >= 45,
      icon: '💥',
      title: 'Run Machine',
      desc: 'Prioritized heavy batting lineups generating explosive runs.',
      concern: {
        icon: '🔄',
        title: 'Batting Weakness',
        desc: `Only ${squadDNA.batPct}% of points from batting—weak batting selection.`
      }
    },
    {
      id: 'comeback-king',
      earned: badges.some(b => b.badge_id === 'comeback_kid') || journey.climbFall.includes('Climb: +3') || journey.climbFall.includes('Climb: +4'),
      icon: '📈',
      title: 'Comeback Kid',
      desc: 'Registered a massive climb up the leaderboard ranks.',
      concern: {
        icon: '📉',
        title: 'Consistent Decline',
        desc: `Your biggest rank drop was -${journey.climbFall.match(/Fall: -(\d+)/)?.[1] || '2'} positions—poor recovery.`
      }
    }
  ];

  // Filter to show earned ones. Always show at least 2 entries (earned or concerns)
  let earned = candidateAchievements.filter(c => c.earned);
  let notEarned = candidateAchievements.filter(c => !c.earned);
  
  if (earned.length >= 2) {
    return earned.slice(0, 5);
  } else if (earned.length === 1) {
    return [earned[0], notEarned[0]];
  } else {
    // No achievements earned—show top 2 concerns
    return notEarned.slice(0, 2).map(item => ({
      id: item.id,
      icon: item.concern.icon,
      title: item.concern.title,
      desc: item.concern.desc,
      isWarning: true
    }));
  }
}

function computeUnexpectedTruth(data, squadDNA, mvp, captain) {
  const logs = data.pointsLog || [];
  let totBat = 0, totBowl = 0;
  logs.forEach(l => {
    totBat += Number(l.batting_pts || 0);
    totBowl += Number(l.bowling_pts || 0);
  });

  const candidates = [];

  // Candidate 1: Bowlers outscoring batters
  if (totBowl > totBat * 1.1) {
    candidates.push({
      icon: '🛡️',
      statement: `Bowlers Rule. Your bowling attack generated ${Math.round(totBowl - totBat)} more points than your batting lineup. Stifling the opposition saved your season.`
    });
  }

  // Candidate 2: Captain outperforming MVP expectation (Captain was better choice)
  if (captain.points > mvp.points) {
    candidates.push({
      icon: '👑',
      statement: `Masterful Leadership. Your Captain, ${captain.name}, outscored your MVP, ${mvp.name}, delivering ${captain.points} total captaincy points. The smart choice rewarded.`
    });
  }

  // Candidate 3: High MVP points share (over-reliance on single player)
  if (mvp.pct >= 24) {
    candidates.push({
      icon: '🏋️‍♂️',
      statement: `The Carrier. A single player, ${mvp.name}, carried ${mvp.pct}% of your squad's season points. One man show—sometimes genius, sometimes risky.`
    });
  } else if (mvp.pct >= 15) {
    candidates.push({
      icon: '⭐',
      statement: `Star Power. ${mvp.name} was your leading light, delivering ${mvp.pct}% of total squad output—a significant but sustainable contribution.`
    });
  }

  // Candidate 4: Team representation concentration
  const squadTeams = {};
  data.squad.forEach(sp => {
    if (sp.player?.ipl_team) squadTeams[sp.player.ipl_team] = (squadTeams[sp.player.ipl_team] || 0) + 1;
  });
  const topSquadTeamEntry = Object.entries(squadTeams).sort((a,b) => b[1] - a[1])[0];
  if (topSquadTeamEntry && topSquadTeamEntry[1] >= 4) {
    const pct = Math.round((topSquadTeamEntry[1] / data.squad.length) * 100);
    candidates.push({
      icon: '🚩',
      statement: `Franchise Bias. Players from ${UI.tShort(topSquadTeamEntry[0])} occupied ${pct}% of your squad roster slots. Loyalty runs deep—sometimes dangerously so.`
    });
  }

  // Candidate 5: Fielding dominance (if available)
  let totFld = 0;
  logs.forEach(l => {
    totFld += Number(l.fielding_pts || 0);
  });
  if (totFld > totBat * 0.5) {
    candidates.push({
      icon: '🧤',
      statement: `Fielding Factor. Your fielders contributed significantly to the match total, proving that catches and ground fielding weren't overlooked in your strategy.`
    });
  }

  // Pick the first insight from candidates, fallback to prediction accuracy
  return candidates.length ? candidates[0] : {
    icon: '🔮',
    statement: `Predictions Anchor. In a season of squad fluctuations, your balanced approach and prediction decisions kept your leaderboard rank stable and competitive.`
  };
}

function computeLegacy(data, journey, captain, mvp) {
  const rank = data.leaderboard?.rank || 999;
  const totalPoints = data.leaderboard?.total_points || 0;
  const totalTeams = data.totalTeams || 1;
  let archetype = 'The Seasoned Tactician';
  let icon = '🛡️';
  let legacyText = '';

  if (rank <= 3) {
    archetype = 'The Champion Legend';
    icon = '👑';
    legacyText = `Elite tier reached. Your championship-caliber campaign—powered by ${mvp.name}'s ${mvp.points} points and ${captain.name}'s captaincy—culminated in a podium finish at Rank #${rank}. History made.`;
  } else if (rank <= 5) {
    archetype = 'The Ascendant Master';
    icon = '📈';
    legacyText = `You finished just outside the podium. With ${totalPoints} points across the season, your tactical acumen kept you competitive against ${totalTeams - 1} rivals. A campaign worthy of respect.`;
  } else if (rank <= totalTeams / 3) {
    archetype = 'The Mid-Tier Contender';
    icon = '⚔️';
    legacyText = `Respectable middle-ground performance. Rank #${rank} places you in the upper-middle tier. Your season had merits—solid squad management and strategic moments—but lacked the spark for a deep playoff run.`;
  } else if (data.leaderboard?.max_correct_pred >= 6) {
    archetype = 'The Oracle';
    icon = '🔮';
    legacyText = `Your prediction mastery was your salvation. While the squad struggled (Rank #${rank}), your forecasting consistency kept you afloat—proving that vision can compensate for squad blunders.`;
  } else if (journey.title === 'The Comeback' && rank <= totalTeams / 2) {
    archetype = 'The Comeback Architect';
    icon = '📈';
    legacyText = `From the brink to mid-table. Your second-half surge transformed ${journey.bestMatch} into your flagship moment, rescuing your campaign from early collapse to Rank #${rank}.`;
  } else if (totalPoints > 500) {
    archetype = 'The Accumulator';
    icon = '💰';
    legacyText = `Consistency across the board. You amassed ${totalPoints} points through steady decision-making, finishing Rank #${rank}. Not flashy, but reliable.`;
  } else if (rank >= totalTeams * 0.75) {
    archetype = 'The Struggling Manager';
    icon = '📉';
    legacyText = `A difficult season. Rank #${rank} with only ${totalPoints} points indicates fundamental issues—poor squad selections, weak captain choice (${captain.name} underperformed), and inconsistent predictions. Next season demands a fresh approach.`;
  } else if (rank >= totalTeams * 0.5) {
    archetype = 'The Learning Experience';
    icon = '🎓';
    legacyText = `Below-average finish at Rank #${rank}. Your season was marked by tactical errors and missed opportunities. This is a valuable learning year—study what went wrong and adjust your strategy.`;
  } else {
    archetype = 'The Seasoned Tactician';
    legacyText = `Your campaign was defined by tactical choices and strategic depth. Though Rank #${rank} may not have been your dream finish, you competed with heart. Room for improvement, but the foundation is there.`;
  }

  return { archetype, icon, legacyText };
}

// 3. Render Functions

function renderJourneySlide(journey) {
  document.getElementById('journey-best-match').textContent = journey.bestMatch;
  document.getElementById('journey-worst-match').textContent = journey.worstMatch;
  document.getElementById('journey-rank-range').textContent = journey.rankRange;
  document.getElementById('journey-climb-fall').textContent = journey.climbFall;
  
  const narrativeEl = document.getElementById('journey-narrative');
  if (narrativeEl) {
    narrativeEl.textContent = journey.narrative || '';
  }

  setTimeout(() => {
    UI.drawLineChart('chart-journey-line', journey.progression, {
      color: '#38d9f5',
      bgColor: 'transparent',
      showValues: false,
      pad: { top: 15, right: 10, bottom: 20, left: 30 }
    });
  }, 100);
}

function renderSquadStorySlide(squadStory) {
  document.getElementById('squad-runs-leader').textContent = squadStory.runsLeader;
  document.getElementById('squad-wickets-leader').textContent = squadStory.wicketsLeader;
  document.getElementById('squad-catches-leader').textContent = squadStory.catchesLeader;
  document.getElementById('squad-coverage-score').textContent = squadStory.coverageScore + '%';
  document.getElementById('squad-coverage-status').textContent = squadStory.coverageLabel;
  
  const narrativeEl = document.getElementById('squad-narrative');
  if (narrativeEl) {
    narrativeEl.textContent = squadStory.narrative || '';
  }

  const slices = [
    { label: 'Batting', value: squadStory.batPct, color: '#f87171' },
    { label: 'Bowling', value: squadStory.bowlPct, color: '#60a5fa' },
    { label: 'Fielding', value: squadStory.fldPct, color: '#34d399' }
  ];

  setTimeout(() => {
    UI.drawDonutChart('chart-squad-dna-donut', slices, {
      size: 110,
      centerLabel: 'DNA',
      bgColor: '#12141d'
    });
  }, 100);

  const container = document.getElementById('dna-legend-container');
  container.innerHTML = slices.map(s => `
    <div class="legend-item" style="color:${s.color};" align="center">
      <span class="legend-dot" style="background:${s.color};"></span>
      <span>${s.label}: <strong>${s.value}%</strong></span>
    </div>
  `).join('');
}

function renderCaptainSlide(captainStory) {
  document.getElementById('captain-name').textContent = captainStory.name;
  document.getElementById('captain-points').textContent = captainStory.points + ' pts';
  document.getElementById('captain-contrib-pct').textContent = captainStory.pct + '%';
  document.getElementById('captain-league-rank').textContent = captainStory.rank;
  document.getElementById('captain-narrative').textContent = captainStory.narrative;
}

function renderMVPSlide(mvpStory) {
  document.getElementById('mvp-player-name').textContent = mvpStory.name;
  document.getElementById('mvp-player-team').textContent = mvpStory.team;
  document.getElementById('mvp-player-role').textContent = mvpStory.role;
  document.getElementById('mvp-total-pts').textContent = mvpStory.points + ' pts';
  document.getElementById('mvp-contribution-pct').textContent = mvpStory.pct + '%';
  document.getElementById('mvp-best-match').textContent = mvpStory.bestMatch || '--';
  document.getElementById('mvp-narrative').textContent = mvpStory.narrative;

  const img = document.getElementById('mvp-player-img');
  img.src = mvpStory.imageUrl || 'images/players/placeholder.png';
  img.onerror = () => {
    img.src = 'images/bfl/bfl-logo.png';
  };
}

function renderPredictionSlide(predStory) {
  document.getElementById('pred-identity').textContent = predStory.identity;
  document.getElementById('pred-accuracy').textContent = predStory.accuracy;
  document.getElementById('pred-streak').textContent = predStory.streak;
  document.getElementById('pred-backed-team').textContent = predStory.backedTeam;
  document.getElementById('pred-upset-called').textContent = predStory.upsetCalled;
  
  const narrativeEl = document.getElementById('pred-narrative');
  if (narrativeEl) {
    narrativeEl.textContent = predStory.narrative || '';
  }
}

function renderReportCardSlide(reportCard) {
  const container = document.getElementById('report-card-container');
  container.innerHTML = reportCard.map(rc => {
    const tierClass = rc.grade.startsWith('A') ? 'top-tier' : (rc.grade.startsWith('D') ? 'bottom-tier' : '');
    const dispVal = rc.isHighlight ? rc.rankLabel : 'Mid-table';
    return `
      <div class="report-item">
        <div class="report-top-row">
          <span class="report-label">${rc.name}</span>
          <div class="report-value-wrap">
            <span class="report-rank-text" style="color: ${tierClass === 'top-tier' ? '#34d399' : tierClass === 'bottom-tier' ? '#f87171' : '#9ca3af'};">${dispVal}</span>
            <span class="report-grade ${tierClass}">${rc.grade}</span>
          </div>
        </div>
        <div class="report-narrative">${rc.narrative || ''}</div>
      </div>
    `;
  }).join('');
}

function renderAchievementsSlide(achievements) {
  const container = document.getElementById('records-grid');
  container.innerHTML = achievements.map(ac => `
    <div class="record-badge-card${ac.isWarning ? ' warning-badge' : ''}">
      <span class="record-badge-icon">${ac.icon}</span>
      <span class="record-badge-title">${ac.title}</span>
      <span class="record-badge-desc">${ac.desc}</span>
    </div>
  `).join('');
}

function renderTruthSlide(truth) {
  document.querySelector('.truth-icon').textContent = truth.icon;
  document.getElementById('truth-statement-text').textContent = truth.statement;
}

function renderVerdictSlide(data) {
  const totalPoints = Math.round(data.leaderboard?.total_points || 0);
  const rank = data.leaderboard?.rank || '--';
  const total = data.totalTeams || 1;
  const pct = Math.max(1, Math.round((1 - (rank - 1) / total) * 100));

  UI.countUp(document.getElementById('verdict-points-count'), totalPoints, 1200);
  document.getElementById('verdict-rank-num').textContent = rank;
  document.getElementById('verdict-percentile-label').textContent = `Outperformed ${pct}% of team managers.`;
}

function renderLegacySlide(legacy) {
  document.getElementById('final-team-name').textContent = _wrappedData.leaderboard?.team?.team_name || 'Your Team';
  document.getElementById('legacy-archetype-icon').textContent = legacy.icon;
  document.getElementById('legacy-archetype-title').textContent = legacy.archetype;
  document.getElementById('legacy-statement-text').textContent = legacy.legacyText;
}

// 4. Slide Navigation Controller
function buildProgressBars() {
  const container = document.getElementById('wrapped-progress');
  container.innerHTML = Array.from({ length: _totalSlides }).map((_, i) => `
    <div class="wrapped-progress-bar">
      <div class="wrapped-progress-fill" id="fill-${i}"></div>
    </div>
  `).join('');
}

function showSlide(index) {
  document.querySelectorAll('.slide').forEach(s => s.classList.remove('active'));
  
  const target = document.getElementById(`slide-${index}`);
  if (target) target.classList.add('active');

  for (let i = 0; i < _totalSlides; i++) {
    const fill = document.getElementById(`fill-${i}`);
    if (!fill) continue;
    if (i < index) {
      fill.className = 'wrapped-progress-fill completed';
      fill.style.width = '100%';
    } else if (i === index) {
      fill.className = 'wrapped-progress-fill';
      fill.style.width = '0%';
    } else {
      fill.className = 'wrapped-progress-fill';
      fill.style.width = '0%';
    }
  }

  _currentSlide = index;
  _progressElapsed = 0;
}

function prevSlide() {
  if (_currentSlide > 0) {
    showSlide(_currentSlide - 1);
  } else {
    window.location.href = 'dashboard.html';
  }
}

function nextSlide() {
  if (_currentSlide < _totalSlides - 1) {
    showSlide(_currentSlide + 1);
  } else {
    window.location.href = 'dashboard.html';
  }
}

// 5. Timer Progression
function startSlideTimer() {
  if (_slideInterval) clearInterval(_slideInterval);
  
  _slideInterval = setInterval(() => {
    if (_isPaused) return;

    _progressElapsed += 100;
    const fill = document.getElementById(`fill-${_currentSlide}`);
    if (fill) {
      const pct = Math.min(100, (_progressElapsed / _slideDuration) * 100);
      fill.style.width = pct + '%';
    }

    if (_progressElapsed >= _slideDuration) {
      nextSlide();
    }
  }, 100);
}

function pauseTimer() {
  _isPaused = true;
  updatePauseButton();
}

function resumeTimer() {
  _isPaused = false;
  updatePauseButton();
}

function togglePause() {
  _isPaused = !_isPaused;
  updatePauseButton();
}

function updatePauseButton() {
  const btn = document.getElementById('wrapped-pause-btn');
  if (!btn) return;
  if (_isPaused) {
    btn.innerHTML = '<span>Resume</span>';
    btn.classList.add('paused');
  } else {
    btn.innerHTML = '<span>Pause</span>';
    btn.classList.remove('paused');
  }
}

// 6. Navigation Event Listeners
function bindNavEvents() {
  document.getElementById('wrapped-pause-btn')?.addEventListener('click', togglePause);

  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') {
      nextSlide();
    } else if (e.key === 'ArrowLeft') {
      prevSlide();
    } else if (e.key === ' ') {
      e.preventDefault();
      togglePause();
    }
  });

  // Touch Swipe listeners (Mobile)
  let touchStartX = 0;
  let touchEndX = 0;
  const wrap = document.getElementById('story-wrap');

  wrap.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
    pauseTimer();
  }, { passive: true });

  wrap.addEventListener('touchend', e => {
    touchEndX = e.changedTouches[0].screenX;
    resumeTimer();
    handleSwipe();
  }, { passive: true });

  function handleSwipe() {
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    }
  }

  wrap.addEventListener('mousedown', () => pauseTimer());
  wrap.addEventListener('mouseup', () => resumeTimer());
}

// 7. Clipboard Sharing
// Kick off
document.addEventListener('DOMContentLoaded', initWrapped);
