import { createServer, type ServerResponse } from "node:http";
import { z } from "zod";
import { buildWeeklyDigest, propertySnapshotSchema, type PropertySnapshot } from "./property_digest.js";

const triggerSchema = z.object({}).strict();
let currentSnapshot: PropertySnapshot | undefined;

async function readJson(request: AsyncIterable<Buffer>): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text.length === 0 ? {} : JSON.parse(text);
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body, null, 2));
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === "PUT" && request.url === "/property-snapshot") {
      currentSnapshot = propertySnapshotSchema.parse(await readJson(request));
      sendJson(response, 200, { stored: true, propertyName: currentSnapshot.propertyName });
      return;
    }

    if (request.method === "POST" && request.url === "/weekly-digest") {
      triggerSchema.parse(await readJson(request));
      if (!currentSnapshot) {
        sendJson(response, 409, { error: "Seed a property snapshot before requesting a digest." });
        return;
      }
      const digest = buildWeeklyDigest(currentSnapshot, new Date());
      console.log(JSON.stringify({ event: "weekly_digest_sent", digest }));
      sendJson(response, 200, { sent: true, digest });
      return;
    }

    sendJson(response, 404, { error: "Route not found." });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      sendJson(response, 400, { error: "Request body is invalid." });
      return;
    }
    sendJson(response, 500, { error: "Digest service could not process the request." });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Property digest service listening on http://localhost:${port}`));
