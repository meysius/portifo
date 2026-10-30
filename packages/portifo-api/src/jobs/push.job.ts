import { BackgroundJob } from "@/setup/jobs";
import { PushService, SEND_PUSH_JOB, SendPushData } from "@/domain/push/push.service";

export class SendPushJob implements BackgroundJob<SendPushData> {
  readonly name = SEND_PUSH_JOB;

  constructor(private readonly pushService: PushService) {}

  run = (data: SendPushData) => this.pushService.deliver(data.subscriptionId, data.payload);
}
