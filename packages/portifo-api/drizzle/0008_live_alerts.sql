CREATE TYPE "public"."alert_mode" AS ENUM('once', 'live');--> statement-breakpoint
ALTER TABLE "price_alerts" ADD COLUMN "mode" "alert_mode" DEFAULT 'once' NOT NULL;--> statement-breakpoint
ALTER TABLE "price_alerts" ADD COLUMN "anchor" numeric(20, 8);