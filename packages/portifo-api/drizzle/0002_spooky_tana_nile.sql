ALTER TABLE "members" DROP CONSTRAINT "members_userId_portfolioId_unique";--> statement-breakpoint
ALTER TABLE "members" ALTER COLUMN "userId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "email" varchar(255);--> statement-breakpoint
UPDATE "members" SET "email" = "users"."email" FROM "users" WHERE "users"."id" = "members"."userId";--> statement-breakpoint
ALTER TABLE "members" ALTER COLUMN "email" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_email_portfolioId_unique" UNIQUE("email","portfolioId");
