// ─────────────────────────────────────────────────────────────
//  api.js — BFL Fantasy IPL 2026 v2
//  Full data layer: matches, squads, predictions, analytics,
//  blogs, badges, recalculation, match center
// ─────────────────────────────────────────────────────────────

const API = {

  // ════════════════════════════════════════════════════════════
  //  SQUADS
  // ════════════════════════════════════════════════════════════
  async fetchSquad(teamId) {
    const { data, error } = await sb.from('squad_players')
      .select('id,is_captain,is_vc,player:players(id,name,ipl_team,role,image_url,is_overseas)')
      .eq('fantasy_team_id', teamId).order('is_captain', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async fetchAllPlayers() {
    const { data, error } = await sb.from('players')
      .select('id,name,ipl_team,role,image_url,is_overseas').order('name');
    if (error) throw error;
    return data || [];
  },

  // ════════════════════════════════════════════════════════════
  //  MATCHES — deadline aware
  // ════════════════════════════════════════════════════════════
  async fetchMatches({ upcoming = false, limit = 74, status = null } = {}) {
    let q = sb.from('matches').select('*').order('match_no',{ascending:true}).limit(limit);
    if (upcoming) q = q.eq('is_locked',false).gte('match_date',new Date().toISOString());
    if (status)   q = q.eq('status',status);
    const { data, error } = await q;
    if (error) throw error;
    const now = Date.now();
    return (data||[]).map(m => {
      if (!m.is_locked && m.deadline_time && new Date(m.deadline_time).getTime() <= now)
        return { ...m, _client_locked: true };
      return m;
    });
  },

  async fetchMatch(matchId) {
    const { data, error } = await sb.from('matches').select('*').eq('id',matchId).maybeSingle();
    if (error) throw error;
    return data;
  },

  async upsertMatch(match) {
    if (!match.deadline_time && match.match_date) {
      const d = new Date(match.match_date);
      d.setMinutes(d.getMinutes() - (match.auto_lock_mins || 15));
      match.deadline_time = d.toISOString();
    }
    const { data, error } = await sb.from('matches').upsert(match,{onConflict:'id'}).select().single();
    if (error) throw error;
    return data;
  },

  async lockMatch(matchId) {
    const { error } = await sb.from('matches').update({is_locked:true,status:'locked'}).eq('id',matchId);
    if (error) throw error;
  },

  isMatchOpen(match) {
    if (!match) return false;
    if (match.is_locked || match._client_locked) return false;
    if (match.deadline_time && new Date(match.deadline_time) <= new Date()) return false;
    return true;
  },

  secondsToDeadline(match) {
    if (!match?.deadline_time) return null;
    return Math.floor((new Date(match.deadline_time) - new Date()) / 1000);
  },

  async serverAutoLock() {
    try { await sb.rpc('lock_due_matches'); } catch(_) {}
  },

  // ════════════════════════════════════════════════════════════
  //  PREDICTIONS
  // ════════════════════════════════════════════════════════════
  async fetchPrediction(matchId, teamId) {
    const { data, error } = await sb.from('predictions')
      .select('*,impact_player:players!predictions_impact_player_id_fkey(id,name,role)')
      .eq('match_id',matchId).eq('fantasy_team_id',teamId).maybeSingle();
    if (error) throw error;
    return data;
  },

  async fetchAllPredictions(matchId) {
    const { data, error } = await sb.from('predictions')
      .select('*,team:fantasy_teams(team_name),impact_player:players!predictions_impact_player_id_fkey(name)')
      .eq('match_id',matchId);
    if (error) throw error;
    return data || [];
  },

  async submitPrediction({ matchId, teamId, targetScore, winner }, match) {
    if (match && !this.isMatchOpen(match)) throw new Error('Predictions are locked for this match');
    const { data, error } = await sb.from('predictions').upsert({
      match_id:matchId, fantasy_team_id:teamId,
      target_score:targetScore, predicted_winner:winner,
      submitted_at: new Date().toISOString(),
    },{onConflict:'match_id,fantasy_team_id'}).select().single();
    if (error) throw error;
    return data;
  },

  async fetchMyPredictions(teamId) {
    const { data, error } = await sb.from('predictions')
      .select('*,match:matches(id,match_title,team1,team2,actual_target,winner,match_date,status,match_no)')
      .eq('fantasy_team_id',teamId).order('submitted_at',{ascending:true});
    if (error) throw error;
    return data || [];
  },

  // ════════════════════════════════════════════════════════════
  //  IMPACT PLAYER
  // ════════════════════════════════════════════════════════════
  async fetchImpactUsage(teamId) {
    const { data, error } = await sb.from('impact_usage')
      .select('id,match_id,player_id,used,created_at,player:players(name,role,ipl_team),match:matches(match_title)')
      .eq('fantasy_team_id',teamId).eq('used',true).order('created_at',{ascending:false});
    if (error) throw error;
    return data || [];
  },

  async fetchImpactCount(teamId) {
    const { count, error } = await sb.from('impact_usage')
      .select('id',{count:'exact',head:true}).eq('fantasy_team_id',teamId).eq('used',true);
    if (error) throw error;
    return count || 0;
  },

  async fetchImpactForMatch(teamId, matchId) {
    const { data, error } = await sb.from('impact_usage')
      .select('*,player:players(id,name,role,ipl_team)').eq('fantasy_team_id',teamId).eq('match_id',matchId).maybeSingle();
    if (error) throw error;
    return data;
  },

  validateImpactPlayer(squad, playerId, usageCount) {
    if (usageCount >= 8) return { valid:false, error:'Impact Player limit reached (8/8 used)' };
    const sp = squad.find(s => s.player?.id === playerId);
    if (!sp)           return { valid:false, error:'Player not in your squad' };
    if (sp.is_captain) return { valid:false, error:'Captain cannot be Impact Player (2× already applied)' };
    if (sp.is_vc)      return { valid:false, error:'Vice Captain cannot be Impact Player (1.5× already applied)' };
    return { valid:true, error:null };
  },

  async submitImpactPlayer(teamId, matchId, playerId) {
    const [squad, count] = await Promise.all([this.fetchSquad(teamId), this.fetchImpactCount(teamId)]);
    const check = this.validateImpactPlayer(squad, playerId, count);
    if (!check.valid) throw new Error(check.error);
    const { data, error } = await sb.rpc('submit_impact_player',{p_team_id:teamId,p_match_id:matchId,p_player_id:playerId});
    if (error) throw new Error(error.message);
    if (data && !data.success) throw new Error(data.error || 'Server rejected impact player');
    return data;
  },

  // ════════════════════════════════════════════════════════════
  //  PLAYER STATS
  // ════════════════════════════════════════════════════════════
  async fetchPlayerStats(matchId) {
    const { data, error } = await sb.from('player_match_stats')
      .select('*,player:players(id,name,role,ipl_team)').eq('match_id',matchId);
    if (error) throw error;
    return data || [];
  },

  async upsertPlayerStats(stats) {
    const { data, error } = await sb.from('player_match_stats')
      .upsert(stats,{onConflict:'match_id,player_id'}).select();
    if (error) throw error;
    return data;
  },

  async bulkUpsertPlayerStats(statsArray) {
    const { data, error } = await sb.from('player_match_stats')
      .upsert(statsArray,{onConflict:'match_id,player_id'});
    if (error) throw error;
    return data;
  },

  // Parse CSV text → array of stat objects
  parseStatsCsv(csvText, matchId) {
    const lines = csvText.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) throw new Error('CSV must have header + data rows');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g,'_'));
    return lines.slice(1).map(line => {
      const vals = line.split(',');
      const obj  = { match_id: matchId };
      headers.forEach((h,i) => {
        const v = vals[i]?.trim() || '';
        obj[h]  = (h==='player_id'||h==='match_id') ? v : (isNaN(Number(v)) ? v : Number(v)||0);
      });
      return obj;
    });
  },

  // ════════════════════════════════════════════════════════════
  //  LEADERBOARD
  // ════════════════════════════════════════════════════════════
  async fetchLeaderboard() {
    const { data, error } = await sb.from('leaderboard')
      .select('*,team:fantasy_teams(team_name,owner_name)').order('total_points',{ascending:false});
    if (error) throw error;
    return (data||[]).map((row,i) => ({...row, rank:i+1}));
  },

  async fetchPointsBreakdown(teamId) {
    const { data, error } = await sb.from('points_log')
      .select('*,match:matches(id,match_title,match_date,team1,team2,winner,actual_target,status,match_no)')
      .eq('fantasy_team_id',teamId).order('created_at',{ascending:true});
    if (error) throw error;
    return data || [];
  },

  async fetchMatchLeaderboard(matchId) {
    const { data, error } = await sb.from('points_log')
      .select('*,team:fantasy_teams(team_name)').eq('match_id',matchId).order('total_points',{ascending:false});
    if (error) throw error;
    return (data||[]).map((r,i) => ({...r, match_rank:i+1}));
  },

  async refreshLeaderboard() {
    const { data:logs, error:le } = await sb.from('points_log').select('fantasy_team_id,total_points');
    if (le) throw le;
    const agg = {};
    (logs||[]).forEach(r => {
      if (!agg[r.fantasy_team_id]) agg[r.fantasy_team_id] = {total_points:0,matches_played:0};
      agg[r.fantasy_team_id].total_points   += Number(r.total_points||0);
      agg[r.fantasy_team_id].matches_played += 1;
    });
    const rows = Object.entries(agg).map(([id,v]) => ({
      fantasy_team_id:id, total_points:v.total_points,
      matches_played:v.matches_played, updated_at:new Date().toISOString(),
    }));
    if (!rows.length) return;
    const { error } = await sb.from('leaderboard').upsert(rows,{onConflict:'fantasy_team_id'});
    if (error) throw error;
  },

  // ════════════════════════════════════════════════════════════
  //  RECALCULATION ENGINE
  // ════════════════════════════════════════════════════════════
  async recalculateMatch(matchId, onLog) {
    onLog?.('Deleting existing points for this match…');
    const { error: delErr } = await sb.from('points_log').delete().eq('match_id',matchId);
    if (delErr) throw delErr;
    onLog?.('Recalculating player points…');
    const result = await this.calculateMatchPoints(matchId, onLog);
    try { await sb.rpc('refresh_match_center',{p_match_id:matchId}); } catch(_) {}
    onLog?.('Done! Leaderboard refreshed.','good');
    return result;
  },

  // ════════════════════════════════════════════════════════════
  //  POINTS ENGINE
  // ════════════════════════════════════════════════════════════
  calcBattingPoints(s) {
    if (!s) return 0;
    let pts = 0;
    const runs = Number(s.runs||0), balls = Number(s.balls_faced||0);
    pts += runs;
    if      (runs>=150) pts+=300; else if (runs>=100) pts+=200;
    else if (runs>=50)  pts+=100; else if (runs>=25)  pts+=50;
    if ((Number(s.fours||0)+Number(s.sixes||0))>=10) pts+=100;
    if (balls>=10 && (runs/balls)*100>=200) pts+=100;
    if (balls>=60) pts+=100;
    if (!s.not_out) { if (runs===0) pts-=25; else if (runs<10) pts-=10; }
    if (s.not_out)  pts+=25;
    return Math.max(0,pts);
  },

  calcBowlingPoints(s) {
    if (!s) return 0;
    let pts = 0;
    const wickets=Number(s.wickets||0), overs=Number(s.overs_bowled||0), runs=Number(s.runs_conceded||0);
    pts += wickets*50;
    if (wickets>=9) pts+=400; else if (wickets>=7) pts+=300;
    else if (wickets>=5) pts+=200; else if (wickets>=3) pts+=100;
    pts += Number(s.maidens||0)*50;
    if (overs>=1) { const eco=runs/overs; if(eco<=5) pts+=100; if(eco>=10) pts-=50; }
    if (overs>=2 && wickets===0) pts-=25;
    return Math.max(0,pts);
  },

  calcFieldingPoints(s) {
    if (!s) return 0;
    let pts = 0;
    const catches = Number(s.catches||0);
    pts += catches*25 + Number(s.run_outs||0)*50 + Number(s.stumpings||0)*50;
    if (catches>=3) pts+=50;
    return pts;
  },

  calcBonusPoints(s, match) {
    let pts = 0;
    if (match?.player_of_match === s.player_id) pts+=100;
    if (s.player_of_series) pts+=500;
    return pts;
  },

  calcPredictionPoints(pred, match) {
    if (!pred||!match) return 0;
    let pts = 0;
    const diff = Math.abs(Number(pred.target_score||0)-Number(match.actual_target||0));
    if (diff===0) pts+=250; else if (diff===1) pts+=150;
    else if (diff<=5) pts+=100; else if (diff<=10) pts+=50;
    if (pred.predicted_winner===match.winner) pts+=25;
    return pts;
  },

  resolveMultiplier(squadPlayer, impactPlayerId) {
    const pid = squadPlayer.player?.id;
    if (impactPlayerId && pid===impactPlayerId) return {multiplier:3,   label:'⚡ 3× Impact'};
    if (squadPlayer.is_captain)                 return {multiplier:2,   label:'👑 2× C'};
    if (squadPlayer.is_vc)                      return {multiplier:1.5, label:'⭐ 1.5× VC'};
    return {multiplier:1,label:''};
  },

  async calculateMatchPoints(matchId, onLog) {
    const [match, allStats, allPredictions] = await Promise.all([
      this.fetchMatch(matchId), this.fetchPlayerStats(matchId), this.fetchAllPredictions(matchId),
    ]);
    if (!match) throw new Error('Match not found');
    const { data:teams, error:te } = await sb.from('fantasy_teams').select('id,team_name');
    if (te) throw te;
    const statMap={}, predMap={};
    allStats.forEach(s => { statMap[s.player_id]=s; });
    allPredictions.forEach(p => { predMap[p.fantasy_team_id]=p; });
    const { data:impactRows } = await sb.from('impact_usage')
      .select('fantasy_team_id,player_id').eq('match_id',matchId).eq('used',true);
    const impactMap={};
    (impactRows||[]).forEach(r => { impactMap[r.fantasy_team_id]=r.player_id; });

    const logs = [];
    for (const team of (teams||[])) {
      const squadRows      = await this.fetchSquad(team.id);
      const pred           = predMap[team.id]||null;
      const impactPlayerId = impactMap[team.id]||null;
      let squadPts=0,batPts=0,bowlPts=0,fldPts=0,bonPts=0;
      const breakdown={players:[],impactPlayerId};

      for (const sp of squadRows) {
        const pid=sp.player?.id, stats=statMap[pid];
        if (!stats) continue;
        const bat=this.calcBattingPoints(stats), bowl=this.calcBowlingPoints(stats);
        const fld=this.calcFieldingPoints(stats), bon=this.calcBonusPoints(stats,match);
        const base=bat+bowl+fld+bon;
        const {multiplier,label}=this.resolveMultiplier(sp,impactPlayerId);
        const final=base*multiplier;
        squadPts+=final; batPts+=bat*multiplier; bowlPts+=bowl*multiplier; fldPts+=fld*multiplier; bonPts+=bon*multiplier;
        breakdown.players.push({
          name:sp.player?.name, base:Math.round(base), bat:Math.round(bat), bowl:Math.round(bowl),
          fld:Math.round(fld), bon:Math.round(bon), multiplier, label, final:Math.round(final),
          isImpact:impactPlayerId===pid, isCaptain:sp.is_captain, isVC:sp.is_vc,
        });
      }
      const predPts=this.calcPredictionPoints(pred,match);
      onLog?.(`  → ${team.team_name}: Squad ${Math.round(squadPts)} + Pred ${predPts} = ${Math.round(squadPts+predPts)}`,'good');
      logs.push({
        match_id:matchId, fantasy_team_id:team.id,
        squad_points:Math.round(squadPts), prediction_points:predPts, total_points:Math.round(squadPts+predPts),
        batting_pts:Math.round(batPts), bowling_pts:Math.round(bowlPts), fielding_pts:Math.round(fldPts), bonus_pts:Math.round(bonPts),
        breakdown, created_at:new Date().toISOString(),
      });
    }
    const { error:plErr } = await sb.from('points_log').upsert(logs,{onConflict:'match_id,fantasy_team_id'});
    if (plErr) throw plErr;
    await this.refreshLeaderboard();
    await this.lockMatch(matchId);
    return logs;
  },

  // Manual points override
  async overridePoints(matchId, teamId, adjustment, reason) {
    const { data:ex } = await sb.from('points_log').select('*').eq('match_id',matchId).eq('fantasy_team_id',teamId).maybeSingle();
    if (!ex) throw new Error('No points log found');
    const newTotal = (ex.total_points||0) + adjustment;
    const { error } = await sb.from('points_log').update({
      total_points:newTotal,
      breakdown:{...ex.breakdown,override:{adjustment,reason,at:new Date().toISOString()}},
    }).eq('match_id',matchId).eq('fantasy_team_id',teamId);
    if (error) throw error;
    await this.refreshLeaderboard();
  },

  // ════════════════════════════════════════════════════════════
  //  ANALYTICS
  // ════════════════════════════════════════════════════════════
  async fetchAnalytics(teamId) {
    const [breakdown, predictions, impactUsage, squad] = await Promise.all([
      this.fetchPointsBreakdown(teamId), this.fetchMyPredictions(teamId),
      this.fetchImpactUsage(teamId), this.fetchSquad(teamId),
    ]);
    return {
      breakdown, predictions, impactUsage, squad,
      rankHistory:  this._buildRankHistory(breakdown),
      predStats:    this._calcPredStats(predictions),
      playerStats:  this._calcPlayerStats(breakdown),
      impactStats:  this._calcImpactStats(breakdown, impactUsage),
      streaks:      this._calcStreaks(predictions),
    };
  },

  _buildRankHistory(breakdown) {
    let cum=0;
    return breakdown.map(log => {
      cum += (log.total_points||0);
      return {
        label:  log.match?.match_title || ('M'+(log.match?.match_no||'')),
        pts:    log.total_points||0,
        cumPts: cum,
        bat:    log.batting_pts||0,
        bowl:   log.bowling_pts||0,
        fld:    log.fielding_pts||0,
        pred:   log.prediction_points||0,
      };
    });
  },

  _calcPredStats(predictions) {
    const done = predictions.filter(p => p.match?.actual_target && p.match?.winner);
    if (!done.length) return {avg_diff:0,winner_pct:0,best_streak:0,total:0,correct:0,exact:0};
    const diffs = done.map(p => Math.abs((p.target_score||0)-(p.match.actual_target||0)));
    const avgDiff = diffs.reduce((a,b)=>a+b,0)/diffs.length;
    const correct = done.filter(p => p.predicted_winner===p.match.winner).length;
    let streak=0, best=0;
    done.forEach(p => {
      if (p.predicted_winner===p.match.winner) { streak++; best=Math.max(best,streak); } else streak=0;
    });
    return {
      avg_diff: Math.round(avgDiff*10)/10, winner_pct:Math.round((correct/done.length)*100),
      best_streak:best, total:done.length, correct,
      exact: done.filter(p=>Math.abs((p.target_score||0)-(p.match.actual_target||0))===0).length,
    };
  },

  _calcPlayerStats(breakdown) {
    const pts={};
    breakdown.forEach(log => {
      (log.breakdown?.players||[]).forEach(p => {
        if (!pts[p.name]) pts[p.name]={name:p.name,total:0,bat:0,bowl:0,fld:0,bon:0,matches:0};
        pts[p.name].total+=p.final||0; pts[p.name].bat+=p.bat||0; pts[p.name].bowl+=p.bowl||0;
        pts[p.name].fld+=p.fld||0; pts[p.name].bon+=p.bon||0; pts[p.name].matches+=1;
      });
    });
    const list=Object.values(pts).sort((a,b)=>b.total-a.total);
    return {top:list.slice(0,3),worst:list.length>1?list.slice(-2).reverse():[],all:list};
  },

  _calcImpactStats(breakdown, impactUsage) {
    let totalPts=0;
    const picks=[];
    breakdown.forEach(log => {
      const ip=log.breakdown?.players?.find(p=>p.isImpact);
      if (ip) { totalPts+=ip.final||0; picks.push({name:ip.name,pts:ip.final||0,match:log.match?.match_title}); }
    });
    picks.sort((a,b)=>b.pts-a.pts);
    return {total_pts:totalPts, uses:impactUsage.length, remaining:Math.max(0,8-impactUsage.length), best_picks:picks.slice(0,3)};
  },

  _calcStreaks(predictions) {
    const done=predictions.filter(p=>p.match?.winner);
    let streak=0,max=0;
    done.forEach(p=>{if(p.predicted_winner===p.match.winner){streak++;max=Math.max(max,streak);}else streak=0;});
    return {current:streak,max};
  },

  // ════════════════════════════════════════════════════════════
  //  MATCH CENTER
  // ════════════════════════════════════════════════════════════
  async fetchMatchCenter(matchId) {
    const [match,preds,lb] = await Promise.all([
      this.fetchMatch(matchId), this.fetchAllPredictions(matchId), this.fetchMatchLeaderboard(matchId),
    ]);
    const wc={};
    let targetSum=0;
    preds.forEach(p => {
      if (p.predicted_winner) wc[p.predicted_winner]=(wc[p.predicted_winner]||0)+1;
      if (p.target_score)     targetSum+=Number(p.target_score);
    });
    const mostPicked=Object.entries(wc).sort((a,b)=>b[1]-a[1])[0]?.[0];
    return {
      match, predictions:preds, leaderboard:lb,
      summary:{
        total_preds:preds.length, avg_target:preds.length?Math.round(targetSum/preds.length):null,
        most_picked:mostPicked, winner_counts:wc,
      },
    };
  },

  // ════════════════════════════════════════════════════════════
  //  BLOGS
  // ════════════════════════════════════════════════════════════
  async fetchBlogs({ limit=20, category=null, publishedOnly=true } = {}) {
    let q = sb.from('blogs').select('id,title,slug,excerpt,category,cover_image,views,created_at,author_name,is_published')
      .order('created_at',{ascending:false}).limit(limit);
    if (publishedOnly) q=q.eq('is_published',true);
    if (category) q=q.eq('category',category);
    const { data, error } = await q;
    if (error) throw error;
    return data||[];
  },

  async fetchBlog(slugOrId) {
    const { data, error } = await sb.from('blogs').select('*')
      .or(`slug.eq.${slugOrId},id.eq.${slugOrId}`).maybeSingle();
    if (error) throw error;
    if (data) await sb.from('blogs').update({views:(data.views||0)+1}).eq('id',data.id).then(()=>{});
    return data;
  },

  async upsertBlog(blog) {
    const { data, error } = await sb.from('blogs').upsert(blog,{onConflict:'id'}).select().single();
    if (error) throw error;
    return data;
  },

  async deleteBlog(blogId) {
    const { error } = await sb.from('blogs').delete().eq('id',blogId);
    if (error) throw error;
  },

  // ════════════════════════════════════════════════════════════
  //  BADGES
  // ════════════════════════════════════════════════════════════
  async fetchUserBadges(teamId) {
    const { data, error } = await sb.from('user_badges')
      .select('*,badge:badge_definitions(id,name,description,icon,color)')
      .eq('fantasy_team_id',teamId).order('earned_at',{ascending:false});
    if (error) throw error;
    return data||[];
  },

  async awardBadge(teamId, badgeId) {
    await sb.from('user_badges').upsert({fantasy_team_id:teamId,badge_id:badgeId},{onConflict:'fantasy_team_id,badge_id'});
  },

  async checkAndAwardBadges(teamId) {
    try {
      const [breakdown,preds,impact,existing] = await Promise.all([
        this.fetchPointsBreakdown(teamId),this.fetchMyPredictions(teamId),
        this.fetchImpactUsage(teamId),this.fetchUserBadges(teamId),
      ]);
      const earned=new Set(existing.map(b=>b.badge_id));
      const predStats=this._calcPredStats(preds);
      // Award badges
      if (!earned.has('perfect_pred') && preds.some(p=>p.match?.actual_target&&Number(p.target_score)===Number(p.match.actual_target))) await this.awardBadge(teamId,'perfect_pred');
      if (!earned.has('streak_3') && predStats.best_streak>=3) await this.awardBadge(teamId,'streak_3');
      if (!earned.has('streak_5') && predStats.best_streak>=5) await this.awardBadge(teamId,'streak_5');
      if (!earned.has('impact_master') && breakdown.some(log=>(log.breakdown?.players||[]).some(p=>p.isImpact&&(p.final||0)>=300))) await this.awardBadge(teamId,'impact_master');
      if (!earned.has('captain_king') && breakdown.some(log=>(log.breakdown?.players||[]).some(p=>p.isCaptain&&(p.final||0)>=200))) await this.awardBadge(teamId,'captain_king');
    } catch(e) { console.warn('[Badges]',e.message); }
  },

  // ════════════════════════════════════════════════════════════
  //  MISC
  // ════════════════════════════════════════════════════════════
  async fetchTeams() {
    const { data, error } = await sb.from('fantasy_teams').select('id,team_name,owner_name').order('team_name');
    if (error) throw error;
    return data||[];
  },
};