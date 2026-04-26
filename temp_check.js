PE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <link rel="manifest" href="manifest.json">
  <link rel="icon" type="image/png" href="images/bfl/bfl-logo.png">
  <meta name="theme-color" content="#f0b429">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>IPL 2026 â€” Season Analytics</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Work+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/styles.css">
  <style>
    .metric-card { background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;text-align:center;transition:all var(--t);animation:fade-up .4s ease both; }
    .metric-card:hover { border-color:var(--border-h);transform:translateY(-2px); }
    .metric-val { font-family:var(--f-display);font-weight:900;font-size:32px;line-height:1;color:var(--accent);margin-bottom:4px; }
    .metric-lbl { font-family:var(--f-ui);font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--text3); }
    .metric-sub { font-size:11px;color:var(--text2);margin-top:3px; }
    .metrics-row { display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-bottom:22px; }
    .player-bar-row { display:flex;align-items:center;gap:10px;margin-bottom:10px; }
    .player-bar-name { font-size:13px;font-weight:600;min-width:90px;max-width:110px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
    .player-bar-track { flex:1;height:8px;background:var(--bg3);border-radius:4px;overflow:hidden; }
    .player-bar-fill { height:100%;border-radius:4px;transition:width 1s ease; }
    .player-bar-pts { font-family:var(--f-mono);font-weight:700;font-size:12px;min-width:40px;text-align:right; }
    .impact-pick-row { display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border); }
    .impact-pick-row:last-child { border-bottom:none; }
    .impact-rank-num { font-family:var(--f-display);font-weight:900;font-size:20px;color:var(--accent);min-width:28px; }
    
    /* KPI & Analytics specific */
    .kpi-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px; }
    .kpi-chip { background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:10px;text-align:center; }
    .kpi-label{ font-size:10px;color:var(--text3);text-transform:uppercase;font-weight:800;letter-spacing:1px;margin-bottom:2px; }
    .kpi-value{ font-family:var(--f-display);font-size:20px;font-weight:900;line-height:1.1; }
    .kpi-sub { font-size:10px;color:var(--text3);margin-top:2px;font-weight:600; }
    .clickable-team { transition:transform .2s; }
    .clickable-team:hover { transform:scale(1.05); }

    .tabs { overflow-x: auto; scrollbar-width: none; -ms-overflow-style: none; padding-bottom: 4px; border-bottom: 1px solid var(--border); }
    .tabs::-webkit-scrollbar { display: none; }
    .tab-btn { white-space: nowrap; }

    /* Season Points Summary â€” Percentage bars */
    .season-pct-bar { 
      display: inline-block; 
      width: 100%; 
      max-width: 120px; 
      height: 6px; 
      background: var(--bg3); 
      border-radius: 3px; 
      overflow: hidden; 
      position: relative;
    }
    .season-pct-fill { 
      height: 100%; 
      border-radius: 3px; 
      background: linear-gradient(90deg, var(--accent), var(--gold)); 
    }
    .season-pct-text { 
      font-family: var(--f-mono); 
      font-size: 11px; 
      font-weight: 700; 
      color: var(--text2); 
      display: block; 
      margin-top: 2px; 
    }

    /* Table center alignment for numeric columns */
    .data-table th,
    .data-table td { text-align: center; }
    .data-table th:first-child,
    .data-table td:first-child { text-align: left; }

    /* Points Summary Table Styling */
    .points-summary-table { min-width: 700px; }
    .points-summary-table th { 
      padding: 12px 8px; 
      font-size: 11px; 
      text-transform: uppercase;
      letter-spacing: 0.5px;
      text-align: center !important;
    }
    .points-summary-table th:first-child {
      text-align: left !important;
    }
    .points-summary-table td { 
      padding: 10px 6px; 
      vertical-align: middle;
      text-align: center;
      font-family: var(--f-body);
    }
    .points-summary-table td:first-child { 
      text-align: left;
    }
    .points-summary-table .pts-cell {
      display: flex;
      justify-content: center;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }

    .points-summary-table .pts-value {
      font-size: 16px;
      font-weight: 700;
      font-family: var(--f-display);
    }

    .points-summary-table .pts-pct {
      font-size: 12px;
      color: var(--text2);
      margin-top: 2px;
      font-family: var(--f-mono);
      font-weight: 700;
    }

    .points-summary-table .total-cell .pts-value {
      font-size: 18px;
      font-weight: 700;
      font-family: var(--f-mono);
    }

    @media(max-width:700px){
      .metrics-row{grid-template-columns:repeat(2,1fr);}
      .analytics-chart-row { grid-template-columns:1fr !important; }
      .points-summary-table { font-size: 12px; }
      .points-summary-table th { font-size: 10px; padding: 8px 4px; }
      .points-summary-table td { padding: 6px 3px; }
      .points-summary-table .pts-value { font-size: 13px; }
      .points-summary-table .pts-pct { font-size: 9px; }
      .points-summary-table .total-cell .pts-value { font-size: 15px; }
    }

     /* Team Insights Table */
     .team-insights-table { min-width: 900px; font-size: 16px; }
     .team-insights-table th {
       padding: 12px 8px;
       font-size: 14px;
       text-transform: uppercase;
       letter-spacing: 0.5px;
       white-space: nowrap;
     }
     
     .team-insights-table td {
       padding: 10px 8px;
       vertical-align: middle;
     }
     .team-insights-table .th-sortable { cursor: pointer; user-select: none; }
     .team-insights-table .th-sortable:hover { color: var(--accent); }
     .team-insights-table .ti-team { font-weight: 800; min-width: 100px; color: var(--purple); }
     .team-insights-table .ti-num { font-family: var(--f-mono); font-weight: 700; }
     .team-insights-table .ti-low { color: var(--red); }
     .team-insights-table .ti-high { color: var(--green); }
     .team-insights-table .ti-match { font-size: 10px; color: var(--text3); display: block; }
     .team-insights-table .ti-badge {
       display: inline-block;
       padding: 2px 6px;
       border-radius: 4px;
       font-size: 12px;
       font-weight: 700;
       min-width: 28px;
       text-align: center;
     }
     .team-insights-table .ti-badge-red { background: rgba(248,113,113,0.15); color: var(--red); }
     .team-insights-table .ti-badge-gold { background: rgba(251,191,36,0.15); color: var(--gold); }
     .team-insights-table .ti-badge-green { background: rgba(52,211,153,0.15); color: var(--green); }
     .team-insights-table .ti-badge-cyan { background: rgba(56,217,245,0.15); color: var(--cyan); }
     .team-insights-table .ti-total { background: var(--accent-dim); font-weight: 900; color: var(--accent);}

     /* Team Stats Card Tables */
     .team-stats-grid {
       display: grid;
       grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
       gap: 16px;
       margin-bottom: 24px;
     }
     .team-stats-card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
     .team-stats-card .card-header {
       padding: 14px 16px;
       border-bottom: 1px solid var(--border);
       font-family: var(--f-ui);
       font-size: 13px;
       font-weight: 800;
       text-transform: uppercase;
       letter-spacing: 0.8px;
       color: var(--text2);
       background: var(--bg3);
     }
     .team-stats-card .card-body { padding: 12px 16px; overflow-x: auto; }
     .team-stats-card .data-table { min-width: 400px; font-size: 14px; }
     .team-stats-card .data-table th {
       padding: 10px 8px;
       font-size: 11px;
       text-transform: uppercase;
       letter-spacing: 0.5px;
       text-align: center !important;
     }
     .team-stats-card .data-table th:first-child { text-align: left !important; }
     .team-stats-card .data-table td {
       padding: 8px 6px;
       text-align: center;
       vertical-align: middle;
     }
     .team-stats-card .data-table td:first-child { text-align: left; font-weight: 600; }
     .team-stats-card .data-table .ti-team-col { font-weight: 800; color: var(--purple); min-width: 90px; }
     .team-stats-card .data-table .stat-num { font-family: var(--f-mono); font-weight: 700; }
     .team-stats-card .data-table .stat-num.high { color: var(--green); }
     .team-stats-card .data-table .stat-num.low { color: var(--red); }
     .team-stats-card .pct-cell {
       display: flex;
       flex-direction: column;
       align-items: center;
       gap: 2px;
     }
     .team-stats-card .pct-bar {
       display: inline-block;
       width: 100%;
       max-width: 80px;
       height: 5px;
       background: var(--bg3);
       border-radius: 2.5px;
       overflow: hidden;
     }
     .team-stats-card .pct-fill {
       height: 100%;
       background: linear-gradient(90deg, var(--accent), var(--gold));
       border-radius: 2.5px;
     }
     .team-stats-card .pct-text {
       font-family: var(--f-mono);
       font-size: 10px;
       color: var(--text3);
       margin-top: 2px;
     }
     .team-stats-card .total-row { font-weight: 800; background: var(--bg3); }
     .team-stats-card .total-row td { color: var(--accent); font-family: var(--f-mono); }
    @media(max-width:700px){
      .team-insights-table { font-size: 11px; }
      .team-insights-table th, .team-insights-table td { padding: 6px 4px; }
    }

    /* ICC Style Leaderboard */
    .fl-icc-container { display: flex; flex-direction: column; gap: 8px; padding-bottom: 20px; }
    .fl-icc-header { display: grid; grid-template-columns: 60px 80px 1fr 100px 180px; align-items: center; padding: 12px 20px; border-bottom: 2px solid var(--border); font-family: var(--f-ui); font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text3); opacity: 0.8; }
    .fl-icc-row { display: grid; grid-template-columns: 60px 80px 1fr 100px 180px; align-items: center; padding: 14px 20px; background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); transition: all 0.2s; }
    .fl-icc-row:hover { border-color: var(--accent-dim); transform: translateX(4px); background: var(--bg3); }
    
    .fl-featured-card { position: relative; display: flex; align-items: center; gap: 80px; padding: 40px 60px; background: linear-gradient(135deg, var(--bg2), var(--bg3)); border: 2px solid var(--accent-dim); border-radius: var(--radius-lg); margin-bottom: 32px; overflow: hidden; box-shadow: 0 15px 45px rgba(0,0,0,0.3); min-height: 420px; }
    .fl-featured-card::before { content: "01"; position: absolute; right: 0px; top: -50px; font-family: var(--f-display); font-size: 180px; font-weight: 900; color: var(--accent); opacity: 0.05; pointer-events: none; }
    .fl-featured-img-wrap { position: relative; width: 340px; height: 340px; flex-shrink: 0; z-index: 2; display: flex; align-items: flex-end; justify-content: center; margin-left: -40px; align-self: flex-end; margin-bottom: -40px; }
    .fl-featured-img-wrap::after { content: ""; position: absolute; top: 50%; left: 55%; transform: translate(-50%, -50%); width: 520px; height: 520px; background: url('images/ipl/player-back-bg-numbers.png') no-repeat center; background-size: contain; z-index: -1; opacity: 0.35; }
    .fl-featured-img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 15px 25px rgba(0,0,0,0.5)); position: relative; }
    .fl-featured-info { flex: 1; z-index: 2; padding-bottom: 10px; }
    
    .fl-leader-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(255,193,7,0.08); border: 1px solid var(--accent-dim); padding: 5px 14px; border-radius: 4px; margin-bottom: 16px; }
    .fl-leader-badge-text { font-family: var(--f-ui); font-size: 14px; font-weight: 800; text-transform: uppercase; color: var(--accent); letter-spacing: 0.8px; }
    
    .fl-featured-name { font-family: var(--f-display); font-size: 38px; line-height: 1; margin-bottom: 24px; }
    .fl-featured-name span { display: block; font-size: 16px; font-weight: 400; opacity: 0.7; font-family: var(--f-ui); text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 4px; }
    .fl-featured-name strong { display: block; font-weight: 900; text-transform: uppercase; color: var(--accent); font-size: 52px; }

    .fl-featured-stats-v { display: flex; flex-direction: column; gap: 14px; max-width: 420px; margin-top: 10px; }
    .fl-featured-stat-v { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 6px; }
    .fl-fstat-lbl { font-family: var(--f-ui); font-size: 16px; font-weight: 700; color: var(--text2); }
    .fl-fstat-val { font-family: var(--f-display); font-size: 32px; font-weight: 900; color: var(--text); line-height: 1; }
    .fl-fstat-sub { font-size: 11px; color: var(--text3); margin-top: 2px; }

    .fl-pos { font-family: var(--f-display); font-size: 20px; font-weight: 900; display: flex; align-items: center; gap: 8px; }
    .fl-trend { font-size: 10px; font-weight: 700; width: 14px; text-align: center; }
    .fl-team-logo { width: 36px; height: 36px; object-fit: contain; }
    .fl-player-cell { display: flex; align-items: center; gap: 14px; }
    .fl-name { line-height: 1.2; }
    .fl-name span { display: block; font-size: 12px; font-weight: 500; opacity: 0.7; }
    .fl-name strong { display: block; font-family: var(--f-display); font-size: 18px; font-weight: 800; text-transform: uppercase; color: var(--text-main); }
    .fl-rating { font-family: var(--f-display); font-size: 22px; font-weight: 900; color: var(--accent); }
    .fl-best-pts { font-family: var(--f-display); font-size: 16px; font-weight: 900; display: block; }
    .fl-best-meta { font-size: 10px; color: var(--text3); display: block; margin-top: 2px; }

    @media(max-width: 850px) {
      .fl-icc-header, .fl-icc-row { grid-template-columns: 50px 70px 1fr 90px; }
      .fl-icc-header .fl-best, .fl-icc-row .fl-best { display: none; }
      .fl-featured-card { padding: 30px; gap: 40px; align-items: flex-end; }
      .fl-featured-img-wrap { width: 220px; height: 220px; margin-left: -20px; margin-bottom: -30px; }
      .fl-featured-img-wrap::after { width: 320px; height: 320px; }
      .fl-featured-name { font-size: 30px; }
      .fl-featured-name strong { font-size: 42px; }
      .fl-featured-stats-v { gap: 10px; }
      .fl-fstat-val { font-size: 26px; }
    }
    @media(max-width: 650px) {
      .fl-featured-card { flex-direction: column; align-items: center; text-align: center; padding: 40px 24px; }
      .fl-featured-info { width: 100%; display: flex; flex-direction: column; align-items: center; }
      .fl-featured-img-wrap { margin: 0 0 20px 0; width: 260px; height: 260px; align-self: center; }
      .fl-featured-img-wrap::after { width: 380px; height: 380px; }
      .fl-featured-img { bottom: 0; height: 110%; }
      .fl-featured-stats-v { width: 100%; max-width: none; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 24px; margin-top: 24px; }
    }
    @media(max-width: 500px) {
      .fl-icc-header { display: none; }
      .fl-icc-row { grid-template-columns: 45px 1fr 80px; gap: 12px; padding: 12px 16px; }
      .fl-icc-row .fl-team { display: none; }
      .fl-pos { font-size: 18px; }
      .fl-name strong { font-size: 16px; }
      .fl-rating { font-size: 20px; }
    }
  </style>
</head>
<body>
<div id="toast-container"></div>
<div class="bg-orbs"><div class="orb orb-1"></div><div class="orb orb-2"></div><div class="orb orb-3"></div></div>
<img src="images/ipl/sponsor-top-left.png" class="sponsor-corner sponsor-top-left" alt="">
<img src="images/ipl/sponsor-top-right.png" class="sponsor-corner sponsor-top-right" alt="">
<img src="images/ipl/sponsor-bottom-left.png" class="sponsor-corner sponsor-bottom-left" alt="">
<img src="images/ipl/sponsor-bottom-right.png" class="sponsor-corner sponsor-bottom-right" alt="">
<nav class="navbar" id="navbar"></nav>
<div class="bottom-nav"><div class="bottom-nav-inner" id="bottom-nav-inner"></div></div>

<div class="page-content-wrap" id="page-content-wrap">
<div class="page-wrap">
<main class="main" style="position:relative;">
<div class="container">

  <div class="page-header flex-between">
    <div>
      <div class="page-title">Season Analytics</div>
      <div class="page-sub">Season-wide performance insights</div>
    </div>
    <button class="btn btn-ghost btn-sm" onclick="loadAnalytics()">â†» Refresh</button>
  </div>

   <!-- Tabs -->
   <div class="tabs">
     <button class="tab-btn active" onclick="switchTab('pred-summary')">Summary</button>
     <button class="tab-btn" onclick="switchTab('accuracy')">Accuracy</button>
     <button class="tab-btn" onclick="switchTab('match-preds')">Match Preds</button>
     <button class="tab-btn" onclick="switchTab('points-summary')">Points Summary</button>
     <button class="tab-btn" onclick="switchTab('team-insights')">Team Insights</button>
     <button class="tab-btn" onclick="switchTab('fantasy-players')">Fantasy Players</button>
     <button class="tab-btn" onclick="switchTab('user-teams')">User Teams</button>
     <button class="tab-btn" onclick="switchTab('power-rankings')">Power Rankings</button>
   </div>

  <!-- PREDICTIONS SUMMARY -->
  <div class="tab-panel active" id="tab-pred-summary">
    <div class="analytics-chart-row" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:16px;">
      <div class="card">
        <div class="card-title">Team Win Predictions</div>
        <div id="pred-team-wins"><div class="skel skel-row"></div></div>
      </div>
      <div class="card">
        <div class="card-title">Target Score Distribution</div>
        <div id="pred-target-dist"><div class="skel skel-row"></div></div>
      </div>
    </div>
  </div>

  <!-- PREDICTION ACCURACY -->
  <div class="tab-panel" id="tab-accuracy">
    <div class="analytics-chart-row" style="display:grid;grid-template-columns:1fr 280px;gap:16px;">
      <div class="card" style="overflow:hidden">
        <div class="card-title">Accuracy by Match</div>
        <div id="accuracy-by-match" style="max-height:500px;overflow-y:auto;padding-right:8px;"><div class="skel skel-row"></div></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div class="card" id="accuracy-overall"></div>
        <div class="card">
          <div class="card-title">Team Leaderboard</div>
          <div id="accuracy-team-leaderboard"><div class="skel skel-row"></div></div>
        </div>
      </div>
    </div>
  </div>

<!-- MATCH PREDICTIONS -->
   <div class="tab-panel" id="tab-match-preds">
     <div class="card mb-16">
       <div class="form-group" style="max-width:400px;margin-bottom:0;">
         <label class="form-label" style="font-size:11px;">View Analysis for BFL Team</label>
         <select class="form-select" id="mp-team-select" onchange="loadTeamMatchPredictions()">
           <option value="">â€” Select BFL Team â€”</option>
         </select>
       </div>
     </div>
     <div class="analytics-chart-row" style="display:grid;grid-template-columns:1fr 320px;gap:16px;">
       <div class="card" style="padding:0;overflow:hidden;">
         <div id="team-preds-list" style="max-height:600px;overflow-y:auto;">
           <div class="empty-state" style="padding:40px;">Select a BFL Team to view their prediction history</div>
         </div>
       </div>
       <div id="team-preds-stats"></div>
     </div>
   </div>

     <!-- TEAM INSIGHTS -->
     <div class="tab-panel" id="tab-team-insights">
       <div id="team-stats-cards-container">
         <div class="team-stats-grid">
           <!-- Batting Stats Card -->
           <div class="team-stats-card">
             <div class="card-header">Batting Statistics</div>
             <div class="card-body">
               <table class="data-table">
                 <thead>
                   <tr>
                     <th>Team</th>
                     <th>Runs</th>
                     <th>Balls</th>
                     <th>4s</th>
                     <th>6s</th>
                     <th>SR</th>
                     <th>Avg</th>
                     <th>50s</th>
                     <th>100s</th>
                   </tr>
                 </thead>
                 <tbody id="batting-stats-tbody"></tbody>
               </table>
             </div>
           </div>
           <!-- Bowling Stats Card -->
           <div class="team-stats-card">
             <div class="card-header">Bowling Statistics</div>
             <div class="card-body">
               <table class="data-table">
                 <thead>
                   <tr>
                     <th>Team</th>
                     <th>Wkts</th>
                     <th>Maid</th>
                     <th>Runs</th>
                     <th>Avg</th>
                     <th>Eco</th>
                     <th>3-F</th>
                     <th>5-F</th>
                   </tr>
                 </thead>
                 <tbody id="bowling-stats-tbody"></tbody>
               </table>
             </div>
           </div>
           <!-- Fielding Stats Card -->
           <div class="team-stats-card">
             <div class="card-header">Fielding Statistics</div>
             <div class="card-body">
               <table class="data-table">
                 <thead>
                   <tr>
                     <th>Team</th>
                     <th>Catches</th>
                     <th>Runouts</th>
                     <th>Stumpings</th>
                     <th>Total</th>
                   </tr>
                 </thead>
                 <tbody id="fielding-stats-tbody"></tbody>
               </table>
             </div>
           </div>
         </div>
       </div>
       <div class="card" style="overflow:auto;">
         <div class="card-title">Teams Points Summary</div>
         <div class="table-wrap table-scroller">
           <table class="data-table team-insights-table">
             <thead id="ti-thead">
               <tr>
                 <th class="th-sortable" onclick="_tiSortBy('team_name')">Team <span class="ti-sort-arrow"></span></th>
                 <th class="th-sortable" onclick="_tiSortBy('matches')" title="Matches Played">MP <span class="ti-sort-arrow"></span></th>
                 <th class="th-sortable" onclick="_tiSortBy('squad')" title="Total Squad Points (Batting + Bowling + Fielding)">Squad <span class="ti-sort-arrow"></span></th>
                 <th class="th-sortable" onclick="_tiSortBy('pred')" title="Prediction Points (Target + Winner)">Pred <span class="ti-sort-arrow"></span></th>
                 <th class="th-sortable" onclick="_tiSortBy('bonus')" title="Bonus Points">Bonus <span class="ti-sort-arrow"></span></th>
                 <th class="th-sortable ti-total" onclick="_tiSortBy('total')" title="Total Points (Squad + Pred + Bonus)">Total <span class="ti-sort-arrow"></span></th>
                 <th class="th-sortable" onclick="_tiSortBy('avg')" title="Average Points Per Match">Avg <span class="ti-sort-arrow"></span></th>
                 <th class="th-sortable" onclick="_tiSortBy('lowest')" title="Lowest Match Score">Lowest <span class="ti-sort-arrow"></span></th>
                 <th class="th-sortable" onclick="_tiSortBy('highest')" title="Highest Match Score">Highest <span class="ti-sort-arrow"></span></th>
                 <th class="th-sortable" onclick="_tiSortBy('below25')" title="Matches Below 25 Points">&lt;25 <span class="ti-sort-arrow"></span></th>
                 <th class="th-sortable" onclick="_tiSortBy('over250')" title="Matches Over 250 Points">250+ <span class="ti-sort-arrow"></span></th>
                 <th class="th-sortable" onclick="_tiSortBy('over500')" title="Matches Over 500 Points">500+ <span class="ti-sort-arrow"></span></th>
                 <th class="th-sortable" onclick="_tiSortBy('over1000')" title="Matches Over 1000 Points">1000+ <span class="ti-sort-arrow"></span></th>
               </tr>
             </thead>
             <tbody id="ti-tbody"><tr><td colspan="13" class="empty-state" style="padding:40px;"><div class="skel skel-row" style="margin:8px;"></div><div class="skel skel-row" style="margin:8px;"></div><div class="skel skel-row" style="margin:8px;"></div></td></tr></tbody>
           </table>
         </div>
       </div>
     </div>

   <!-- POINTS SUMMARY -->
   <div class="tab-panel" id="tab-points-summary">
     <div class="card mb-20">
       <div class="card-title">Squad Points â€” Team Distribution</div>
       <div class="table-wrap table-scroller">
<table class="data-table points-summary-table" style="min-width:600px;">
<thead>
              <tr>
                <th style="text-align:left;">Team</th>
                <th style="text-align:right;">Batting</th>
                <th style="text-align:right;">Bowling</th>
                <th style="text-align:right;">Fielding</th>
                <th style="text-align:right;">Squad Total</th>
                <th style="text-align:right;">Season Total</th>
              </tr>
            </thead>
           <tbody id="points-squad-tbody"><tr><td colspan="6" class="empty-state" style="padding:40px;"><div class="skel skel-row" style="margin:8px;"></div><div class="skel skel-row" style="margin:8px;"></div><div class="skel skel-row" style="margin:8px;"></div></td></tr></tbody>
         </table>
       </div>
     </div>
     <div class="card">
       <div class="card-title">Prediction Points â€” Team Distribution</div>
       <div class="table-wrap table-scroller">
         <table class="data-table points-summary-table" style="min-width:750px;">
<thead>
              <tr>
                <th style="text-align:left;">Team</th>
                <th style="text-align:right;">Target</th>
                <th style="text-align:right;">Winner</th>
                <th style="text-align:right;">Pred Total</th>
                <th style="text-align:right;">Bonus</th>
                <th style="text-align:right;">Season Total</th>
              </tr>
            </thead>
           <tbody id="points-pred-tbody"><tr><td colspan="6" class="empty-state" style="padding:40px;"><div class="skel skel-row" style="margin:8px;"></div><div class="skel skel-row" style="margin:8px;"></div><div class="skel skel-row" style="margin:8px;"></div></td></tr></tbody>
         </table>
       </div>
     </div>
   </div>

   <!-- FANTASY PLAYERS LEADERBOARD -->
   <div class="tab-panel" id="tab-fantasy-players">
    <div class="card mb-12">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <div style="position:relative;flex:1;min-width:180px;">
          <input class="form-input" id="fl-search" placeholder="Search player..." oninput="filterFantasyLeaderboard()" style="padding-left:12px;">
        </div>
        <select class="form-select" id="fl-ipl-team" onchange="filterFantasyLeaderboard()" style="width:130px;font-size:12px;"><option value="">All IPL Teams</option></select>
        <select class="form-select" id="fl-role" onchange="filterFantasyLeaderboard()" style="width:110px;font-size:12px;">
          <option value="">Roles</option><option value="BAT">Batter</option><option value="BOW">Bowler</option><option value="AR">AR</option><option value="WK">WK</option>
        </select>
        <select class="form-select" id="fl-bfl-team" onchange="filterFantasyLeaderboard()" style="width:130px;font-size:12px;"><option value="">All BFL Teams</option></select>
        <button class="btn btn-ghost btn-sm" onclick="resetFantasyLeaderboard()">âœ•</button>
      </div>
    </div>
    <div id="fl-icc-wrap" class="fl-icc-container">
      <div id="fantasy-leaderboard-container">
        <!-- Rendered via JS -->
      </div>
    </div>
    <div class="flex-between" style="padding:12px 0;">
      <div id="fl-info" style="font-size:12px;color:var(--text3);"></div>
      <div style="display:flex;gap:4px;align-items:center;" id="fl-pagination"></div>
    </div>
  </div>

    <!-- USER TEAMS OVERVIEW -->
    <div class="tab-panel" id="tab-user-teams">
      <div class="card" style="overflow:auto;">
        <div class="card-title">User Teams â€” Roster Composition &amp; Leadership</div>
        <div class="table-wrap table-scroller" style="max-height:700px;">
          <table class="data-table" style="min-width:600px;">
            <thead><tr><th>User</th><th>Team Name</th><th>Captain</th><th>Vice-Captain</th><th>Impact</th><th>Roster</th></tr></thead>
            <tbody id="user-teams-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- POWER RANKINGS -->
    <div class="tab-panel" id="tab-power-rankings">
      <div class="card" style="overflow:auto;">
        <div class="card-title">Power Rankings â€” Combined Prediction Accuracy &amp; Fantasy Performance</div>
        <div class="table-wrap table-scroller">
          <table class="data-table">
            <thead><tr><th>Rank</th><th>Team</th><th>Pred Accuracy</th><th>Fantasy Points</th><th>BFL Score</th></tr></thead>
            <tbody id="power-rankings-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>

</div>
</main>
</div>

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js" crossorigin="anonymous">
