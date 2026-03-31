-- Add prev_rank column to track standings changes
ALTER TABLE public.leaderboard 
ADD COLUMN IF NOT EXISTS prev_rank integer;

-- Optional: Initialize prev_rank with current rank for all existing teams
-- This prevents a massive "Rank Up" jump on the first update
WITH current_standings AS (
  SELECT fantasy_team_id, 
         ROW_NUMBER() OVER (ORDER BY total_points DESC) as current_rank
  FROM public.leaderboard
)
UPDATE public.leaderboard l
SET prev_rank = s.current_rank
FROM current_standings s
WHERE l.fantasy_team_id = s.fantasy_team_id;
