import webpush from "web-push";
import { SWLogger } from "simple-wire";
import { Config } from "@/setup/config";
import { PushRepo } from "./push.repo";

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

export class PushService {
  constructor(
    private readonly logger: SWLogger,
    private readonly pushRepo: PushRepo,
    cfg: Config,
  ) {
    webpush.setVapidDetails(`mailto:${cfg.VAPID_CONTACT_EMAIL}`, cfg.VAPID_PUBLIC_KEY, cfg.VAPID_PRIVATE_KEY);
  }

  async subscribe(userId: string, subscription: PushSubscriptionInput): Promise<void> {
    await this.pushRepo.upsertSubscription({
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    });
  }

  // Fans a payload out to every device the user has subscribed from, dropping
  // any subscription the push service reports as gone (410/404) rather than
  // retrying it forever.
  async sendToUser(userId: string, payload: PushPayload): Promise<{ sent: number; pruned: number }> {
    const subscriptions = await this.pushRepo.listSubscriptionsByUser(userId);
    let sent = 0;
    let pruned = 0;

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify(payload),
          );
          sent += 1;
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await this.pushRepo.deleteSubscriptionByEndpoint(sub.endpoint);
            pruned += 1;
          } else {
            this.logger.error("PushService.sendToUser failed to deliver to a subscription");
          }
        }
      }),
    );

    return { sent, pruned };
  }
}
