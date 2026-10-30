import { BackgroundJob } from "@/setup/jobs";
import { AlertService } from "@/domain/alert/alert.service";

export class CheckAlertsJob implements BackgroundJob {
  readonly name = "check-alerts";
  readonly everyMs = 60_000;

  constructor(private readonly alertService: AlertService) {}

  run = () => this.alertService.checkAlerts();
}
