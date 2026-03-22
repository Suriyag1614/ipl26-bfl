// ─────────────────────────────────────────────────────────────
//  supabase.js — BFL Fantasy IPL 2026
//  SETUP: Replace values below with your Supabase project details
// ─────────────────────────────────────────────────────────────

const SUPABASE_URL  = 'https://zptzdqswmarqhotnnlrk.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwdHpkcXN3bWFycWhvdG5ubHJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNDc2OTgsImV4cCI6MjA4OTcyMzY5OH0.BLuSuFem2sX08CleGxhfjhBXHmaWxDUfdzTwGaOwIYQ';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'bfl_fantasy_auth'},
});

window._sb = sb;
