import webpush from "web-push";
import { SWLogger } from "simple-wire";
import { Config } from "@/setup/config";
import { JobQueue } from "@/setup/jobs";
import { PushRepo } from "./push.repo";
import { PushSubscriptionsSelect } from "./push.schema";

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

export const SEND_PUSH_JOB = "send-push";
export type SendPushData = { subscriptionId: string; payload: PushPayload };

// A push service that stops answering would otherwise hold a job slot forever.
const SEND_TIMEOUT_MS = 15_000;

export class PushService {
  constructor(
    private readonly logger: SWLogger,
    private readonly pushRepo: PushRepo,
    private readonly jobQueue: JobQueue,
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

  // Queues one delivery per device, each retried on its own, so a retry can't
  // repeat a notification on a device that already has it. Returns how many.
  async enqueueToUser(userId: string, payload: PushPayload): Promise<number> {
    const subscriptions = await this.pushRepo.listSubscriptionsByUser(userId);
    await Promise.all(
      subscriptions.map((sub) => {
        const data: SendPushData = { subscriptionId: sub.id, payload };
        return this.jobQueue.enqueue(SEND_PUSH_JOB, data);
      }),
    );
    return subscriptions.length;
  }

  // Throws on a failure worth retrying. A device that unsubscribed while the
  // job waited, or that the push service reports as gone, isn't one.
  async deliver(subscriptionId: string, payload: PushPayload): Promise<void> {
    const sub = await this.pushRepo.findSubscription(subscriptionId);
    if (sub) await this.send(sub, payload);
  }

  // Sends straight away, for when someone is waiting on the answer.
  async sendToUser(userId: string, payload: PushPayload): Promise<{ sent: number; pruned: number }> {
    const subscriptions = await this.pushRepo.listSubscriptionsByUser(userId);
    let sent = 0;
    let pruned = 0;

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          if (await this.send(sub, payload)) sent += 1;
          else pruned += 1;
        } catch (err) {
          this.logger.error("PushService.sendToUser failed to deliver to a subscription");
        }
      }),
    );

    return { sent, pruned };
  }

  // False when the device is gone: it's dropped (410/404) rather than retried
  // forever.
  private async send(sub: PushSubscriptionsSelect, payload: PushPayload): Promise<boolean> {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload),
        // A price alert is time-sensitive, and Apple may hold back a normal one.
        { urgency: "high", timeout: SEND_TIMEOUT_MS },
      );
      return true;
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode !== 404 && statusCode !== 410) throw err;
      await this.pushRepo.deleteSubscriptionByEndpoint(sub.endpoint);
      return false;
    }
  }
}
