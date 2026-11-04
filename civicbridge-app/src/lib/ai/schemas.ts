import { z } from "zod";
import { MAX_INTAKE_LENGTH } from "@/lib/privacy/guard";

export const LocaleSchema = z.enum(["en", "hi", "te"]);

export const SystemIdSchema = z.enum(["nch", "epfo", "railways"]);
export const RailwaySubflowSchema = z.enum(["railmadad", "tdr"]);
export const UrgencySchema = z.enum(["low", "medium", "high"]);

export const TriageResultSchema = z.object({
  system: SystemIdSchema,
  railwaySubflow: RailwaySubflowSchema.optional(),
  summary: z.string().min(1).max(600),
  extractedFields: z.record(z.string(), z.string().max(80)),
  missingFields: z.array(z.string().max(40)).max(12),
  confidence: z.number().min(0).max(1),
  urgency: UrgencySchema,
  disclaimer: z.string().min(1).max(400)
});
export type TriageResultData = z.infer<typeof TriageResultSchema>;

export const TriageRequestSchema = z.object({
  text: z.string().min(1).max(MAX_INTAKE_LENGTH),
  locale: LocaleSchema.default("en"),
  voiceLanguage: z.enum(["en-IN", "hi-IN", "te-IN", "ta-IN", "kn-IN", "ml-IN", "mr-IN", "bn-IN", "gu-IN", "pa-IN"]).optional()
});

/** Sanitized case snapshot sent to the escalation/status services. */
export const CaseSnapshotSchema = z.object({
  id: z.string().regex(/^CB-\d{4}-\d{5}$/),
  system: SystemIdSchema,
  railwaySubflow: RailwaySubflowSchema.optional(),
  locale: LocaleSchema,
  originalText: z.string().min(1).max(MAX_INTAKE_LENGTH),
  fields: z.record(z.string(), z.string().max(120)),
  statusCode: z.enum([
    "submitted",
    "in-progress",
    "awaiting-response",
    "response-received",
    "closed-unsatisfactory"
  ]),
  referenceNumber: z.string().max(60).optional(),
  expectedResponseDays: z.number().int().min(1).max(365),
  createdAt: z.string().datetime(),
  filingDeadlineAt: z.string().optional()
});
export type CaseSnapshot = z.infer<typeof CaseSnapshotSchema>;

export const EscalationRequestSchema = z.object({
  snapshot: CaseSnapshotSchema,
  addressedTo: z.string().min(1).max(300),
  facts: z
    .array(
      z.object({
        labelKey: z.string().max(80),
        value: z.string().max(160)
      })
    )
    .max(10),
  locale: LocaleSchema.default("en"),
  regenerate: z.boolean().default(false)
});

export const EscalationLetterSchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(6000)
});
export type EscalationLetterData = z.infer<typeof EscalationLetterSchema>;

export const StatusExplanationSchema = z.object({
  explanation: z.string().min(1).max(1500)
});
export type StatusExplanationData = z.infer<typeof StatusExplanationSchema>;

export const StatusRequestSchema = z.object({
  snapshot: CaseSnapshotSchema
});
