// ─────────────────────────────────────────────────────────────
//  js/auth.js — BFL Fantasy IPL 2026
//  Handles: session, admin check, team fetch, sign-out
// ─────────────────────────────────────────────────────────────

const Auth = {
  session: null,
  team:    null,

  // ── Get current session from Supabase ──────────────────────
  async getSession() {
    const { data } = await sb.auth.getSession();
    this.session = data.session;
    return data.session;
  },

  // ── Require auth — redirect to login if not signed in ──────
  async requireAuth(redirectTo = 'index.html') {
    const session = await this.getSession();
    if (!session) {
      window.location.href = redirectTo;
      return null;
    }
    return session;
  },

  // ── Check admin status ─────────────────────────────────────
  // Admin = email is admin@bfl.in OR app_metadata.role = 'admin'
  isAdmin(user) {
    if (!user) return false;
    return (
      user.email === 'admin@bfl.in' ||
      (user.app_metadata && user.app_metadata.role === 'admin')
    );
  },

  // ── Fetch fantasy team for a user ─────────────────────────
  // NOTE: Does NOT join auth.users (not allowed from client)
  async fetchTeam(userId) {
    const { data, error } = await sb
      .from('fantasy_teams')
      .select('id, team_name, owner_name, user_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    this.team = data;
    return data;
  },

  // ── Sign out ───────────────────────────────────────────────
  async signOut() {
    window._signOutIntentional = true;
    await sb.auth.signOut();
    this.session = null;
    this.team    = null;
    window.location.href = 'index.html';
  },

  // ── Email convention: team name → auth email ───────────────
  // "Chennai Super Kings" → "chennai_super_kings@bfl.in"
  teamEmail(teamName) {
    return teamName
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '') + '@bfl.in';
  },
};

// Expose globally
window.Auth = Auth;