// ─────────────────────────────────────────────────────────────
//  ui.js — BFL Fantasy IPL 2026 v2
//  Toast · Skeleton · Theme · Countdown · Charts · Utilities
// ─────────────────────────────────────────────────────────────

const UI = {
  TEAM_CODES: {
    'CHENNAI SUPER KINGS':'CSK','DELHI CAPITALS':'DC','GUJARAT TITANS':'GT',
    'KOLKATA KNIGHT RIDERS':'KKR','LUCKNOW SUPER GIANTS':'LSG','MUMBAI INDIANS':'MI',
    'PUNJAB KINGS':'PBKS','RAJASTHAN ROYALS':'RR','ROYAL CHALLENGERS BENGALURU':'RCB',
    'SUNRISERS HYDERABAD':'SRH','SUPREME RAJAS':'SURA'
  },
  tCode: function(name) { return this.TEAM_CODES[((name||'').toUpperCase())] || null; },
  tShort: function(name) {
    var c = this.tCode(name);
    return c || (name||'').split(' ').map(function(w){return w[0];}).join('').toUpperCase();
  },
  rankBadge(curr, prev) {
    if (!prev || curr === prev) return '<span class="rk-neutral">—</span>';
    const diff = prev - curr; // positive means rank improved (decreased)
    if (diff > 0) return `<span class="rk-up">▲${diff}</span>`;
    return `<span class="rk-down">▼${Math.abs(diff)}</span>`;
  },

  // ════════════════════════════════════════════════════════════
  //  THEME — dark / light toggle
  // ════════════════════════════════════════════════════════════
  _theme: 'dark',

  initTheme() {
    const saved = localStorage.getItem('bfl_theme') || 'dark';
    this.setTheme(saved, false);
  },

  setTheme(theme, save = true) {
    this._theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    if (save) localStorage.setItem('bfl_theme', theme);
    // Update toggle buttons
    document.querySelectorAll('.theme-toggle').forEach(btn => {
      btn.innerHTML = theme === 'dark'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>';
    });
  },

  toggleTheme() {
    this.setTheme(this._theme === 'dark' ? 'light' : 'dark');
  },

  // ════════════════════════════════════════════════════════════
  //  TOAST
  // ════════════════════════════════════════════════════════════
  toast(msg, type = 'info', duration = 4500) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const icons = {
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
      error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      warn:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="17" r="1"/></svg>',
      info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><circle cx="12" cy="8" r="1"/></svg>',
    };
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.style.setProperty('--dur', duration + 'ms');
    t.innerHTML =
      `<span class="toast-icon">${icons[type]||icons.info}</span>` +
      `<span class="toast-msg">${this.esc(msg)}</span>` +
      `<button class="toast-close" onclick="this.closest('.toast').remove()">×</button>` +
      `<div class="toast-bar"></div>`;
    container.appendChild(t);
    requestAnimationFrame(() => t.classList.add('visible'));
    // Remove old toasts if too many
    while (container.children.length > 5) container.removeChild(container.firstChild);
    setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 400); }, duration);
  },

  // ════════════════════════════════════════════════════════════
  //  COUNTDOWN TIMERS
  // ════════════════════════════════════════════════════════════
  _countdownTimers: {},

  startCountdown(elementId, deadlineIso, onExpire) {
    this.stopCountdown(elementId);
    const el = document.getElementById(elementId);
    if (!el) return;

    const tick = () => {
      const secs = Math.floor((new Date(deadlineIso) - new Date()) / 1000);
      if (secs <= 0) {
        el.textContent = 'Locked';
        el.className   = (el.className || '') + ' countdown-expired';
        this.stopCountdown(elementId);
        onExpire?.();
        return;
      }
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = secs % 60;
      el.textContent = h > 0
        ? `${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`
        : `${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;
      el.className = secs < 300 ? 'countdown countdown-urgent' : 'countdown';
    };
    tick();
    this._countdownTimers[elementId] = setInterval(tick, 1000);
  },

  stopCountdown(elementId) {
    if (this._countdownTimers[elementId]) {
      clearInterval(this._countdownTimers[elementId]);
      delete this._countdownTimers[elementId];
    }
  },

  // ════════════════════════════════════════════════════════════
  //  MODALS
  // ════════════════════════════════════════════════════════════
  showModal({ title, content, customClass = '' }) {
    this.closeActiveModal();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay ' + customClass;
    overlay.id = 'active-modal-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) this.closeActiveModal(); };
    overlay.innerHTML = `
      <div class="modal-card bounce-in">
        <div class="modal-header">
          <div class="modal-title">${title}</div>
          <button class="modal-close" onclick="UI.closeActiveModal()">×</button>
        </div>
        <div class="modal-body">${content}</div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
  },

  closeActiveModal() {
    const el = document.getElementById('active-modal-overlay');
    if (el) {
      el.classList.add('fade-out');
      setTimeout(() => {
        el.remove();
        document.body.style.overflow = '';
      }, 200);
    }
  },

  // ════════════════════════════════════════════════════════════
  //  MINI CHART ENGINE (pure canvas, no dependencies)
  // ════════════════════════════════════════════════════════════

  // Line chart: data = [{label, value}] or array of numbers
  drawLineChart(canvasId, data, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx    = canvas.getContext('2d');
    const W = canvas.width = canvas.offsetWidth || 400;
    const H = canvas.height = options.height || 180;
    const pad = options.pad || { top:20, right:20, bottom:40, left:52 };
    const vals = data.map(d => typeof d === 'number' ? d : d.value);
    const labels = data.map((d,i) => typeof d === 'number' ? (i+1) : (d.label || ''));
    const minV = Math.min(...vals, 0), maxV = Math.max(...vals, 1);
    const range = maxV - minV || 1;

    // Background
    ctx.clearRect(0,0,W,H);

    // Grid lines
    ctx.strokeStyle = options.gridColor || 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (H - pad.top - pad.bottom) * (1 - i/4);
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W-pad.right, y); ctx.stroke();
      const v = Math.round(minV + (range * i/4));
      ctx.fillStyle = options.labelColor || 'rgba(148,163,184,0.7)';
      ctx.font = '11px Barlow Condensed, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(v, pad.left - 6, y + 4);
    }

    if (!vals.length) return;

    const xStep = (W - pad.left - pad.right) / Math.max(vals.length - 1, 1);
    const toX = i  => pad.left + i * xStep;
    const toY = v  => pad.top + (H - pad.top - pad.bottom) * (1 - (v - minV) / range);

    // Area fill
    const accent = options.color || '#f0b429';
    const grad   = ctx.createLinearGradient(0, pad.top, 0, H-pad.bottom);
    grad.addColorStop(0, accent + '44');
    grad.addColorStop(1, accent + '04');
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(vals[0]));
    vals.forEach((v,i) => { if (i > 0) ctx.lineTo(toX(i), toY(v)); });
    ctx.lineTo(toX(vals.length-1), H-pad.bottom);
    ctx.lineTo(toX(0), H-pad.bottom);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(vals[0]));
    vals.forEach((v,i) => { if (i > 0) ctx.lineTo(toX(i), toY(v)); });
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.5;
    ctx.lineJoin  = 'round';
    ctx.stroke();

    // Points + labels
    vals.forEach((v, i) => {
      const x = toX(i), y = toY(v);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI*2);
      ctx.fillStyle = accent;
      ctx.fill();
      ctx.strokeStyle = options.bgColor || '#0c0f1a';
      ctx.lineWidth = 2;
      ctx.stroke();
      // x-axis label
      if (labels[i]) {
        ctx.fillStyle = options.labelColor || 'rgba(148,163,184,0.8)';
        ctx.font = '10px Barlow Condensed, sans-serif';
        ctx.textAlign = 'center';
        const lbl = String(labels[i]).substring(0,6);
        ctx.fillText(lbl, x, H - pad.bottom + 16);
      }
    });
  },

  // Bar chart
  drawBarChart(canvasId, data, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W   = canvas.width  = canvas.offsetWidth || 400;
    const H   = canvas.height = options.height || 160;
    const pad = { top:20, right:20, bottom:40, left:52 };
    const vals   = data.map(d => typeof d === 'number' ? d : d.value);
    const labels = data.map((d,i) => typeof d === 'number' ? (i+1) : (d.label || ''));
    const maxV   = Math.max(...vals, 1);
    ctx.clearRect(0,0,W,H);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i=0;i<=4;i++) {
      const y = pad.top + (H-pad.top-pad.bottom)*(1-i/4);
      ctx.beginPath(); ctx.moveTo(pad.left,y); ctx.lineTo(W-pad.right,y); ctx.stroke();
      ctx.fillStyle='rgba(148,163,184,0.7)'; ctx.font='11px Barlow Condensed,sans-serif'; ctx.textAlign='right';
      ctx.fillText(Math.round(maxV*i/4), pad.left-6, y+4);
    }

    const barW  = Math.min(32, (W-pad.left-pad.right)/vals.length*0.65);
    const xStep = (W-pad.left-pad.right)/Math.max(vals.length,1);
    const colors = options.colors || [options.color || '#f0b429'];

    vals.forEach((v,i) => {
      const x = pad.left + i*xStep + xStep/2 - barW/2;
      const h = (v/maxV)*(H-pad.top-pad.bottom);
      const y = H-pad.bottom-h;
      const col = colors[i % colors.length];
      const grad = ctx.createLinearGradient(0,y,0,H-pad.bottom);
      grad.addColorStop(0, col+'ee');
      grad.addColorStop(1, col+'55');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x,y,barW,h,4) : ctx.rect(x,y,barW,h);
      ctx.fill();
      ctx.fillStyle='rgba(148,163,184,0.8)'; ctx.font='10px Barlow Condensed,sans-serif'; ctx.textAlign='center';
      if (labels[i]) ctx.fillText(String(labels[i]).substring(0,5), pad.left+i*xStep+xStep/2, H-pad.bottom+16);
    });
  },

  // Donut chart
  drawDonutChart(canvasId, slices, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx  = canvas.getContext('2d');
    const size = options.size || Math.min(canvas.offsetWidth, 160);
    canvas.width = canvas.height = size;
    const cx = size/2, cy = size/2, r = size/2 - 8, inner = r * 0.62;
    ctx.clearRect(0,0,size,size);
    const total  = slices.reduce((s,sl) => s + sl.value, 0) || 1;
    let start    = -Math.PI/2;
    slices.forEach(sl => {
      const sweep = (sl.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx,cy);
      ctx.arc(cx,cy,r,start,start+sweep);
      ctx.closePath();
      ctx.fillStyle = sl.color || '#f0b429';
      ctx.fill();
      start += sweep;
    });
    // Hole
    ctx.beginPath();
    ctx.arc(cx,cy,inner,0,Math.PI*2);
    ctx.fillStyle = options.bgColor || '#0c0f1a';
    ctx.fill();
    // Center label
    if (options.centerLabel) {
      ctx.fillStyle = '#f0f4ff'; ctx.font = `bold ${Math.round(size*0.12)}px Barlow Condensed,sans-serif`; ctx.textAlign = 'center';
      ctx.fillText(options.centerLabel, cx, cy + size*0.04);
    }
  },

  // ════════════════════════════════════════════════════════════
  //  CONFIRMATION MODAL
  // ════════════════════════════════════════════════════════════
  _confirmCb: null,
  
  showConfirm(opts) {
    let modal = document.getElementById('confirm-modal');
    if (!modal) {
      document.body.insertAdjacentHTML('beforeend', `
        <div class="modal-overlay" id="confirm-modal" style="display:none; z-index:9999;">
          <div class="modal-box" style="text-align:center;">
            <div class="confirm-icon" id="confirm-icon" style="font-size:42px;margin-bottom:12px;display:block;">⚠️</div>
            <div class="modal-title" id="confirm-title" style="margin-bottom:10px;">Are you sure?</div>
            <div id="confirm-msg" style="font-size:14px;color:var(--text2);margin-bottom:8px;"></div>
            <div id="confirm-consequence" style="font-size:12px;color:var(--text3);font-style:italic;margin-bottom:20px;display:block;"></div>
            <div style="display:flex;gap:10px;justify-content:center;">
              <button class="btn btn-danger" id="confirm-ok-btn">Confirm</button>
              <button class="btn btn-ghost" id="confirm-cancel-btn">Cancel</button>
            </div>
          </div>
        </div>
      `);
      modal = document.getElementById('confirm-modal');
      document.getElementById('confirm-cancel-btn').onclick = () => this.closeConfirm();
    }

    document.getElementById('confirm-icon').innerHTML = opts.icon || '⚠️';
    document.getElementById('confirm-title').textContent = opts.title || 'Are you sure?';
    document.getElementById('confirm-msg').textContent = opts.msg || '';
    document.getElementById('confirm-consequence').textContent = opts.consequence || '';
    
    const btn = document.getElementById('confirm-ok-btn');
    btn.textContent = opts.okLabel || 'Confirm';
    btn.className = `btn ${opts.okClass || 'btn-danger'}`;
    
    this._confirmCb = opts.onOk || null;
    btn.onclick = () => {
      this.closeConfirm();
      if (this._confirmCb) this._confirmCb();
    };
    
    modal.style.display = 'flex';
    // Accessibility: prevent background scroll
    document.body.style.overflow = 'hidden';
  },

  closeConfirm() {
    const modal = document.getElementById('confirm-modal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
  },

  // ════════════════════════════════════════════════════════════
  //  UTILITIES
  // ════════════════════════════════════════════════════════════
  fmt(n, dec = 0)  { return Number(n||0).toFixed(dec); },
  fmtDate(iso)     { if (!iso) return '—'; return new Date(iso).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); },
  shortDate: function(d) { if (!d) return '—'; var date = new Date(d); return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); },

  getOwnerName: function(teamName) {
    const owners = {
      'GUJARAT TITANS': 'ABHISHEK',
      'MUMBAI INDIANS': 'ADHESH',
      'PUNJAB KINGS': 'ASHIK',
      'CHENNAI SUPER KINGS': 'GOKUL',
      'KOLKATA KNIGHT RIDERS': 'JAIAKASH',
      'DELHI CAPITALS': 'PIERRS',
      'RAJASTHAN ROYALS': 'SANTHOSH',
      'SUNRISERS HYDERABAD': 'SANTO',
      'ROYAL CHALLENGERS BENGALURU': 'SURE',
      'SUPREME RAJAS': 'SURIYA',
      'LUCKNOW SUPER GIANTS': 'VICKY'
    };
    return owners[(teamName || '').toUpperCase()] || 'Team Manager';
  },
  esc(s)           { return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); },
  ordinal(n)       { const s=['th','st','nd','rd'],v=n%100; return n+(s[(v-20)%10]||s[v]||s[0]); },
  navigate(url)    { document.body.style.opacity='0'; document.body.style.transition='opacity .2s ease'; setTimeout(()=>{window.location.href=url;},210); },
  show(id)         { const e=document.getElementById(id); if(e) e.style.display=''; },
  hide(id)         { const e=document.getElementById(id); if(e) e.style.display='none'; },
  el(id)           { return document.getElementById(id); },
  qs(sel, ctx)     { return (ctx||document).querySelector(sel); },

  countUp(el, target, dur = 1200) {
    if (!el) return;
    const start = Date.now();
    const tick  = () => {
      const prog = Math.min((Date.now()-start)/dur, 1);
      const ease = 1 - Math.pow(1-prog, 3);
      el.textContent = Math.round(target * ease);
      if (prog < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  },

  stagger(parent, delay = 70) {
    if (!parent) return;
    Array.from(parent.children).forEach((child, i) => {
      child.style.opacity = '0';
      child.style.transform = 'translateY(14px)';
      setTimeout(() => {
        child.style.transition = 'opacity .32s ease, transform .32s ease';
        child.style.opacity = '1';
        child.style.transform = 'translateY(0)';
      }, i * delay);
    });
  },

  roleBadge(role) {
    const map = {
      'Batter':        {cls:'rt-bat',  s:'BAT'},
      'Bowler':        {cls:'rt-bowl', s:'BOWL'},
      'All-Rounder':   {cls:'rt-ar',   s:'AR'},
      'Wicket-Keeper': {cls:'rt-wk',   s:'WK'},
    };
    const r = map[role] || {cls:'', s:(role||'—').substring(0,4)};
    return `<span class="role-tag ${r.cls}">${r.s}</span>`;
  },

  deadlineBadge(match, onExpireId) {
    if (!match) return '';
    if (!API.isMatchOpen(match)) {
      return '<span class="match-status status-locked">🔒 Locked</span>';
    }
    const secs = API.secondsToDeadline(match);
    if (secs === null) return '<span class="match-status status-open">Open</span>';
    const cls = secs < 300 ? 'status-locked' : 'status-open';
    const id  = 'cd-' + (match.id||'').substring(0,8);
    // Start countdown after render
    setTimeout(() => this.startCountdown(id, match.deadline_time, onExpireId ? () => {
      const el2 = document.getElementById(onExpireId); if (el2) el2.classList.add('locked');
    } : null), 50);
    return `<span class="match-status ${cls}"><span class="countdown" id="${id}">…</span></span>`;
  },

  getTeamLogo(teamName) {
    if (!teamName) return null;
    const codes = {
      CHENNAISUPERKINGS:'CSK', DELHICAPITALS:'DC', GUJARATTITANS:'GT',
      KOLKATAKNIGHTRIDERS:'KKR', LUCKNOWSUPERGIANTS:'LSG', MUMBAIINDIANS:'MI',
      PUNJABKINGS:'PBKS', RAJASTHANROYALS:'RR', ROYALCHALLENGERSBENGALURU:'RCB',
      SUNRISERSHYDERABAD:'SRH', SUPREMERAJAS:'SURA'
    };
    // Match common abbreviations directly too
    if (codes[teamName.toUpperCase()]) return 'images/teams/' + codes[teamName.toUpperCase()] + 'outline.png';
    const clean = String(teamName).toUpperCase().replace(/[^A-Z]/g, '');
    const code = codes[clean] || (Object.values(codes).includes(clean) ? clean : null);
    return code ? 'images/teams/' + code + 'outline.png' : null;
  },
};

// Expose for inline handlers (e.g. onclick="UI.toggleTheme()").
// Top-level `const UI` is not a `window` property in browsers.
window.UI = UI;

// PWA Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
