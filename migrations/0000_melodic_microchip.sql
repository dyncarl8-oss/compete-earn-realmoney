CREATE TABLE "bug_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"page" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chess_game_states" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" varchar NOT NULL,
	"board_state" text NOT NULL,
	"white_player_id" varchar NOT NULL,
	"black_player_id" varchar NOT NULL,
	"current_turn" text DEFAULT 'white' NOT NULL,
	"game_status" text DEFAULT 'in_progress' NOT NULL,
	"white_kingside_castle" boolean DEFAULT true,
	"white_queenside_castle" boolean DEFAULT true,
	"black_kingside_castle" boolean DEFAULT true,
	"black_queenside_castle" boolean DEFAULT true,
	"en_passant_target" text,
	"move_count" integer DEFAULT 0 NOT NULL,
	"halfmove_clock" integer DEFAULT 0 NOT NULL,
	"captured_pieces" text DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "chess_game_states_game_id_unique" UNIQUE("game_id")
);
--> statement-breakpoint
CREATE TABLE "chess_moves" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" varchar NOT NULL,
	"move_number" integer NOT NULL,
	"player_id" varchar NOT NULL,
	"player_color" text NOT NULL,
	"from_square" text NOT NULL,
	"to_square" text NOT NULL,
	"piece" text NOT NULL,
	"captured_piece" text,
	"is_check" boolean DEFAULT false NOT NULL,
	"is_checkmate" boolean DEFAULT false NOT NULL,
	"is_castling" boolean DEFAULT false NOT NULL,
	"is_en_passant" boolean DEFAULT false NOT NULL,
	"promotion" text,
	"algebraic_notation" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dice_results" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"bet_amount" numeric(10, 2) NOT NULL,
	"target_number" integer NOT NULL,
	"roll_type" text NOT NULL,
	"rolled_number" integer NOT NULL,
	"multiplier" numeric(10, 2) NOT NULL,
	"win_amount" numeric(10, 2) NOT NULL,
	"won" boolean NOT NULL,
	"balance_after" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "game_invitations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" varchar NOT NULL,
	"from_user_id" varchar NOT NULL,
	"to_user_id" varchar NOT NULL,
	"message" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"responded_at" timestamp,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_participants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"joined_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"game_type" text DEFAULT 'yahtzee' NOT NULL,
	"entry_fee" numeric(10, 2) NOT NULL,
	"max_players" integer DEFAULT 5 NOT NULL,
	"current_players" integer DEFAULT 0 NOT NULL,
	"prize_amount" numeric(10, 2) NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"winner_id" varchar,
	"current_round" integer DEFAULT 1,
	"total_rounds" integer DEFAULT 13 NOT NULL,
	"current_turn_player_id" varchar,
	"game_mode" text DEFAULT 'multiplayer' NOT NULL,
	"ai_opponents" integer DEFAULT 0 NOT NULL,
	"tournament_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "match_result_players" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_result_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"username" text NOT NULL,
	"total_score" integer NOT NULL,
	"rank" integer NOT NULL,
	"entry_fee" numeric(10, 2) NOT NULL,
	"net_change" numeric(10, 2) NOT NULL,
	"forfeited" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_results" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" varchar NOT NULL,
	"winner_id" varchar NOT NULL,
	"prize_amount" numeric(10, 2) NOT NULL,
	"completed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "page_views" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_path" text NOT NULL,
	"user_id" varchar,
	"user_agent" text,
	"ip_address" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "plinko_results" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"bet_amount" numeric(10, 2) NOT NULL,
	"multiplier" numeric(10, 2) NOT NULL,
	"win_amount" numeric(10, 2) NOT NULL,
	"slot_index" integer NOT NULL,
	"balance_after" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "slots_results" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"bet_amount" numeric(10, 2) NOT NULL,
	"reels" text NOT NULL,
	"multiplier" numeric(10, 2) NOT NULL,
	"win_amount" numeric(10, 2) NOT NULL,
	"won" boolean NOT NULL,
	"balance_after" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tournament_participants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"joined_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_type" text NOT NULL,
	"hosted_by" varchar NOT NULL,
	"company_id" varchar,
	"experience_id" varchar,
	"pot_amount" numeric(10, 2) NOT NULL,
	"entry_fee" numeric(10, 2) NOT NULL,
	"max_participants" integer DEFAULT 10 NOT NULL,
	"current_participants" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"description" text NOT NULL,
	"game_id" varchar,
	"balance_after" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"email" text,
	"balance" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"profile_image_url" text,
	"games_played" integer DEFAULT 0 NOT NULL,
	"games_won" integer DEFAULT 0 NOT NULL,
	"total_winnings" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"last_activity" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "yahtzee_player_states" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"ones" integer DEFAULT -1,
	"twos" integer DEFAULT -1,
	"threes" integer DEFAULT -1,
	"fours" integer DEFAULT -1,
	"fives" integer DEFAULT -1,
	"sixes" integer DEFAULT -1,
	"upper_section_bonus" integer DEFAULT 0,
	"three_of_a_kind" integer DEFAULT -1,
	"four_of_a_kind" integer DEFAULT -1,
	"full_house" integer DEFAULT -1,
	"small_straight" integer DEFAULT -1,
	"large_straight" integer DEFAULT -1,
	"yahtzee" integer DEFAULT -1,
	"yahtzee_bonus" integer DEFAULT 0,
	"chance" integer DEFAULT -1,
	"total_score" integer DEFAULT 0,
	"turns_completed" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "yahtzee_turns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"round" integer NOT NULL,
	"roll_count" integer DEFAULT 0 NOT NULL,
	"dice1" integer DEFAULT 1,
	"dice2" integer DEFAULT 1,
	"dice3" integer DEFAULT 1,
	"dice4" integer DEFAULT 1,
	"dice5" integer DEFAULT 1,
	"hold1" boolean DEFAULT false,
	"hold2" boolean DEFAULT false,
	"hold3" boolean DEFAULT false,
	"hold4" boolean DEFAULT false,
	"hold5" boolean DEFAULT false,
	"is_completed" boolean DEFAULT false,
	"scored_category" text,
	"scored_points" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
