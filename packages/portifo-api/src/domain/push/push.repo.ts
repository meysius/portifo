import { eq } from "drizzle-orm";
import { DrizzleDb } from "@/setup/db";
import { pushSubscriptions, PushSubscriptionsInsert, PushSubscriptionsSelect } from "./push.schema";

export interface PushRepo {
  upsertSubscription(subscription: PushSubscriptionsInsert): Promise<PushSubscriptionsSelect>;
  listSubscriptionsByUser(userId: string): Promise<PushSubscriptionsSelect[]>;
  deleteSubscriptionByEndpoint(endpoint: string): Promise<void>;
}

export class DrizzlePushRepo implements PushRepo {
  constructor(private readonly db: DrizzleDb) {}

  async upsertSubscription(subscription: PushSubscriptionsInsert): Promise<PushSubscriptionsSelect> {
    const result = await this.db
      .insert(pushSubscriptions)
      .values(subscription)
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { userId: subscription.userId, p256dh: subscription.p256dh, auth: subscription.auth },
      })
      .returning();
    return result[0];
  }

  async listSubscriptionsByUser(userId: string): Promise<PushSubscriptionsSelect[]> {
    return this.db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  }

  async deleteSubscriptionByEndpoint(endpoint: string): Promise<void> {
    await this.db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  }
}
