-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.action_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  action_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  payload_before jsonb,
  payload_after jsonb,
  performed_by text NOT NULL DEFAULT 'admin'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT action_log_pkey PRIMARY KEY (id)
);
CREATE TABLE public.adjustments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  fantasy_team_id uuid NOT NULL,
  match_id uuid,
  points integer NOT NULL,
  remarks text NOT NULL,
  applied_by text NOT NULL DEFAULT 'admin'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT adjustments_pkey PRIMARY KEY (id),
  CONSTRAINT adjustments_fantasy_team_id_fkey FOREIGN KEY (fantasy_team_id) REFERENCES public.fantasy_teams(id),
  CONSTRAINT adjustments_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id)
);
CREATE TABLE public.badge_definitions (
  id text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  icon text DEFAULT '🏅'::text,
  color text DEFAULT '#c8f135'::text,
  criteria jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT badge_definitions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.fantasy_teams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  team_name text NOT NULL UNIQUE,
  owner_name text,
  created_at timestamp with time zone DEFAULT now(),
  last_active timestamp with time zone,
  CONSTRAINT fantasy_teams_pkey PRIMARY KEY (id),
  CONSTRAINT fantasy_teams_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.ground_stats (
  venue text NOT NULL,
  avg_first_innings numeric DEFAULT 0,
  match_count integer DEFAULT 0,
  updated_at timestamp with time zone,
  CONSTRAINT ground_stats_pkey PRIMARY KEY (venue)
);
CREATE TABLE public.impact_activations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  fantasy_team_id uuid,
  match_id uuid,
  player_id uuid REFERENCES players(id),
  is_active boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT impact_activations_pkey PRIMARY KEY (id),
  CONSTRAINT impact_activations_fantasy_team_id_fkey FOREIGN KEY (fantasy_team_id) REFERENCES public.fantasy_teams(id),
  CONSTRAINT impact_activations_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id),
  CONSTRAINT impact_activations_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id)
);
CREATE TABLE public.impact_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  fantasy_team_id uuid NOT NULL,
  match_id uuid NOT NULL,
  player_id uuid NOT NULL,
  used boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT impact_usage_pkey PRIMARY KEY (id),
  CONSTRAINT impact_usage_fantasy_team_id_fkey FOREIGN KEY (fantasy_team_id) REFERENCES public.fantasy_teams(id),
  CONSTRAINT impact_usage_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id),
  CONSTRAINT impact_usage_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id)
);
CREATE TABLE public.leaderboard (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  fantasy_team_id uuid UNIQUE,
  total_points numeric DEFAULT 0,
  matches_played integer DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now(),
  prev_rank integer,
  rank integer,
  CONSTRAINT leaderboard_pkey PRIMARY KEY (id),
  CONSTRAINT leaderboard_fantasy_team_id_fkey FOREIGN KEY (fantasy_team_id) REFERENCES public.fantasy_teams(id)
);
CREATE TABLE public.match_center_cache (
  match_id uuid NOT NULL,
  top_scorer_team text,
  top_scorer_pts integer,
  avg_predicted_target numeric,
  most_picked_winner text,
  total_predictions integer,
  correct_predictions integer,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT match_center_cache_pkey PRIMARY KEY (match_id),
  CONSTRAINT match_center_cache_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id)
);
CREATE TABLE public.matches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_title text,
  team1 text NOT NULL,
  team2 text NOT NULL,
  venue text,
  match_date timestamp with time zone,
  is_locked boolean DEFAULT false,
  winner text,
  actual_target integer,
  player_of_match uuid,
  created_at timestamp with time zone DEFAULT now(),
  match_no integer,
  deadline_time timestamp with time zone,
  status text DEFAULT 'upcoming'::text CHECK (status = ANY (ARRAY['upcoming'::text, 'live'::text, 'locked'::text, 'completed'::text, 'processed'::text, 'abandoned'::text])),
  lock_time timestamp with time zone,
  is_abandoned boolean NOT NULL DEFAULT false,
  is_dls_applied boolean NOT NULL DEFAULT false,
  CONSTRAINT matches_pkey PRIMARY KEY (id),
  CONSTRAINT matches_player_of_match_fkey FOREIGN KEY (player_of_match) REFERENCES public.players(id)
);
CREATE TABLE public.player_match_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_id uuid,
  player_id uuid,
  runs integer DEFAULT 0 CHECK (runs >= 0),
  balls_faced integer DEFAULT 0 CHECK (balls_faced >= 0),
  fours integer DEFAULT 0,
  sixes integer DEFAULT 0,
  not_out boolean DEFAULT false,
  wickets integer DEFAULT 0 CHECK (wickets >= 0),
  overs_bowled numeric DEFAULT 0 CHECK (overs_bowled >= 0::numeric),
  runs_conceded integer DEFAULT 0 CHECK (runs_conceded >= 0),
  maidens integer DEFAULT 0 CHECK (maidens >= 0),
  catches integer DEFAULT 0 CHECK (catches >= 0),
  run_outs integer DEFAULT 0 CHECK (run_outs >= 0),
  stumpings integer DEFAULT 0 CHECK (stumpings >= 0),
  player_of_series boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT player_match_stats_pkey PRIMARY KEY (id),
  CONSTRAINT player_match_stats_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id),
  CONSTRAINT player_match_stats_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id)
);
CREATE TABLE public.players (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  ipl_team text,
  role text CHECK (role = ANY (ARRAY['Batter'::text, 'Bowler'::text, 'All-Rounder'::text, 'Wicket-Keeper'::text])),
  image_url text,
  is_overseas boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  is_injured boolean NOT NULL DEFAULT false,
  injury_note text,
  availability_status text DEFAULT 'available'::text CHECK (availability_status = ANY (ARRAY['available'::text, 'injured'::text, 'unavailable'::text])),
  availability_note text,
  is_uncapped boolean DEFAULT false,
  CONSTRAINT players_pkey PRIMARY KEY (id)
);
CREATE TABLE public.points_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_id uuid,
  fantasy_team_id uuid,
  squad_points numeric DEFAULT 0,
  prediction_points numeric DEFAULT 0,
  total_points numeric DEFAULT 0,
  breakdown jsonb,
  created_at timestamp with time zone DEFAULT now(),
  batting_pts numeric DEFAULT 0,
  bowling_pts numeric DEFAULT 0,
  fielding_pts numeric DEFAULT 0,
  bonus_pts numeric DEFAULT 0,
  CONSTRAINT points_log_pkey PRIMARY KEY (id),
  CONSTRAINT points_log_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id),
  CONSTRAINT points_log_fantasy_team_id_fkey FOREIGN KEY (fantasy_team_id) REFERENCES public.fantasy_teams(id)
);
CREATE TABLE public.predictions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_id uuid,
  fantasy_team_id uuid,
  target_score integer,
  predicted_winner text,
  impact_player_id uuid,
  submitted_at timestamp with time zone DEFAULT now(),
  is_locked boolean DEFAULT false,
  CONSTRAINT predictions_pkey PRIMARY KEY (id),
  CONSTRAINT predictions_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id),
  CONSTRAINT predictions_fantasy_team_id_fkey FOREIGN KEY (fantasy_team_id) REFERENCES public.fantasy_teams(id),
  CONSTRAINT predictions_impact_player_id_fkey FOREIGN KEY (impact_player_id) REFERENCES public.players(id)
);
CREATE TABLE public.replacements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  fantasy_team_id uuid NOT NULL,
  original_player_id uuid NOT NULL,
  replacement_player_id uuid NOT NULL,
  start_match_id uuid,
  end_match_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  admin_notes text,
  updated_at timestamp with time zone DEFAULT now(),
  proof_links ARRAY,
  proof_notes text,
  CONSTRAINT replacements_pkey PRIMARY KEY (id),
  CONSTRAINT replacements_fantasy_team_id_fkey FOREIGN KEY (fantasy_team_id) REFERENCES public.fantasy_teams(id),
  CONSTRAINT replacements_original_player_id_fkey FOREIGN KEY (original_player_id) REFERENCES public.players(id),
  CONSTRAINT replacements_replacement_player_id_fkey FOREIGN KEY (replacement_player_id) REFERENCES public.players(id),
  CONSTRAINT replacements_start_match_id_fkey FOREIGN KEY (start_match_id) REFERENCES public.matches(id),
  CONSTRAINT replacements_end_match_id_fkey FOREIGN KEY (end_match_id) REFERENCES public.matches(id)
);
CREATE TABLE public.squad_players (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  fantasy_team_id uuid,
  player_id uuid,
  is_captain boolean DEFAULT false,
  is_vc boolean DEFAULT false,
  is_impact boolean DEFAULT false,
  is_released boolean DEFAULT false,
  released_at timestamp with time zone,
  release_reason text,
  CONSTRAINT squad_players_pkey PRIMARY KEY (id),
  CONSTRAINT squad_players_fantasy_team_id_fkey FOREIGN KEY (fantasy_team_id) REFERENCES public.fantasy_teams(id),
  CONSTRAINT squad_players_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id)
);
CREATE TABLE public.team_activity_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  fantasy_team_id uuid,
  action text NOT NULL,
  details text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT team_activity_log_pkey PRIMARY KEY (id),
  CONSTRAINT team_activity_log_fantasy_team_id_fkey FOREIGN KEY (fantasy_team_id) REFERENCES public.fantasy_teams(id)
);
CREATE TABLE public.tournament_settings (
  key text NOT NULL,
  value text,
  CONSTRAINT tournament_settings_pkey PRIMARY KEY (key)
);
CREATE TABLE public.user_badges (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  fantasy_team_id uuid,
  badge_id text,
  earned_at timestamp with time zone DEFAULT now(),
  match_id uuid,
  CONSTRAINT user_badges_pkey PRIMARY KEY (id),
  CONSTRAINT user_badges_fantasy_team_id_fkey FOREIGN KEY (fantasy_team_id) REFERENCES public.fantasy_teams(id),
  CONSTRAINT user_badges_badge_id_fkey FOREIGN KEY (badge_id) REFERENCES public.badge_definitions(id),
  CONSTRAINT user_badges_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id)
);
CREATE TABLE public.user_streaks (
  fantasy_team_id uuid NOT NULL,
  correct_pred_streak integer DEFAULT 0,
  top3_streak integer DEFAULT 0,
  max_correct_pred integer DEFAULT 0,
  max_top3 integer DEFAULT 0,
  last_match_id uuid,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_streaks_pkey PRIMARY KEY (fantasy_team_id),
  CONSTRAINT user_streaks_fantasy_team_id_fkey FOREIGN KEY (fantasy_team_id) REFERENCES public.fantasy_teams(id)
);