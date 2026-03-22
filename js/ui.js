// ─────────────────────────────────────────────────────────────
//  ui.js — BFL Fantasy IPL 2026
// ─────────────────────────────────────────────────────────────

const UI = {

  toast(msg, type, duration) {
    type = type || 'info';
    duration = duration || 4000;
    const container = document.getElementById('toast-container');
    if (!container) return;
    const icons = {
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
      error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      warn:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="17" r="1"/></svg>',
      info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><circle cx="12" cy="8" r="1"/></svg>',
    };
    const t = document.createElement('div');
    t.className = 'toast toast-' + type;
    t.style.setProperty('--dur', duration + 'ms');
    t.innerHTML = '<span class="toast-icon">' + (icons[type] || icons.info) + '</span>' +
      '<span class="toast-msg">' + msg + '</span>' +
      '<button class="toast-close" onclick="this.closest(\'.toast\').remove()">×</button>' +
      '<div class="toast-bar"></div>';
    container.appendChild(t);
    requestAnimationFrame(function(){ t.classList.add('visible'); });
    setTimeout(function(){
      t.classList.remove('visible');
      setTimeout(function(){ if (t.parentNode) t.remove(); }, 350);
    }, duration);
  },

  fmt(n, decimals) {
    decimals = decimals || 0;
    return Number(n || 0).toFixed(decimals);
  },

  fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  },

  shortDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  },

  esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  },

  roleBadge(role) {
    const map = {
      'Batter':        { cls: 'role-bat',  short: 'BAT'  },
      'Bowler':        { cls: 'role-bowl', short: 'BOWL' },
      'All-Rounder':   { cls: 'role-ar',   short: 'AR'   },
      'Wicket-Keeper': { cls: 'role-wk',   short: 'WK'   },
    };
    const r = map[role] || { cls: 'role-other', short: (role || '—').substring(0, 4) };
    return '<span class="role-tag ' + r.cls + '">' + r.short + '</span>';
  },

  iplColor(team) {
    const map = {
      CSK:'#fdb913', MI:'#004ba0', RCB:'#da1818', KKR:'#6a1bac',
      SRH:'#f26522', DC:'#004c93', PBKS:'#ed1b24', RR:'#ea1a85',
      GT:'#1c2c5b',  LSG:'#ff002b', SURA:'#1a3a8a',
    };
    return map[(team || '').toUpperCase()] || '#f0b429';
  },

  ordinal(n) {
    const s = ['th','st','nd','rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  },

  countUp(el, target, duration) {
    if (!el) return;
    duration = duration || 1200;
    const start = Date.now();
    const tick = function() {
      const progress = Math.min((Date.now() - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(target * ease);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  },

  stagger(parent, delay) {
    if (!parent) return;
    delay = delay || 80;
    Array.from(parent.children).forEach(function(child, i) {
      child.style.opacity = '0';
      child.style.transform = 'translateY(16px)';
      setTimeout(function() {
        child.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
        child.style.opacity = '1';
        child.style.transform = 'translateY(0)';
      }, i * delay);
    });
  },

  navigate(url) {
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.22s ease';
    setTimeout(function() { window.location.href = url; }, 220);
  },

  show(id) { const e = document.getElementById(id); if (e) e.style.display = ''; },
  hide(id) { const e = document.getElementById(id); if (e) e.style.display = 'none'; },
  el(id)   { return document.getElementById(id); },
};