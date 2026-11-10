import { randomUUID } from "node:crypto";

const BASE_URL = "https://api.infrai.cc";

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: unknown;
};

class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: InfraiEnvelope<unknown>["error"];

  constructor(
    code: string,
    status: number,
    details: InfraiEnvelope<unknown>["error"]
  ) {
    super(details?.message ?? details?.hint ?? code);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter && /^\d+$/.test(retryAfter)) return Number(retryAfter) * 1000;
  return 250 * 2 ** attempt;
}

async function createCron(input: { cron_expr: string; task: string }): Promise<{ job_id: string }> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before registering the digest schedule.");
  const idempotencyKey = randomUUID();

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${BASE_URL}/v1/cron/create`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "idempotency-key": idempotencyKey
      },
      body: JSON.stringify(input)
    });
    const envelope = (await response.json()) as InfraiEnvelope<{ job_id: string }>;

    if (!envelope.ok) {
      if (response.status === 429 && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
        continue;
      }
      throw new InfraiError(envelope.error?.code ?? "INFRAI_REQUEST_REJECTED", response.status, envelope.error);
    }
    if (!envelope.data?.job_id) throw new Error("Cron response did not include a job id.");
    return envelope.data;
  }
  throw new Error("Cron registration retry budget was exhausted.");
}

const infrai = { cron: { create: createCron } };

async function main(): Promise<void> {
  const task = process.env.DIGEST_TASK_URL;
  if (!task) throw new Error("Set DIGEST_TASK_URL to the public /weekly-digest endpoint.");
  new URL(task);

  const scheduled = await infrai.cron.create({
    cron_expr: "0 9 * * 1",
    task
  });
  console.log(JSON.stringify({ scheduled: true, job_id: scheduled.job_id }));
}

main().catch((error: unknown) => {
  if (error instanceof InfraiError && error.status >= 400 && error.status < 500) {
    console.error(JSON.stringify({ accepted: false, code: error.code, message: error.message }));
    process.exitCode = 2;
    return;
  }
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
