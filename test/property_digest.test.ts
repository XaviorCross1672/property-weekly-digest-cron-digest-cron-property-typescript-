import assert from "node:assert/strict";
import test from "node:test";
import { buildWeeklyDigest, propertySnapshotSchema } from "../src/property_digest.js";

test("the weekly digest keeps active work and only near-term obligations", () => {
  const snapshot = propertySnapshotSchema.parse({
    propertyName: "Juniper Court",
    audienceEmail: "manager@example.com",
    maintenanceRequests: [
      { id: "M-12", unit: "2A", summary: "Kitchen tap leak", status: "open" },
      { id: "M-09", unit: "1C", summary: "Replace hallway lamp", status: "resolved" }
    ],
    tenantDocuments: [
      { tenant: "A. Rivera", kind: "insurance certificate", expiresOn: "2026-10-10" },
      { tenant: "D. Chen", kind: "parking addendum", expiresOn: "2026-12-01" }
    ],
    inspectionReminders: [
      { unit: "2A", scheduledFor: "2026-09-29" },
      { unit: "4B", scheduledFor: "2026-10-20" }
    ]
  });

  const digest = buildWeeklyDigest(snapshot, new Date("2026-09-25T00:00:00.000Z"));

  assert.deepEqual(digest.openMaintenance.map((item) => item.id), ["M-12"]);
  assert.deepEqual(digest.documentsExpiringSoon.map((item) => item.tenant), ["A. Rivera"]);
  assert.deepEqual(digest.inspectionsThisWeek.map((item) => item.unit), ["2A"]);
});
