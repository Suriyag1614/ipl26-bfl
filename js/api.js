// ─────────────────────────────────────────────────────────────────────────
//  api.js — BFL Fantasy IPL 2026  v3
//  Injury/Replacement · PoM/PoT · Adjustments · Audit log · Blog flow
//  Dynamic dropdowns · Undo support · Confirmation-safe writes
// ─────────────────────────────────────────────────────────────────────────

const API = {

  // ══════════════════════════════════════════════════════════════════
  //  SQUADS  — injury + active replacement injected per player
  // ══════════════════════════════════════════════════════════════════
  async fetchSquad(teamId) {
    const { data, error } = await sb.from('squad_players')
      .select('id,is_captain,is_vc,is_impact,player:players(id,name,ipl_team,role,image_url,is_overseas,is_injured,injury_note)')
      .eq('fantasy_team_id', teamId).order('is_captain', { ascending: false });
    if (error) throw error;
    if (!data) return [];
    const rows = Array.isArray(data) ? data : [data];
    const reps = await this.fetchActiveReplacements(teamId);
    return rows.map(sp => {
      const rep = reps.find(r => r.original_player_id === sp.player?.id);
      return { ...sp, replacement: rep || null };
    });
  },

  async fetchAllPlayers() {
    const { data, error } = await sb.from('players')
      .select('id,name,ipl_team,role,image_url,is_overseas,is_injured,injury_note').order('name');
    if (error) throw error;
    return data || [];
  },

  // Dynamic dropdown: players filtered by IPL team
  async fetchPlayersByTeam(iplTeam) {
    const { data, error } = await sb.from('players')
      .select('id,name,ipl_team,role,image_url,is_overseas,is_injured')
      .eq('ipl_team', iplTeam).order('name');
    if (error) throw error;
    return data || [];
  },

  // Dynamic dropdown: players for both sides of a match
  async fetchPlayersByMatch(matchId) {
    const match = await this.fetchMatch(matchId);
    if (!match) return [];
    const { data, error } = await sb.from('players')
      .select('id,name,ipl_team,role,image_url,is_overseas,is_injured')
      .in('ipl_team', [match.team1, match.team2]).order('ipl_team,name');
    if (error) throw error;
    return data || [];
  },

  // ══════════════════════════════════════════════════════════════════
  //  INJURY MANAGEMENT  (admin only)
  // ══════════════════════════════════════════════════════════════════
  async markPlayerInjured(playerId, injuryNote) {
    const { error } = await sb.from('players')
      .update({ is_injured: true, injury_note: injuryNote || null }).eq('id', playerId);
    if (error) throw error;
    await this._log('injury_set', 'player', playerId, null, { is_injured: true, injury_note: injuryNote });
  },

  async clearPlayerInjury(playerId) {
    const { error } = await sb.from('players')
      .update({ is_injured: false, injury_note: null }).eq('id', playerId);
    if (error) throw error;
    await this._log('injury_cleared', 'player', playerId, { is_injured: true }, { is_injured: false });
  },

  // ══════════════════════════════════════════════════════════════════
  //  REPLACEMENT SYSTEM
  // ══════════════════════════════════════════════════════════════════
  async fetchActiveReplacements(teamId) {
    const { data, error } = await sb.from('replacements')
      .select('*,original:players!replacements_original_player_id_fkey(id,name,role,ipl_team,image_url,is_injured),replacement:players!replacements_replacement_player_id_fkey(id,name,role,ipl_team,image_url)')
      .eq('fantasy_team_id', teamId).eq('is_active', true);
    if (error) throw error;
    return data || [];
  },

  async fetchAllReplacements(teamId) {
    let q = sb.from('replacements')
      .select('*,original:players!replacements_original_player_id_fkey(id,name,role,ipl_team),replacement:players!replacements_replacement_player_id_fkey(id,name,role,ipl_team)')
      .order('created_at', { ascending: false });
    if (teamId) q = q.eq('fantasy_team_id', teamId);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  async createReplacement({ teamId, originalPlayerId, replacementPlayerId, startMatchId, reason }) {
    // Role validation
    const [origRes, replRes] = await Promise.all([
      sb.from('players').select('role,name').eq('id', originalPlayerId).maybeSingle(),
      sb.from('players').select('role,name').eq('id', replacementPlayerId).maybeSingle(),
    ]);
    if (origRes.data?.role !== replRes.data?.role) {
      throw new Error('Role mismatch: replacement must have same role as original player');
    }
    // Deactivate any existing active replacement for this player
    await sb.from('replacements').update({ is_active: false })
      .eq('fantasy_team_id', teamId).eq('original_player_id', originalPlayerId).eq('is_active', true);
    const { data, error } = await sb.from('replacements').insert({
      fantasy_team_id: teamId, original_player_id: originalPlayerId,
      replacement_player_id: replacementPlayerId, start_match_id: startMatchId || null,
      reason: reason || null, is_active: true,
    }).select().single();
    if (error) throw error;
    await this._log('replacement_created', 'team', teamId, null, data);
    return data;
  },

  async deactivateReplacement(replacementId) {
    const { data: before } = await sb.from('replacements').select('*').eq('id', replacementId).maybeSingle();
    const { error } = await sb.from('replacements').update({ is_active: false }).eq('id', replacementId);
    if (error) throw error;
    await this._log('replacement_deactivated', 'replacement', replacementId, before, { is_active: false });
  },

  // ══════════════════════════════════════════════════════════════════
  //  MATCHES
  // ══════════════════════════════════════════════════════════════════
  async fetchMatches({ upcoming = false, limit = 74, status = null } = {}) {
    let q = sb.from('matches').select('*').order('match_no', { ascending: true }).limit(limit);
    if (upcoming) q = q.eq('is_locked', false).gte('match_date', new Date().toISOString());
    if (status)   q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw error;
    const now = Date.now();
    return (data || []).map(m => {
      if (!m.is_locked && m.deadline_time && new Date(m.deadline_time).getTime() <= now)
        return { ...m, _client_locked: true };
      return m;
    });
  },

  async fetchMatch(matchId) {
    const { data, error } = await sb.from('matches')
      .select('*,pom_player:players(id,name,ipl_team,role)').eq('id', matchId).maybeSingle();
    if (error) throw error;
    return data;
  },

  async upsertMatch(match) {
    if (match.match_date) {
      // Auto-lock means "minutes after match start"
      if (!match.deadline_time) {
        const d = new Date(match.match_date);
        d.setMinutes(d.getMinutes() + (match.auto_lock_mins || 15));
        match.deadline_time = d.toISOString();
      }
      // Keep lock_time aligned to deadline + 5 min if not explicitly set
      if (!match.lock_time && match.deadline_time) {
        match.lock_time = new Date(new Date(match.deadline_time).getTime() + 5 * 60 * 1000).toISOString();
      }
    }

    const { data: before } = await sb.from('matches').select('*').eq('id', match.id || '').maybeSingle();
    const { data, error } = await sb.from('matches').upsert(match, { onConflict: 'id' }).select().single();
    if (error) throw error;
    await this._log('match_edit', 'match', data.id, before, data);
    return data;
  },

  async lockMatch(matchId) {
    const { error } = await sb.from('matches').update({ is_locked: true, status: 'locked' }).eq('id', matchId);
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
    try {
      const { error } = await sb.rpc('lock_due_matches');
      if (error && error.code === 'PGRST202') return;
    } catch (_) {}
  },

  // ══════════════════════════════════════════════════════════════════
  //  PLAYER OF MATCH / TOURNAMENT
  // ══════════════════════════════════════════════════════════════════
  async setPlayerOfMatch(matchId, playerId) {
    const { data: before } = await sb.from('matches').select('player_of_match').eq('id', matchId).maybeSingle();
    const { error } = await sb.from('matches').update({ player_of_match: playerId }).eq('id', matchId);
    if (error) throw error;
    await this._log('pom_set', 'match', matchId, before, { player_of_match: playerId });
  },

  async setPlayerOfSeries(playerId) {
    const { error } = await sb.from('tournament_settings')
      .upsert({ key: 'player_of_series_id', value: playerId }, { onConflict: 'key' });
    if (error) throw error;
  },

  async fetchPlayerOfSeries() {
    const { data } = await sb.from('tournament_settings')
      .select('value').eq('key', 'player_of_series_id').maybeSingle();
    if (!data?.value) return null;
    const { data: p } = await sb.from('players').select('*').eq('id', data.value).maybeSingle();
    return p;
  },

  // ══════════════════════════════════════════════════════════════════
  //  PREDICTIONS
  // ══════════════════════════════════════════════════════════════════
  async fetchPrediction(matchId, teamId) {
    const { data, error } = await sb.from('predictions')
      .select('*')
      .eq('match_id', matchId).eq('fantasy_team_id', teamId).maybeSingle();
    if (error) throw error;
    return data;
  },

  async fetchAllPredictions(matchId) {
    const { data, error } = await sb.from('predictions')
      .select('*,team:fantasy_teams(team_name)')
      .eq('match_id', matchId);
    if (error) throw error;
    return data || [];
  },

  async submitPrediction({ matchId, teamId, targetScore, winner }, match) {
    if (match && !this.isMatchOpen(match)) throw new Error('Predictions are locked for this match');
    const { data, error } = await sb.from('predictions').upsert({
      match_id: matchId, fantasy_team_id: teamId,
      target_score: targetScore, predicted_winner: winner,
      submitted_at: new Date().toISOString(),
    }, { onConflict: 'match_id,fantasy_team_id' }).select().single();
    if (error) throw error;
    return data;
  },

  async fetchMyPredictions(teamId) {
    const { data, error } = await sb.from('predictions')
      .select('*,match:matches(id,match_title,team1,team2,actual_target,winner,match_date,status,match_no)')
      .eq('fantasy_team_id', teamId).order('submitted_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  // ══════════════════════════════════════════════════════════════════
  //  IMPACT PLAYER  (strict: max 8, no C/VC, squad-only)
  // ══════════════════════════════════════════════════════════════════
  async fetchImpactUsage(teamId) {
    const { data, error } = await sb.from('impact_usage')
      .select('id,match_id,player_id,used,created_at,player:players(name,role,ipl_team),match:matches(match_title)')
      .eq('fantasy_team_id', teamId).eq('used', true).order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async fetchImpactCount(teamId) {
    const { count, error } = await sb.from('impact_usage')
      .select('id', { count: 'exact', head: true }).eq('fantasy_team_id', teamId).eq('used', true);
    if (error) throw error;
    return count || 0;
  },

  async fetchImpactForMatch(teamId, matchId) {
    const { data, error } = await sb.from('impact_usage')
      .select('*,player:players(id,name,role,ipl_team)').eq('fantasy_team_id', teamId).eq('match_id', matchId).maybeSingle();
    if (error) throw error;
    return data;
  },

  validateImpactPlayer(squad, playerId, usageCount) {
    if (usageCount >= 8) return { valid: false, error: 'Impact Player limit reached (8/8 used)' };
    const sp = squad.find(s => s.player?.id === playerId);
    if (!sp)           return { valid: false, error: 'Player not in your squad' };
    if (sp.is_captain) return { valid: false, error: 'Captain cannot be Impact Player (2\u00d7 already applied)' };
    if (sp.is_vc)      return { valid: false, error: 'Vice Captain cannot be Impact Player (1.5\u00d7 already applied)' };
    return { valid: true, error: null };
  },

  async submitImpactPlayer(teamId, matchId, playerId) {
    const [squad, count] = await Promise.all([this.fetchSquad(teamId), this.fetchImpactCount(teamId)]);
    const check = this.validateImpactPlayer(squad, playerId, count);
    if (!check.valid) throw new Error(check.error);
    const { data, error } = await sb.rpc('submit_impact_player', { p_team_id: teamId, p_match_id: matchId, p_player_id: playerId });
    if (error) throw new Error(error.message);
    if (data && !data.success) throw new Error(data.error || 'Server rejected impact player');
    return data;
  },

  // ══════════════════════════════════════════════════════════════════
  //  PLAYER STATS
  // ══════════════════════════════════════════════════════════════════
  async fetchPlayerStats(matchId) {
    const { data, error } = await sb.from('player_match_stats')
      .select('*,player:players(id,name,role,ipl_team)').eq('match_id', matchId);
    if (error) throw error;
    return data || [];
  },

  async upsertPlayerStats(stats) {
    const { data: before } = await sb.from('player_match_stats')
      .select('*').eq('match_id', stats.match_id).eq('player_id', stats.player_id).maybeSingle();
    const { data, error } = await sb.from('player_match_stats')
      .upsert(stats, { onConflict: 'match_id,player_id' }).select();
    if (error) throw error;
    await this._log('stat_entry', 'player', stats.player_id, before, stats);
    return data;
  },

  async bulkUpsertPlayerStats(statsArray) {
    const { data, error } = await sb.from('player_match_stats')
      .upsert(statsArray, { onConflict: 'match_id,player_id' });
    if (error) throw error;
    return data;
  },

  async undoLastStatEntry(playerId) {
    const { data: log } = await sb.from('action_log')
      .select('*').eq('action_type', 'stat_entry').eq('entity_id', playerId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!log?.payload_before) throw new Error('No previous stat entry found to restore');
    await sb.from('player_match_stats').upsert(log.payload_before, { onConflict: 'match_id,player_id' });
    await this._log('stat_entry_undone', 'player', playerId, log.payload_after, log.payload_before);
    return log.payload_before;
  },

  parseStatsCsv(csvText, matchId) {
    const lines = csvText.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) throw new Error('CSV must have header + data rows');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
    return lines.slice(1).map(line => {
      const vals = line.split(',');
      const obj  = { match_id: matchId };
      headers.forEach((h, i) => {
        const v = vals[i]?.trim() || '';
        obj[h] = (h === 'player_id' || h === 'match_id') ? v : (isNaN(Number(v)) ? v : Number(v) || 0);
      });
      return obj;
    });
  },

  // ══════════════════════════════════════════════════════════════════
  //  LEADERBOARD  — includes adjustments in total
  // ══════════════════════════════════════════════════════════════════
  async fetchLeaderboard() {
    const { data, error } = await sb.from('leaderboard')
      .select('*,team:fantasy_teams(team_name,owner_name)').order('total_points', { ascending: false });
    if (error) throw error;
    // Merge adjustments
    const { data: adjs } = await sb.from('adjustments').select('fantasy_team_id,points');
    const adjMap = {};
    (adjs || []).forEach(a => { adjMap[a.fantasy_team_id] = (adjMap[a.fantasy_team_id] || 0) + (a.points || 0); });
    return (data || []).map(row => ({
      ...row,
      adjustment_pts: adjMap[row.fantasy_team_id] || 0,
      total_points: (row.total_points || 0) + (adjMap[row.fantasy_team_id] || 0),
    })).sort((a, b) => b.total_points - a.total_points).map((row, i) => ({ ...row, rank: i + 1 }));
  },

  async fetchPointsBreakdown(teamId) {
    const { data, error } = await sb.from('points_log')
      .select('*,match:matches(id,match_title,match_date,team1,team2,winner,actual_target,status,match_no)')
      .eq('fantasy_team_id', teamId).order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async fetchMatchLeaderboard(matchId) {
    const { data, error } = await sb.from('points_log')
      .select('*,team:fantasy_teams(team_name)').eq('match_id', matchId).order('total_points', { ascending: false });
    if (error) throw error;
    return (data || []).map((r, i) => ({ ...r, match_rank: i + 1 }));
  },

  async refreshLeaderboard() {
    const { data: logs, error: le } = await sb.from('points_log').select('fantasy_team_id,total_points');
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

  // ══════════════════════════════════════════════════════════════════
  //  ADJUSTMENTS  (non-destructive, fully audited)
  // ══════════════════════════════════════════════════════════════════
  async applyAdjustment({ teamId, matchId, points, remarks }) {
    if (!remarks?.trim()) throw new Error('Remarks are required for all adjustments');
    if (!points || points === 0) throw new Error('Points must be non-zero');
    const { data, error } = await sb.from('adjustments').insert({
      fantasy_team_id: teamId, match_id: matchId || null,
      points: parseInt(points), remarks: remarks.trim(),
    }).select().single();
    if (error) throw error;
    await this._log('adjustment', 'team', teamId, null, data);
    await this.refreshLeaderboard();
    return data;
  },

  async fetchAllAdjustments() {
    const { data, error } = await sb.from('adjustments')
      .select('*,match:matches(match_title,match_no),team:fantasy_teams(team_name)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async undoAdjustment(adjustmentId) {
    const { data: adj } = await sb.from('adjustments').select('*').eq('id', adjustmentId).maybeSingle();
    if (!adj) throw new Error('Adjustment not found');
    const { error } = await sb.from('adjustments').delete().eq('id', adjustmentId);
    if (error) throw error;
    await this._log('adjustment_undone', 'team', adj.fantasy_team_id, adj, null);
    await this.refreshLeaderboard();
  },

  // Legacy compat (used by admin.html submitOverride)
  async overridePoints(matchId, teamId, adjustment, reason) {
    return this.applyAdjustment({ teamId, matchId, points: adjustment, remarks: reason });
  },

  // ══════════════════════════════════════════════════════════════════
  //  RECALCULATION ENGINE
  // ══════════════════════════════════════════════════════════════════
  async recalculateMatch(matchId, onLog) {
    onLog?.('Deleting existing points for this match...');
    const { error: delErr } = await sb.from('points_log').delete().eq('match_id', matchId);
    if (delErr) throw delErr;
    onLog?.('Recalculating player points...');
    const result = await this.calculateMatchPoints(matchId, onLog);
    try { await sb.rpc('refresh_match_center', { p_match_id: matchId }); } catch (_) {}
    onLog?.('Done! Leaderboard refreshed.', 'good');
    return result;
  },

  // ══════════════════════════════════════════════════════════════════
  //  POINTS ENGINE  — replacement-aware · PoM/PoT bonus not multiplied
  // ══════════════════════════════════════════════════════════════════
  calcBattingPoints(s) {
    if (!s) return 0;
    let pts = 0;
    const runs = Number(s.runs || 0), balls = Number(s.balls_faced || 0);
    pts += runs;
    if      (runs >= 150) pts += 300; else if (runs >= 100) pts += 200;
    else if (runs >= 50)  pts += 100; else if (runs >= 25)  pts += 50;
    if ((Number(s.fours || 0) + Number(s.sixes || 0)) >= 10) pts += 100;
    if (balls >= 10 && (runs / balls) * 100 >= 200) pts += 100;
    if (balls >= 60) pts += 100;
    if (!s.not_out) { if (runs === 0) pts -= 25; else if (runs < 10) pts -= 10; }
    if (s.not_out)  pts += 25;
    return Math.max(0, pts);
  },

  calcBowlingPoints(s) {
    if (!s) return 0;
    let pts = 0;
    const wickets = Number(s.wickets || 0), overs = Number(s.overs_bowled || 0), runs = Number(s.runs_conceded || 0);
    pts += wickets * 50;
    if      (wickets >= 9) pts += 400; else if (wickets >= 7) pts += 300;
    else if (wickets >= 5) pts += 200; else if (wickets >= 3) pts += 100;
    pts += Number(s.maidens || 0) * 50;
    if (overs >= 1) { const eco = runs / overs; if (eco <= 5) pts += 100; if (eco >= 10) pts -= 50; }
    if (overs >= 2 && wickets === 0) pts -= 25;
    return Math.max(0, pts);
  },

  calcFieldingPoints(s) {
    if (!s) return 0;
    let pts = 0;
    const catches = Number(s.catches || 0);
    pts += catches * 25 + Number(s.run_outs || 0) * 50 + Number(s.stumpings || 0) * 50;
    if (catches >= 3) pts += 50;
    return pts;
  },

  // PoM +100 and PoT +500 are NOT affected by C/VC/Impact multipliers
  calcBonusPoints(stats, pomPlayerId, potPlayerId) {
    let pts = 0;
    if (pomPlayerId && stats.player_id === pomPlayerId) pts += 100;
    if (potPlayerId && stats.player_id === potPlayerId) pts += 500;
    return pts;
  },

  calcPredictionPoints(pred, match) {
    if (!pred || !match) return 0;
    let pts = 0;
    const diff = Math.abs(Number(pred.target_score || 0) - Number(match.actual_target || 0));
    if (diff === 0) pts += 250; else if (diff === 1) pts += 150;
    else if (diff <= 5) pts += 100; else if (diff <= 10) pts += 50;
    if (pred.predicted_winner === match.winner) pts += 25;
    return pts;
  },

  resolveMultiplier(squadPlayer, isActive) {
    const isImpact = squadPlayer.is_impact;
    if (isImpact) {
      return isActive 
        ? { multiplier: 3, label: '\u26a1 3\u00d7 Impact (Active)' }
        : { multiplier: 0, label: '(Excluded - Impact OFF)' };
    }
    if (squadPlayer.is_captain)                   return { multiplier: 2,   label: '\ud83d\udc51 2\u00d7 C' };
    if (squadPlayer.is_vc)                        return { multiplier: 1.5, label: '\u2b50 1.5\u00d7 VC' };
    return { multiplier: 1, label: '' };
  },

  async calculateMatchPoints(matchId, onLog) {
    const [match, allStats, allPredictions] = await Promise.all([
      this.fetchMatch(matchId), this.fetchPlayerStats(matchId), this.fetchAllPredictions(matchId),
    ]);
    if (!match) throw new Error('Match not found');

    // Fetch PoT
    const { data: ts } = await sb.from('tournament_settings')
      .select('value').eq('key', 'player_of_series_id').maybeSingle();
    const potPlayerId = ts?.value || null;
    const pomPlayerId = match.player_of_match || null;

    const { data: teams, error: te } = await sb.from('fantasy_teams').select('id,team_name');
    if (te) throw te;
    const statMap = {}, predMap = {};
    allStats.forEach(s => { statMap[s.player_id] = s; });
    allPredictions.forEach(p => { predMap[p.fantasy_team_id] = p; });

    const { data: actRows } = await sb.from('impact_activations')
      .select('fantasy_team_id,is_active').eq('match_id', matchId);
    const actMap = {};
    (actRows || []).forEach(r => { actMap[r.fantasy_team_id] = !!r.is_active; });

    const logs = [];
    for (const team of (teams || [])) {
      const squadRows = await this.fetchSquad(team.id);
      const pred      = predMap[team.id] || null;
      const isActive  = !!actMap[team.id];
      let squadPts = 0, batPts = 0, bowlPts = 0, fldPts = 0, bonPts = 0;
      const breakdown = { players: [], impactActive: isActive };

      const playerResults = [];
      for (const sp of squadRows) {
        // Use replacement player's stats when original is injured
        const effectivePid = (sp.player?.is_injured && sp.replacement)
          ? sp.replacement.replacement_player_id
          : sp.player?.id;
        const stats = statMap[effectivePid];
        
        // Even if no stats, we need to create the entry for the 12-player slots
        const bat  = stats ? this.calcBattingPoints(stats) : 0;
        const bowl = stats ? this.calcBowlingPoints(stats) : 0;
        const fld  = stats ? this.calcFieldingPoints(stats) : 0;
        const bon  = stats ? this.calcBonusPoints(stats, pomPlayerId, potPlayerId) : 0;
        const base = bat + bowl + fld;
        const { multiplier, label } = this.resolveMultiplier(sp, isActive);
        const final = (base * multiplier) + bon;

        playerResults.push({
          name: sp.player?.name,
          effective_name: sp.replacement ? sp.replacement.replacement?.name : sp.player?.name,
          is_injured: !!sp.player?.is_injured,
          is_replacement: !!(sp.player?.is_injured && sp.replacement),
          base: Math.round(base), bat: Math.round(bat), bowl: Math.round(bowl),
          fld: Math.round(fld), bon: Math.round(bon), multiplier, label,
          final: Math.round(final),
          isImpact: !!sp.is_impact,
          isImpactActive: !!(sp.is_impact && isActive),
          isCaptain: !!sp.is_captain, isVC: !!sp.is_vc,
          isPom: pomPlayerId && (effectivePid === pomPlayerId), isPot: potPlayerId && (effectivePid === potPlayerId),
          points: final // raw points for sorting
        });
      }

      // 🎯 Impact Player Logic (New Correct Implementation):
      // Multiplier handles EXCLUSION (0x if OFF, 3x if ON)
      // Always count all 12 entries since the inactive player contributes 0 points

      // Final aggregation
      playerResults.forEach(pr => {
        squadPts += pr.final;
        // Approximation for category-wise points (since multipliers are already applied in 'final')
        // We'll store the final values directly for simpler breakdown reading
        breakdown.players.push(pr);
      });

      // Recalculate category totals for logs (weighted by multiplier if active)
      batPts = playerResults.reduce((s, p) => s + (p.bat * p.multiplier), 0);
      bowlPts = playerResults.reduce((s, p) => s + (p.bowl * p.multiplier), 0);
      fldPts = playerResults.reduce((s, p) => s + (p.fld * p.multiplier), 0);
      bonPts = playerResults.reduce((s, p) => s + p.bon, 0);

      const predPts = this.calcPredictionPoints(pred, match);
      onLog?.(`  → ${team.team_name}: Squad ${Math.round(squadPts)} + Pred ${predPts} = ${Math.round(squadPts + predPts)}`, 'good');
      logs.push({
        match_id: matchId, fantasy_team_id: team.id,
        squad_points: Math.round(squadPts), prediction_points: predPts,
        total_points: Math.round(squadPts + predPts),
        batting_pts: Math.round(batPts), bowling_pts: Math.round(bowlPts),
        fielding_pts: Math.round(fldPts), bonus_pts: Math.round(bonPts),
        breakdown, created_at: new Date().toISOString(),
      });
    }
    const { error: plErr } = await sb.from('points_log').upsert(logs, { onConflict: 'match_id,fantasy_team_id' });
    if (plErr) throw plErr;
    await this.refreshLeaderboard();
    await this.lockMatch(matchId);
    return logs;
  },

  // ══════════════════════════════════════════════════════════════════
  //  AUDIT LOG
  // ══════════════════════════════════════════════════════════════════
  async _log(actionType, entityType, entityId, before, after) {
    try {
      await sb.from('action_log').insert({
        action_type: actionType, entity_type: entityType,
        entity_id: String(entityId || ''),
        payload_before: before || null, payload_after: after || null,
      });
    } catch (e) { console.warn('[ActionLog]', e.message); }
  },

  async fetchActionLog({ limit = 50, actionType = null } = {}) {
    let q = sb.from('action_log').select('*').order('created_at', { ascending: false }).limit(limit);
    if (actionType) q = q.eq('action_type', actionType);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  // ══════════════════════════════════════════════════════════════════
  //  ANALYTICS
  // ══════════════════════════════════════════════════════════════════
  async fetchAnalytics(teamId) {
    const [breakdown, predictions, impactUsage, squad] = await Promise.all([
      this.fetchPointsBreakdown(teamId), this.fetchMyPredictions(teamId),
      this.fetchImpactUsage(teamId), this.fetchSquad(teamId),
    ]);
    return {
      breakdown, predictions, impactUsage, squad,
      rankHistory: this._buildRankHistory(breakdown),
      predStats:   this._calcPredStats(predictions),
      playerStats: this._calcPlayerStats(breakdown),
      impactStats: this._calcImpactStats(breakdown, impactUsage),
      streaks:     this._calcStreaks(predictions),
    };
  },

  _buildRankHistory(breakdown) {
    let cum = 0;
    return breakdown.map(log => {
      cum += (log.total_points || 0);
      return {
        label: log.match?.match_title || ('M' + (log.match?.match_no || '')),
        pts: log.total_points || 0, cumPts: cum,
        bat: log.batting_pts || 0, bowl: log.bowling_pts || 0,
        fld: log.fielding_pts || 0, pred: log.prediction_points || 0,
      };
    });
  },

  _calcPredStats(predictions) {
    const done = predictions.filter(p => p.match?.actual_target && p.match?.winner);
    if (!done.length) return { avg_diff: 0, winner_pct: 0, best_streak: 0, total: 0, correct: 0, exact: 0 };
    const diffs = done.map(p => Math.abs((p.target_score || 0) - (p.match.actual_target || 0)));
    const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const correct = done.filter(p => p.predicted_winner === p.match.winner).length;
    let streak = 0, best = 0;
    done.forEach(p => { if (p.predicted_winner === p.match.winner) { streak++; best = Math.max(best, streak); } else streak = 0; });
    return {
      avg_diff: Math.round(avgDiff * 10) / 10, winner_pct: Math.round((correct / done.length) * 100),
      best_streak: best, total: done.length, correct,
      exact: done.filter(p => Math.abs((p.target_score || 0) - (p.match.actual_target || 0)) === 0).length,
    };
  },

  _calcPlayerStats(breakdown) {
    const pts = {};
    breakdown.forEach(log => {
      (log.breakdown?.players || []).forEach(p => {
        if (!pts[p.name]) pts[p.name] = { name: p.name, total: 0, bat: 0, bowl: 0, fld: 0, bon: 0, matches: 0 };
        pts[p.name].total += p.final || 0; pts[p.name].bat += p.bat || 0; pts[p.name].bowl += p.bowl || 0;
        pts[p.name].fld += p.fld || 0; pts[p.name].bon += p.bon || 0; pts[p.name].matches += 1;
      });
    });
    const list = Object.values(pts).sort((a, b) => b.total - a.total);
    return { top: list.slice(0, 3), worst: list.length > 1 ? list.slice(-2).reverse() : [], all: list };
  },

  _calcImpactStats(breakdown, impactUsage) {
    let totalPts = 0;
    const picks = [];
    breakdown.forEach(log => {
      const ip = log.breakdown?.players?.find(p => p.isImpact);
      if (ip) { totalPts += ip.final || 0; picks.push({ name: ip.name, pts: ip.final || 0, match: log.match?.match_title }); }
    });
    picks.sort((a, b) => b.pts - a.pts);
    return { total_pts: totalPts, uses: impactUsage.length, remaining: Math.max(0, 8 - impactUsage.length), best_picks: picks.slice(0, 3) };
  },

  _calcStreaks(predictions) {
    const done = predictions.filter(p => p.match?.winner);
    let streak = 0, max = 0;
    done.forEach(p => { if (p.predicted_winner === p.match.winner) { streak++; max = Math.max(max, streak); } else streak = 0; });
    return { current: streak, max };
  },

  // ══════════════════════════════════════════════════════════════════
  //  MATCH CENTER
  // ══════════════════════════════════════════════════════════════════
  async fetchMatchCenter(matchId) {
    const [match, preds, lb] = await Promise.all([
      this.fetchMatch(matchId), this.fetchAllPredictions(matchId), this.fetchMatchLeaderboard(matchId),
    ]);
    const wc = {};
    let targetSum = 0;
    preds.forEach(p => {
      if (p.predicted_winner) wc[p.predicted_winner] = (wc[p.predicted_winner] || 0) + 1;
      if (p.target_score)     targetSum += Number(p.target_score);
    });
    const mostPicked = Object.entries(wc).sort((a, b) => b[1] - a[1])[0]?.[0];
    return {
      match, predictions: preds, leaderboard: lb,
      summary: {
        total_preds: preds.length, avg_target: preds.length ? Math.round(targetSum / preds.length) : null,
        most_picked: mostPicked, winner_counts: wc,
      },
    };
  },

  // ══════════════════════════════════════════════════════════════════
  //  BLOGS  — draft / review / published flow + AI generation
  // ══════════════════════════════════════════════════════════════════
  async fetchBlogs({ limit = 20, category = null, publishedOnly = true, status = null } = {}) {
    let q = sb.from('blogs')
      .select('id,title,slug,excerpt,category,cover_image,views,created_at,author_name,is_published,status,ai_generated')
      .order('created_at', { ascending: false }).limit(limit);
    if (publishedOnly) q = q.eq('status', 'published');
    else if (status)   q = q.eq('status', status);
    if (category) q = q.eq('category', category);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  async fetchBlog(slugOrId, isAdmin) {
    const { data, error } = await sb.from('blogs').select('*')
      .or('slug.eq.' + slugOrId + ',id.eq.' + slugOrId).maybeSingle();
    if (error) throw error;
    if (data && !isAdmin) {
      await sb.from('blogs').update({ views: (data.views || 0) + 1 }).eq('id', data.id).then(() => {});
    }
    return data;
  },

  async upsertBlog(blog) {
    const { data: before } = blog.id
      ? await sb.from('blogs').select('*').eq('id', blog.id).maybeSingle()
      : { data: null };
    const { data, error } = await sb.from('blogs').upsert(blog, { onConflict: 'id' }).select().single();
    if (error) throw error;
    await this._log('blog_edit', 'blog', data.id, before, data);
    return data;
  },

  async publishBlog(blogId, reviewerName) {
    const { data: before } = await sb.from('blogs').select('*').eq('id', blogId).maybeSingle();
    const { data, error } = await sb.from('blogs').update({
      status: 'published', is_published: true,
      reviewed_by: reviewerName || 'admin', reviewed_at: new Date().toISOString(),
    }).eq('id', blogId).select().single();
    if (error) throw error;
    await this._log('blog_published', 'blog', blogId, before, data);
    return data;
  },

  async unpublishBlog(blogId) {
    const { error } = await sb.from('blogs').update({ status: 'draft', is_published: false }).eq('id', blogId);
    if (error) throw error;
  },

  async generateAIBlog({ title, category, context }) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514', max_tokens: 1000,
        messages: [{
          role: 'user',
          content: 'Write a short, engaging IPL fantasy cricket blog post.\nTitle: "' + title + '"\nCategory: ' + category + '\nContext: ' + (context || 'IPL 2026 fantasy cricket league') + '\nFormat: Plain text with paragraph breaks. 150-250 words. Exciting, fan-focused tone.',
        }]
      })
    });
    const result = await response.json();
    const content = result.content?.[0]?.text || 'Could not generate content.';
    const { data, error } = await sb.from('blogs').insert({
      title, category: category || 'general', content,
      status: 'draft', is_published: false, ai_generated: true,
      author_name: 'AI Assistant', excerpt: content.substring(0, 120) + '...',
    }).select().single();
    if (error) throw error;
    return data;
  },

  async deleteBlog(blogId) {
    const { data: before } = await sb.from('blogs').select('*').eq('id', blogId).maybeSingle();
    const { error } = await sb.from('blogs').delete().eq('id', blogId);
    if (error) throw error;
    await this._log('blog_deleted', 'blog', blogId, before, null);
  },

  // ══════════════════════════════════════════════════════════════════
  //  BADGES
  // ══════════════════════════════════════════════════════════════════
  async fetchUserBadges(teamId) {
    const { data, error } = await sb.from('user_badges')
      .select('*,badge:badge_definitions(id,name,description,icon,color)')
      .eq('fantasy_team_id', teamId).order('earned_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async awardBadge(teamId, badgeId) {
    await sb.from('user_badges').upsert({ fantasy_team_id: teamId, badge_id: badgeId }, { onConflict: 'fantasy_team_id,badge_id' });
  },

  /* ── Impact Player (Fixed-Role Activation System) ── */
  async fetchImpactActivation(teamId, matchId) {
    const { data, error } = await sb.from('impact_activations')
      .select('is_active').eq('fantasy_team_id', teamId).eq('match_id', matchId).maybeSingle();
    if (error) throw error;
    return !!data?.is_active;
  },

  async fetchImpactStats(teamId) {
    const { count, error } = await sb.from('impact_activations')
      .select('*', { count: 'exact', head: true }).eq('fantasy_team_id', teamId).eq('is_active', true);
    if (error) throw error;
    return { used: count || 0, total: 8 };
  },

  async submitImpactActivation(teamId, matchId, isActive) {
    if (isActive) {
      const stats = await this.fetchImpactStats(teamId);
      if (stats.used >= stats.total) throw new Error('Maximum tournament uses (8) reached.');
    }
    const { error } = await sb.from('impact_activations')
      .upsert({ fantasy_team_id: teamId, match_id: matchId, is_active: isActive }, { onConflict: 'fantasy_team_id,match_id' });
    if (error) throw error;
    return true;
  },

  async checkAndAwardBadges(teamId) {
    try {
      const [breakdown, preds, existing] = await Promise.all([
        this.fetchPointsBreakdown(teamId), this.fetchMyPredictions(teamId),
        this.fetchUserBadges(teamId),
      ]);
      const earned = new Set(existing.map(b => b.badge_id));
      const predStats = this._calcPredStats(preds);
      if (!earned.has('perfect_pred') && preds.some(p => p.match?.actual_target && Number(p.target_score) === Number(p.match.actual_target))) await this.awardBadge(teamId, 'perfect_pred');
      if (!earned.has('streak_3') && predStats.best_streak >= 3) await this.awardBadge(teamId, 'streak_3');
      if (!earned.has('streak_5') && predStats.best_streak >= 5) await this.awardBadge(teamId, 'streak_5');
      if (!earned.has('impact_master') && breakdown.some(log => (log.breakdown?.players || []).some(p => p.isImpact && (p.final || 0) >= 300))) await this.awardBadge(teamId, 'impact_master');
      if (!earned.has('captain_king') && breakdown.some(log => (log.breakdown?.players || []).some(p => p.isCaptain && (p.final || 0) >= 200))) await this.awardBadge(teamId, 'captain_king');
    } catch (e) { console.warn('[Badges]', e.message); }
  },

  // ══════════════════════════════════════════════════════════════════
  //  MISC
  // ══════════════════════════════════════════════════════════════════
async fetchTeams() {
  const { data, error } = await sb.from('fantasy_teams').select('id,team_name,owner_name').order('team_name');
  if (error) throw error;
  return data || [];
},

// ----------------------------------------------------------
//  MATCH OPEN / LOCK HELPERS  (replaces old isMatchOpen)
// ----------------------------------------------------------

/**
 * Returns the effective lock timestamp for a match.
 * Priority: explicit lock_time → deadline_time + 5min → match_date + auto_lock_mins + 5min
 */
getLockTime(match) {
    if (!match) return null;
    if (match.lock_time)     return new Date(match.lock_time);
    if (match.deadline_time) return new Date(new Date(match.deadline_time).getTime() + 5 * 60 * 1000);
    // Fallback: if deadline_time is missing, use match start + auto_lock_mins + 5 min
    if (match.match_date) {
      const mins = Number(match.auto_lock_mins || 15);
      return new Date(new Date(match.match_date).getTime() + (mins * 60 * 1000) + (5 * 60 * 1000));
    }
    return null;
  },

  /**
   * True when predictions are still editable.
   * Respects: abandoned, completed, is_locked, deadline/lock_time.
   */
  isPredOpen(match) {
    if (!match) return false;
    if (match.is_locked || match._client_locked) return false;
    const s = match.status;
    if (s === 'abandoned' || s === 'completed' || s === 'processed') return false;
    const lock = this.getLockTime(match);
    if (lock && lock <= new Date()) return false;
    return true;
  },

  /** Seconds until lock; null if no deadline. */
  secondsToLock(match) {
    const lock = this.getLockTime(match);
    if (!lock) return null;
    return Math.floor((lock - new Date()) / 1000);
  },

  // ----------------------------------------------------------
  //  PREDICTION CRUD  (enhanced)
  // ----------------------------------------------------------

  /**
   * Submit or update a prediction.
   * Validates: lock state, duplicate prevention, target range.
   */
  async submitPrediction({ matchId, teamId, targetScore, winner }, match) {
    // Always fetch fresh match state before writing
    const freshMatch = match || await this.fetchMatch(matchId);
    if (!freshMatch) throw new Error('Match not found.');

    if (!this.isPredOpen(freshMatch)) {
      throw new Error('Predictions are locked for this match.');
    }
    if (freshMatch.status === 'abandoned') {
      throw new Error('This match was abandoned — no predictions accepted.');
    }
    if (!targetScore || targetScore < 50 || targetScore > 500) {
      throw new Error('Target score must be between 50 and 500.');
    }
    if (!winner) {
      throw new Error('Please select a predicted winner.');
    }

    const { data, error } = await sb.from('predictions').upsert({
      match_id:          matchId,
      fantasy_team_id:   teamId,
      target_score:      parseInt(targetScore),
      predicted_winner:  winner,
      submitted_at:      new Date().toISOString(),
      is_locked:         false,
    }, { onConflict: 'match_id,fantasy_team_id' }).select().single();

    if (error) throw error;
    await this._log('prediction_submitted', 'team', teamId, null, data);
    return data;
  },

  // ----------------------------------------------------------
  //  IMPACT ACTIVATION  (abandoned-match aware)
  // ----------------------------------------------------------

  /**
   * Fetch current activation for a specific match.
   */
  async fetchImpactActivation(teamId, matchId) {
    const { data, error } = await sb.from('impact_activations')
      .select('is_active')
      .eq('fantasy_team_id', teamId)
      .eq('match_id', matchId)
      .maybeSingle();
    if (error) throw error;
    return !!data?.is_active;
  },

  /**
   * Fetch season-wide impact stats.
   * Abandoned matches are excluded from used count.
   */
  async fetchImpactStats(teamId) {
    // Join with matches to exclude abandoned
    const { data, error } = await sb.from('impact_activations')
      .select('id, is_active, match:matches(status)')
      .eq('fantasy_team_id', teamId)
      .eq('is_active', true);
    if (error) throw error;

    const rows = data || [];
    // Only count non-abandoned matches
    const used = rows.filter(function(r) {
      return r.match && r.match.status !== 'abandoned';
    }).length;

    return { used, total: 8, remaining: Math.max(0, 8 - used) };
  },

  /**
   * Submit (or update) impact activation for a match.
   * Validates: limit (excluding abandoned), match open state.
   */
  async submitImpactActivation(teamId, matchId, isActive) {
    if (isActive) {
      const stats = await this.fetchImpactStats(teamId);
      if (stats.used >= stats.total) {
        throw new Error('Impact Player limit reached (8/8 used across non-abandoned matches).');
      }
    }
    const { error } = await sb.from('impact_activations').upsert(
      { fantasy_team_id: teamId, match_id: matchId, is_active: isActive },
      { onConflict: 'fantasy_team_id,match_id' }
    );
    if (error) throw error;
    await this._log('impact_activation', 'team', teamId, null, { matchId, isActive });
    return true;
  },

  // ----------------------------------------------------------
  //  PREDICTION POINTS  (DLS / abandoned aware)
  // ----------------------------------------------------------

  /**
   * Calculate prediction points for a completed match.
   * Handles: DLS revised targets, abandoned (zero), super-over winner.
   */
  calcPredictionPoints(pred, match) {
    if (!pred || !match) return 0;

    // Abandoned → always 0, no exceptions
    if (match.status === 'abandoned' || match.is_abandoned) return 0;

    let pts = 0;
    // For DLS matches, actual_target is the DLS-revised target
    const diff = Math.abs(Number(pred.target_score || 0) - Number(match.actual_target || 0));
    if      (diff === 0) pts += 250;
    else if (diff === 1) pts += 150;
    else if (diff <= 5)  pts += 100;
    else if (diff <= 10) pts += 50;

    // Winner: super over / tie breaker — match.winner is always the official winner
    if (pred.predicted_winner === match.winner) pts += 25;

    return pts;
  },

  // ----------------------------------------------------------
  //  ADMIN: MATCH MANAGEMENT
  // ----------------------------------------------------------

  /**
   * Update match deadline and/or lock_time.
   * Admin use only.
   */
  async extendDeadline(matchId, newDeadlineIso, autoLockMins) {
    const mins = autoLockMins || 5;
    const newLock = new Date(new Date(newDeadlineIso).getTime() + mins * 60 * 1000).toISOString();
    const { data: before } = await sb.from('matches').select('*').eq('id', matchId).maybeSingle();
    const { data, error } = await sb.from('matches').update({
      deadline_time: newDeadlineIso,
      lock_time:     newLock,
      is_locked:     false,
      status:        'upcoming',
    }).eq('id', matchId).select().single();
    if (error) throw error;
    await this._log('deadline_extended', 'match', matchId, before, data);
    return data;
  },

  /**
   * Reopen predictions after lock (admin override).
   * Resets is_locked and clears lock_time to a future value.
   */
  async reopenPredictions(matchId, newDeadlineIso) {
    const { data: before } = await sb.from('matches').select('*').eq('id', matchId).maybeSingle();
    const deadline = newDeadlineIso || new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const lockTime = new Date(new Date(deadline).getTime() + 5 * 60 * 1000).toISOString();
    const { data, error } = await sb.from('matches').update({
      is_locked:     false,
      deadline_time: deadline,
      lock_time:     lockTime,
      status:        'upcoming',
    }).eq('id', matchId).select().single();
    if (error) throw error;
    await this._log('predictions_reopened', 'match', matchId, before, data);
    return data;
  },

  /**
   * Mark match as abandoned.
   * Impact activations for this match are NOT counted against the 8-use limit
   * (handled automatically by fetchImpactStats filtering on match status).
   */
  async markMatchAbandoned(matchId) {
    const { data: before } = await sb.from('matches').select('*').eq('id', matchId).maybeSingle();
    const { data, error } = await sb.from('matches').update({
      status:       'abandoned',
      is_abandoned: true,
      is_locked:    true,
    }).eq('id', matchId).select().single();
    if (error) throw error;
    await this._log('match_abandoned', 'match', matchId, before, data);
    return data;
  },

  /**
   * Mark DLS applied and set the revised target.
   */
  async setDLSTarget(matchId, revisedTarget) {
    const { data: before } = await sb.from('matches').select('*').eq('id', matchId).maybeSingle();
    const { data, error } = await sb.from('matches').update({
      is_dls_applied: true,
      actual_target:  parseInt(revisedTarget),
    }).eq('id', matchId).select().single();
    if (error) throw error;
    await this._log('dls_target_set', 'match', matchId, before, data);
    return data;
  },

  /**
   * Set match result (winner + target). Locks match automatically.
   */
  async setMatchResult(matchId, { winner, actualTarget, isDLS }) {
    const { data: before } = await sb.from('matches').select('*').eq('id', matchId).maybeSingle();
    const payload = {
      winner:         winner,
      actual_target:  parseInt(actualTarget) || null,
      is_locked:      true,
      status:         'completed',
    };
    if (isDLS !== undefined) payload.is_dls_applied = !!isDLS;
    const { data, error } = await sb.from('matches').update(payload).eq('id', matchId).select().single();
    if (error) throw error;
    await this._log('match_result_set', 'match', matchId, before, data);
    return data;
  },

  // ----------------------------------------------------------
  //  RECALCULATION (abandoned-aware)
  // ----------------------------------------------------------

  /**
   * Enhanced recalculation that skips awarding prediction points
   * for abandoned matches and ensures impact usages are refunded.
   */
  async recalculateMatch(matchId, onLog) {
    onLog?.('Fetching match details...');
    const match = await this.fetchMatch(matchId);
    if (!match) throw new Error('Match not found');

    if (match.status === 'abandoned' || match.is_abandoned) {
      onLog?.('Match is ABANDONED — prediction points will be 0 for all teams.', 'good');
    }
    if (match.is_dls_applied) {
      onLog?.('DLS applied — using revised target: ' + match.actual_target, 'good');
    }

    onLog?.('Deleting existing points for this match...');
    const { error: delErr } = await sb.from('points_log').delete().eq('match_id', matchId);
    if (delErr) throw delErr;

    onLog?.('Recalculating...');
    const result = await this.calculateMatchPoints(matchId, onLog);
    try { await sb.rpc('refresh_match_center', { p_match_id: matchId }); } catch(_) {}
    onLog?.('Done! Leaderboard refreshed.', 'good');
    return result;
  },

  // ----------------------------------------------------------
  //  ADMIN PANEL: FETCH PREDICTIONS FOR A MATCH
  // ----------------------------------------------------------

  /**
   * Fetch all predictions with team info for admin review.
   */
  async fetchAllPredictions(matchId) {
    const { data, error } = await sb.from('predictions')
      .select('*, team:fantasy_teams(team_name, owner_name)')
      .eq('match_id', matchId)
      .order('submitted_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  /**
   * Admin: lock all predictions for a match immediately.
   */
  async lockAllPredictions(matchId) {
    const { error } = await sb.from('predictions')
      .update({ is_locked: true })
      .eq('match_id', matchId);
    if (error) throw error;
    await this.lockMatch(matchId);
    await this._log('predictions_locked', 'match', matchId, null, { matchId });
  },
};

// Expose for inline usage and cross-file access.
window.API = API;
