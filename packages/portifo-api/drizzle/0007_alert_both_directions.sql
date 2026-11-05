-- Hand-edited: drizzle-kit wrote ADD VALUE 'both' and then SET DEFAULT 'both',
-- but drizzle migrates in one transaction, and Postgres won't use a value added
-- to an existing enum before it commits. So the enum is recreated instead, and
-- `armed` becomes `armedFrom` (the side a rule can cross from) in one step.
ALTER TYPE "public"."alert_direction" RENAME TO "alert_direction_old";--> statement-breakpoint
CREATE TYPE "public"."alert_direction" AS ENUM('below', 'above', 'both');--> statement-breakpoint
ALTER TABLE "price_alerts" ALTER COLUMN "direction" SET DATA TYPE "public"."alert_direction" USING "direction"::text::"public"."alert_direction";--> statement-breakpoint
DROP TYPE "public"."alert_direction_old";--> statement-breakpoint
ALTER TABLE "price_alerts" ALTER COLUMN "direction" SET DEFAULT 'both';--> statement-breakpoint
CREATE TYPE "public"."price_side" AS ENUM('below', 'above');--> statement-breakpoint
ALTER TABLE "price_alerts" ADD COLUMN "armedFrom" "price_side";--> statement-breakpoint
UPDATE "price_alerts" SET "armedFrom" = (CASE "direction" WHEN 'below' THEN 'above' ELSE 'below' END)::"price_side" WHERE "armed";--> statement-breakpoint
ALTER TABLE "price_alerts" DROP COLUMN "armed";
