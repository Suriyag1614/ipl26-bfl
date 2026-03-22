// ─────────────────────────────────────────────────────────────
//  api.js — BFL Fantasy IPL 2026
//  Data layer + Points Engine with strict Impact Player system
// ─────────────────────────────────────────────────────────────

const API = {

  // ════════════════════════════════════════════════════════════
  //  SQUADS
  // ════════════════════════════════════════════════════════════

  async fetchSquad(teamId) {
    const { data, error } = await sb
      .from('squad_players')
      .select('id, is_captain, is_vc, player:players(id, name, ipl_team, role, image_url, is_overseas)')
      .eq('fantasy_team_id', teamId)
      .order('is_captain', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async fetchAllPlayers() {
    const { data, error } = await sb.from('players')
      .select('id, name, ipl_team, role, image_url, is_overseas').order('name');
    if (error) throw error;
    return data || [];
  },

  // ════════════════════════════════════════════════════════════
  //  MATCHES
  // ════════════════════════════════════════════════════════════

  async fetchMatches({ upcoming = false, limit = 50 } = {}) {
    let q = sb.from('matches').select('*')
      .order('match_date', { ascending: true }).limit(limit);
    if (upcoming) q = q.gte('match_date', new Date().toISOString()).eq('is_locked', false);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  async fetchMatch(matchId) {
    const { data, error } = await sb.from('matches').select('*').eq('id', matchId).maybeSingle();
    if (error) throw error;
    return data;
  },

  async upsertMatch(match) {
    const { data, error } = await sb.from('matches')
      .upsert(match, { onConflict: 'id' }).select().single();
    if (error) throw error;
    return data;
  },

  async lockMatch(matchId) {
    const { error } = await sb.from('matches').update({ is_locked: true }).eq('id', matchId);
    if (error) throw error;
  },

  // ════════════════════════════════════════════════════════════
  //  PREDICTIONS
  // ════════════════════════════════════════════════════════════

  async fetchPrediction(matchId, teamId) {
    const { data, error } = await sb.from('predictions')
      .select('*, impact_player:players!predictions_impact_player_id_fkey(id, name, role)')
      .eq('match_id', matchId).eq('fantasy_team_id', teamId).maybeSingle();
    if (error) throw error;
    return data;
  },

  async fetchAllPredictions(matchId) {
    const { data, error } = await sb.from('predictions')
      .select('*, team:fantasy_teams(team_name), impact_player:players!predictions_impact_player_id_fkey(name)')
      .eq('match_id', matchId);
    if (error) throw error;
    return data || [];
  },

  // Prediction submit — target + winner only (impact handled separately)
  async submitPrediction({ matchId, teamId, targetScore, winner }) {
    const { data, error } = await sb.from('predictions').upsert({
      match_id: matchId, fantasy_team_id: teamId,
      target_score: targetScore, predicted_winner: winner,
      submitted_at: new Date().toISOString(),
    }, { onConflict: 'match_id,fantasy_team_id' }).select().single();
    if (error) throw error;
    return data;
  },

  // ════════════════════════════════════════════════════════════
  //  IMPACT PLAYER SYSTEM
  // ════════════════════════════════════════════════════════════

  // Full usage history for a team (all matches, used=true)
  async fetchImpactUsage(teamId) {
    const { data, error } = await sb.from('impact_usage')
      .select('id, match_id, player_id, used, created_at, player:players(name, role, ipl_team)')
      .eq('fantasy_team_id', teamId).eq('used', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // Lightweight count only
  async fetchImpactCount(teamId) {
    const { count, error } = await sb.from('impact_usage')
      .select('id', { count: 'exact', head: true })
      .eq('fantasy_team_id', teamId).eq('used', true);
    if (error) throw error;
    return count || 0;
  },

  // Get impact selection for one specific match
  async fetchImpactForMatch(teamId, matchId) {
    const { data, error } = await sb.from('impact_usage')
      .select('*, player:players(id, name, role, ipl_team)')
      .eq('fantasy_team_id', teamId).eq('match_id', matchId).maybeSingle();
    if (error) throw error;
    return data;
  },

  // ── CLIENT-SIDE validation (fast, before hitting server) ────
  validateImpactPlayer(squad, playerId, usageCount) {
    if (usageCount >= 8)
      return { valid: false, error: 'Impact Player limit reached (8/8 used)' };

    const sp = squad.find(s => s.player?.id === playerId);
    if (!sp)
      return { valid: false, error: 'Selected player is not in your squad' };

    if (sp.is_captain)
      return { valid: false, error: 'Captain cannot be Impact Player — they already get 2× multiplier' };

    if (sp.is_vc)
      return { valid: false, error: 'Vice Captain cannot be Impact Player — they already get 1.5× multiplier' };

    return { valid: true, error: null };
  },

  // ── SERVER-SIDE atomic submit via RPC ───────────────────────
  async submitImpactPlayer(teamId, matchId, playerId) {
    // 1. Client pre-validation
    const [squad, count] = await Promise.all([
      this.fetchSquad(teamId),
      this.fetchImpactCount(teamId),
    ]);
    const check = this.validateImpactPlayer(squad, playerId, count);
    if (!check.valid) throw new Error(check.error);

    // 2. Server atomic validation + insert
    const { data, error } = await sb.rpc('submit_impact_player', {
      p_team_id:   teamId,
      p_match_id:  matchId,
      p_player_id: playerId,
    });
    if (error) throw new Error(error.message);
    if (data && !data.success) throw new Error(data.error || 'Server rejected impact player');
    return data;
  },

  // ════════════════════════════════════════════════════════════
  //  PLAYER MATCH STATS
  // ════════════════════════════════════════════════════════════

  async fetchPlayerStats(matchId) {
    const { data, error } = await sb.from('player_match_stats')
      .select('*, player:players(id, name, role, ipl_team)').eq('match_id', matchId);
    if (error) throw error;
    return data || [];
  },

  async upsertPlayerStats(stats) {
    const { data, error } = await sb.from('player_match_stats')
      .upsert(stats, { onConflict: 'match_id,player_id' }).select();
    if (error) throw error;
    return data;
  },

  // ════════════════════════════════════════════════════════════
  //  LEADERBOARD
  // ════════════════════════════════════════════════════════════

  async fetchLeaderboard() {
    const { data, error } = await sb.from('leaderboard')
      .select('*, team:fantasy_teams(team_name, owner_name)')
      .order('total_points', { ascending: false });
    if (error) throw error;
    return (data || []).map((row, i) => ({ ...row, rank: i + 1 }));
  },

  async fetchPointsBreakdown(teamId) {
    const { data, error } = await sb.from('points_log')
      .select('*, match:matches(match_title, match_date, team1, team2)')
      .eq('fantasy_team_id', teamId).order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async refreshLeaderboard() {
    const { data: logs, error: le } = await sb.from('points_log').select('fantasy_team_id, total_points');
    if (le) throw le;
    const agg = {};
    (logs || []).forEach(r => {
      if (!agg[r.fantasy_team_id]) agg[r.fantasy_team_id] = { total_points: 0, matches_played: 0 };
      agg[r.fantasy_team_id].total_points   += Number(r.total_points || 0);
      agg[r.fantasy_team_id].matches_played += 1;
    });
    const rows = Object.entries(agg).map(([id, v]) => ({
      fantasy_team_id: id, total_points: v.total_points,
      matches_played: v.matches_played, updated_at: new Date().toISOString(),
    }));
    if (!rows.length) return;
    const { error } = await sb.from('leaderboard').upsert(rows, { onConflict: 'fantasy_team_id' });
    if (error) throw error;
  },

  // ════════════════════════════════════════════════════════════
  //  POINTS ENGINE
  // ════════════════════════════════════════════════════════════

  calcBattingPoints(s) {
    if (!s) return 0;
    let pts = 0;
    const runs  = Number(s.runs        || 0);
    const balls = Number(s.balls_faced || 0);
    const notOut = !!s.not_out;
    pts += runs;
    if      (runs >= 150) pts += 300;
    else if (runs >= 100) pts += 200;
    else if (runs >=  50) pts += 100;
    else if (runs >=  25) pts +=  50;
    if ((Number(s.fours || 0) + Number(s.sixes || 0)) >= 10) pts += 100;
    if (balls >= 10 && (runs / balls) * 100 >= 200) pts += 100;
    if (balls >= 60) pts += 100;
    if (!notOut) { if (runs === 0) pts -= 25; else if (runs < 10) pts -= 10; }
    if (notOut) pts += 25;
    return Math.max(0, pts);
  },

  calcBowlingPoints(s) {
    if (!s) return 0;
    let pts = 0;
    const wickets = Number(s.wickets       || 0);
    const overs   = Number(s.overs_bowled  || 0);
    const runs    = Number(s.runs_conceded || 0);
    pts += wickets * 50;
    if      (wickets >= 9) pts += 400;
    else if (wickets >= 7) pts += 300;
    else if (wickets >= 5) pts += 200;
    else if (wickets >= 3) pts += 100;
    pts += Number(s.maidens || 0) * 50;
    if (overs >= 1) { const eco = runs / overs; if (eco <= 5) pts += 100; if (eco >= 10) pts -= 50; }
    if (overs >= 2 && wickets === 0) pts -= 25;
    return Math.max(0, pts);
  },

  calcFieldingPoints(s) {
    if (!s) return 0;
    let pts = 0;
    const catches = Number(s.catches || 0);
    pts += catches * 25;
    pts += Number(s.run_outs  || 0) * 50;
    pts += Number(s.stumpings || 0) * 50;
    if (catches >= 3) pts += 50;
    return pts;
  },

  calcBonusPoints(s, match) {
    let pts = 0;
    if (match?.player_of_match === s.player_id) pts += 100;
    if (s.player_of_series) pts += 500;
    return pts;
  },

  calcPredictionPoints(pred, match) {
    if (!pred || !match) return 0;
    let pts = 0;
    const diff = Math.abs(Number(pred.target_score || 0) - Number(match.actual_target || 0));
    if      (diff === 0) pts += 250;
    else if (diff === 1) pts += 150;
    else if (diff <= 5)  pts += 100;
    else if (diff <= 10) pts +=  50;
    if (pred.predicted_winner === match.winner) pts += 25;
    return pts;
  },

  // ── MULTIPLIER RESOLUTION ────────────────────────────────────
  // Strict priority: Impact (3×) > Captain (2×) > VC (1.5×) > Normal (1×)
  // A player cannot hold multiple multipliers simultaneously.
  resolveMultiplier(squadPlayer, impactPlayerId) {
    const pid = squadPlayer.player?.id;
    if (impactPlayerId && pid === impactPlayerId)
      return { multiplier: 3,   label: '⚡ 3× Impact' };
    if (squadPlayer.is_captain)
      return { multiplier: 2,   label: '👑 2× C' };
    if (squadPlayer.is_vc)
      return { multiplier: 1.5, label: '⭐ 1.5× VC' };
    return { multiplier: 1, label: '' };
  },

  // ── Full match points calculation ─────────────────────────────
  async calculateMatchPoints(matchId) {
    const logs = [];
    const [match, allStats, allPredictions] = await Promise.all([
      this.fetchMatch(matchId),
      this.fetchPlayerStats(matchId),
      this.fetchAllPredictions(matchId),
    ]);
    if (!match) throw new Error('Match not found');

    const { data: teams, error: te } = await sb.from('fantasy_teams').select('id, team_name');
    if (te) throw te;

    const statMap = {};
    allStats.forEach(s => { statMap[s.player_id] = s; });

    const predMap = {};
    allPredictions.forEach(p => { predMap[p.fantasy_team_id] = p; });

    // Fetch all impact selections for this match
    const { data: impactRows } = await sb.from('impact_usage')
      .select('fantasy_team_id, player_id').eq('match_id', matchId).eq('used', true);
    const impactMap = {};
    (impactRows || []).forEach(r => { impactMap[r.fantasy_team_id] = r.player_id; });

    for (const team of (teams || [])) {
      const squadRows      = await this.fetchSquad(team.id);
      const pred           = predMap[team.id] || null;
      const impactPlayerId = impactMap[team.id] || null;

      let squadPoints = 0;
      const breakdown = { players: [], impactPlayerId };

      for (const sp of squadRows) {
        const pid   = sp.player?.id;
        const stats = statMap[pid];
        if (!stats) continue;

        const base = (
          this.calcBattingPoints(stats)  +
          this.calcBowlingPoints(stats)  +
          this.calcFieldingPoints(stats) +
          this.calcBonusPoints(stats, match)
        );

        const { multiplier, label } = this.resolveMultiplier(sp, impactPlayerId);
        const final = base * multiplier;
        squadPoints += final;

        breakdown.players.push({
          name: sp.player?.name, base: Math.round(base),
          multiplier, label, final: Math.round(final),
          isImpact: impactPlayerId === pid,
          isCaptain: sp.is_captain, isVC: sp.is_vc,
        });
      }

      const predPts = this.calcPredictionPoints(pred, match);
      logs.push({
        match_id: matchId, fantasy_team_id: team.id,
        squad_points: Math.round(squadPoints), prediction_points: predPts,
        total_points: Math.round(squadPoints + predPts),
        breakdown, created_at: new Date().toISOString(),
      });
    }

    const { error: plErr } = await sb.from('points_log')
      .upsert(logs, { onConflict: 'match_id,fantasy_team_id' });
    if (plErr) throw plErr;
    await this.refreshLeaderboard();
    await this.lockMatch(matchId);
    return logs;
  },

  async fetchTeams() {
    const { data, error } = await sb.from('fantasy_teams')
      .select('id, team_name, owner_name').order('team_name');
    if (error) throw error;
    return data || [];
  },
};