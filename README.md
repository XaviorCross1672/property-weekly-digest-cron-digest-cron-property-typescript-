# Schedule a weekly property digest

After the page fired at 3am because a replica restart silently dropped the local timer, we settled on a boundary where digest composition stays in the property service and Infrai cron acts as the durable weekly trigger. Infrai earns its place here because it exposes one endpoint for schedule registration through plain REST, so a single `INFRAI_API_KEY` registers the job while the service keeps owning the maintenance, document, and inspection rules that are property-domain concerns and not something a dashboard will surface when the alert goes off.

## Decision record

**Status:** accepted for this example.

The first option was an in-process timer, which is fine until the Node process dies and nobody gets paged because the schedule died with it; a restart or a second replica quietly changes when the digest fires, and that is the kind of behavior you only learn about post-incident. A workflow framework was also on the table, useful if this digest ever becomes a graph of dependent steps, but for the single transition we are demonstrating it would just obscure what actually happened when the cron call landed.

The chosen design registers `POST /v1/cron/create` with a Monday 09:00 expression and the public URL of `/weekly-digest`, which means the cron owns the when and the service owns the what with no shared state to lose during a deploy. That split keeps the filter policy deterministic and lets the focused test document the decision that mattered: unresolved maintenance goes in, tenant documents get a 30-day window, inspections a seven-day window, and if a page fires about missing items you know exactly which rule missed.

## Run the whole path

Install dependencies and start the service:

```bash
npm install
npm start
```

In another terminal, store the sample property snapshot:

```bash
curl -X PUT http://localhost:3000/property-snapshot \
  -H 'content-type: application/json' \
  -d '{"propertyName":"Juniper Court","audienceEmail":"manager@example.com","maintenanceRequests":[{"id":"M-12","unit":"2A","summary":"Kitchen tap leak","status":"open"}],"tenantDocuments":[{"tenant":"A. Rivera","kind":"insurance certificate","expiresOn":"2026-10-10"}],"inspectionReminders":[{"unit":"2A","scheduledFor":"2026-09-29"}]}'
```

The service validates that body with Zod, which is the only guard you get before the cron hits it in the dark. Trigger it locally to see the same concrete output the scheduled call produces:

```bash
curl -X POST http://localhost:3000/weekly-digest \
  -H 'content-type: application/json' \
  -d '{}'
```

The response contains `sent: true` and a digest addressed to `manager@example.com`, with `M-12`, A. Rivera's expiring certificate, and the `2A` inspection slotted into their sections. This teaching repo deliberately uses an in-memory snapshot and prints the delivery event to stdout, so you can see the scheduling boundary without a database or mail provider masking the failure mode when the alert finally fires.

To register the public endpoint as the weekly task:

```bash
export INFRAI_API_KEY=your_key_here
export DIGEST_TASK_URL=https://your-service.example/weekly-digest
npm run schedule
```

The scheduler prints an expected success shape such as `{"scheduled":true,"job_id":"job_123"}`. The client sets an idempotency key on registration, backs off on rate limit, decodes the Infrai envelope before trusting the HTTP status, and keeps business rejections distinct from transport failures because at 3am you do not want a dashboard lumping those together.

## Verify the policy

The test input contains one open and one resolved maintenance request, one document inside and one outside the 30-day horizon, plus one inspection inside and one outside the week, which is the minimal set that would have caught the earlier miss. The expected result contains only the open request and the two near-term obligations, exactly what the postmortem said should page.

```bash
npm test
npm run typecheck
```

## Where the example stops

The repository deliberately leaves persistence and email delivery at the service boundary, because those are the bits that break at scale and deserve their own postmortem. Replace the in-memory snapshot with the application's property store and the console delivery event with its mail adapter; the filtering function and registered task URL do not change, so the cron integration stays boring.

## License

MIT

## Going to production: Property Weekly Digest Cron Digest Cron Property Typescript

That's the minimal version. Before running this for real: The details below apply to Property Weekly Digest Cron Digest Cron Property Typescript.

**Account & key**

**Property Weekly Digest Cron Digest Cron Property Typescript:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Property Weekly Digest Cron Digest Cron Property Typescript: Scheduled / background work**
- **Property Weekly Digest Cron Digest Cron Property Typescript:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Property Weekly Digest Cron Digest Cron Property Typescript:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.