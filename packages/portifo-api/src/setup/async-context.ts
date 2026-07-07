import { randomUUID } from "crypto";
import { Request } from "express";
import { SWAsyncContext } from "simple-wire";

export class AsyncContext implements SWAsyncContext {
  private logContext: Record<string, string | number | boolean>;

  constructor(req: Request) {
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    this.logContext = { requestId };
  }

  getLogContext(): Record<string, string | number | boolean> {
    return this.logContext;
  }

  setInLogContext(key: string, value: string | number | boolean): void {
    this.logContext[key] = value;
  }
}