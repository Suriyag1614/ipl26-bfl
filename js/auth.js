// ─────────────────────────────────────────────────────────────
//  auth.js — BFL Fantasy IPL 2026
// ─────────────────────────────────────────────────────────────

const Auth = {
  session: null,
  team:    null,

  async getSession() {
    const { data } = await sb.auth.getSession();
    this.session = data.session;
    return data.session;
  },

  async requireAuth(redirectTo = 'index.html') {
    const session = await this.getSession();
    if (!session) { window.location.href = redirectTo; return null; }
    return session;
  },

  // Admin = email is admin@bfl.in  OR  app_metadata.role = 'admin'
  // Both checks needed: SQL insert sets raw_app_meta_data but the JS
  // client reads app_metadata from the JWT after login — email is safer.
  isAdmin(user) {
    if (!user) return false;
    return (
      user.email === 'admin@bfl.in' ||
      (user.app_metadata && user.app_metadata.role === 'admin')
    );
  },

  // Fetch fantasy_team WITHOUT joining auth.users (that join is not
  // allowed from the client side and causes 500 errors).
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

  async signOut() {
    await sb.auth.signOut();
    this.session = null;
    this.team    = null;
    window.location.href = 'index.html';
  },

  // "Chennai Super Kings" → "chennai_super_kings@bfl.in"
  teamEmail(teamName) {
    return teamName.toLowerCase().replace(/\s+/g, '_') + '@bfl.in';
  },
};

// Expose for inline handlers / other scripts
window.Auth = Auth;
