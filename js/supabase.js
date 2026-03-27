// ─────────────────────────────────────────────────────────────
//  js/supabase.js — BFL Fantasy IPL 2026
//
//  HOW TO CONFIGURE:
//  1. Go to supabase.com → your project → Settings → API
//  2. Copy "Project URL" → paste as SUPABASE_URL
//  3. Copy "anon / public" key → paste as SUPABASE_ANON
// ─────────────────────────────────────────────────────────────

const SUPABASE_URL  = 'https://zptzdqswmarqhotnnlrk.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwdHpkcXN3bWFycWhvdG5ubHJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNDc2OTgsImV4cCI6MjA4OTcyMzY5OH0.BLuSuFem2sX08CleGxhfjhBXHmaWxDUfdzTwGaOwIYQ';

// Create and expose the Supabase client
// Both `sb` and `window.sb` are set so all JS files can access it
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession:   true,   // keeps session across page refreshes
    autoRefreshToken: true,   // refreshes JWT before it expires
    storageKey:       'bfl_fantasy_auth', // localStorage key
    storage:          window.localStorage,
  },
  realtime: {
    params: { eventsPerSecond: 2 }
  }
});

// Make accessible globally for all scripts
window.sb   = sb;
window._sb  = sb; // alias

// ─────────────────────────────────────────────────────────────
//  Auth state change listener
//  Redirects to login if session expires mid-session
// ─────────────────────────────────────────────────────────────
sb.auth.onAuthStateChange(function(event, session) {
  if (event === 'SIGNED_OUT' && !window._signOutIntentional) {
    // Session expired — redirect to login
    if (!window.location.pathname.includes('index.html') &&
        !window.location.pathname.endsWith('/') &&
        !window.location.pathname.endsWith('/index')) {
      console.warn('[BFL Auth] Session expired — redirecting to login');
      window.location.href = 'index.html';
    }
  }
});

// ─────────────────────────────────────────────────────────────
//  Helper: expose a flag so Auth.signOut() doesn't
//  trigger the redirect above
// ─────────────────────────────────────────────────────────────
window._signOutIntentional = false;