# BFL Fantasy Cricket — IPL 2026

A production-ready private fantasy cricket platform for IPL 2026.

## Quick Start

### 1. Supabase Setup
1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor → New Query**, paste `schema.sql`, run it
3. Copy your **Project URL** and **anon key** from Settings → API

### 2. Configure
Edit `js/supabase.js`:
```js
const SUPABASE_URL  = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON = 'YOUR_ANON_KEY';
```

### 3. Create Users in Supabase Auth

**Admin:**
- Email: `admin@bfl.in`
- Password: your choice
- After creation: Auth → Users → ··· → Edit → User Metadata:
  `{"app_metadata": {"role": "admin"}}`

**Teams:**
- Email format: lowercase team name, spaces → underscores, + `@bfl.in`
- Example: "Chennai Super Kings" → `chennai_super_kings@bfl.in`

### 4. Link Teams in Database
In Table Editor → `fantasy_teams`:
```
id: (auto)
user_id: (copy from Auth → Users)
team_name: "Chennai Super Kings"
owner_name: "John Doe"
```

### 5. Add Squad Players
In `squad_players`: 12 rows per team
- `fantasy_team_id`: team's UUID
- `player_id`: player UUID from `players` table
- `is_captain`: true (only one per team)
- `is_vc`: true (only one per team)

### 6. Deploy
**Vercel:** `vercel --prod` or drag folder to vercel.com  
**GitHub Pages:** push folder, enable Pages from root

---

## Project Structure
```
bfl-fantasy/
├── index.html          ← Login
├── dashboard.html      ← Team dashboard
├── squad.html          ← Squad viewer
├── predictions.html    ← Match predictions
├── leaderboard.html    ← Rankings
├── admin.html          ← Admin control room
├── css/
│   └── styles.css      ← Full design system
├── js/
│   ├── supabase.js     ← Config (edit this!)
│   ├── auth.js         ← Auth module
│   ├── ui.js           ← UI utilities + toast
│   ├── api.js          ← Data layer + points engine
│   └── navbar.js       ← Shared navbar
├── schema.sql          ← Run in Supabase
└── vercel.json         ← Deployment config
```

## Points System Summary

| Event | Points |
|-------|--------|
| Run   | +1     |
| 25 runs | +50 |
| 50 runs | +100 |
| 100 runs | +200 |
| 150 runs | +300 |
| 10+ boundaries | +100 |
| SR ≥ 200 (min 10 balls) | +100 |
| 60+ balls faced | +100 |
| Duck | -25 |
| Single digit | -10 |
| Not out | +25 |
| 3 wickets | +100 |
| Wicket | +50 |
| Wicketless | -25 |
| 5 wickets | +200 |
| Maiden | +50 |
| Economy ≤ 6 (min 2 over) | +100 |
| Catch | +25 |
| 3+ catches | +50 bonus |
| Run out | +50 |
| Stumping | +50 |
| Player of Match | +100 |
| Player of Series | +500 |
| Captain | 2× multiplier |
| Vice Captain | 1.5× multiplier |
| Impact Player | 3× multiplier (8 uses max) |
| Exact target | +250 |
| Target ±1 | +150 |
| Target ±2–5 | +100 |
| Target ±6–10 | +50 |
| Correct winner | +25 |
