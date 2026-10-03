ALTER TABLE "transactions" ADD COLUMN "fromBalanceUpdate" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Account names are now looked up without a type, so a cash account sharing
-- its name with an investment account in the same portfolio would become
-- ambiguous. Keep the investment account's name and suffix the cash one.
UPDATE "accounts" AS c SET "name" = c."name" || ' (Cash)'
WHERE c."type" = 'cash' AND EXISTS (
	SELECT 1 FROM "accounts" AS i
	WHERE i."portfolioId" = c."portfolioId" AND i."type" = 'investment' AND lower(i."name") = lower(c."name")
);--> statement-breakpoint
-- Every transaction on a cash account was written by a balance edit, so they
-- all become marked balance updates, noted with the balance they set (the
-- running total of that account+currency up to and including the row).
UPDATE "transactions" AS t SET
	"fromBalanceUpdate" = true,
	"notes" = 'Balance updated to ' || to_char(r."balance", 'FM999,999,999,999,990.00') || ' ' || t."currency"
FROM (
	SELECT tx."id", sum(CASE WHEN tx."type" = 'withdraw' THEN -tx."amount" ELSE tx."amount" END)
		OVER (PARTITION BY tx."accountId", tx."currency" ORDER BY tx."date", tx."createdAt", tx."id") AS "balance"
	FROM "transactions" AS tx
	JOIN "accounts" AS a ON a."id" = tx."accountId"
	WHERE a."type" = 'cash'
) AS r
WHERE t."id" = r."id";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "type";--> statement-breakpoint
DROP TYPE "public"."account_type";
