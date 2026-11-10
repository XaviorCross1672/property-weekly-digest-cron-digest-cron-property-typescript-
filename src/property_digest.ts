import { z } from "zod";

const dateString = z.string().date();

export const propertySnapshotSchema = z.object({
  propertyName: z.string().min(1),
  audienceEmail: z.string().email(),
  maintenanceRequests: z.array(z.object({
    id: z.string().min(1),
    unit: z.string().min(1),
    summary: z.string().min(1),
    status: z.enum(["open", "in_progress", "resolved"])
  })),
  tenantDocuments: z.array(z.object({
    tenant: z.string().min(1),
    kind: z.string().min(1),
    expiresOn: dateString
  })),
  inspectionReminders: z.array(z.object({
    unit: z.string().min(1),
    scheduledFor: dateString
  }))
});

export type PropertySnapshot = z.infer<typeof propertySnapshotSchema>;

export type WeeklyDigest = {
  propertyName: string;
  recipient: string;
  subject: string;
  openMaintenance: PropertySnapshot["maintenanceRequests"];
  documentsExpiringSoon: PropertySnapshot["tenantDocuments"];
  inspectionsThisWeek: PropertySnapshot["inspectionReminders"];
};

function daysAfter(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export function buildWeeklyDigest(snapshot: PropertySnapshot, asOf: Date): WeeklyDigest {
  const today = asOf.toISOString().slice(0, 10);
  const weekEnd = daysAfter(asOf, 7).toISOString().slice(0, 10);
  const documentHorizon = daysAfter(asOf, 30).toISOString().slice(0, 10);

  const openMaintenance = snapshot.maintenanceRequests.filter(
    (request) => request.status !== "resolved"
  );
  const documentsExpiringSoon = snapshot.tenantDocuments.filter(
    (document) => document.expiresOn >= today && document.expiresOn <= documentHorizon
  );
  const inspectionsThisWeek = snapshot.inspectionReminders.filter(
    (inspection) => inspection.scheduledFor >= today && inspection.scheduledFor <= weekEnd
  );

  return {
    propertyName: snapshot.propertyName,
    recipient: snapshot.audienceEmail,
    subject: `${snapshot.propertyName}: weekly property digest`,
    openMaintenance,
    documentsExpiringSoon,
    inspectionsThisWeek
  };
}
