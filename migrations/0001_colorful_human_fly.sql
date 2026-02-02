ALTER TABLE "tournaments" ADD COLUMN "game_id" varchar;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "notification_sent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "notification_sent_at" timestamp;