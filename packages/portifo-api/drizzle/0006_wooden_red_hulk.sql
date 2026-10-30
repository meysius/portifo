CREATE TYPE "public"."alert_direction" AS ENUM('below', 'above');--> statement-breakpoint
CREATE TABLE "price_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"direction" "alert_direction" NOT NULL,
	"price" numeric(20, 8) NOT NULL,
	"armed" boolean DEFAULT false NOT NULL,
	"triggeredAt" timestamp,
	"triggeredPrice" numeric(20, 8),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;