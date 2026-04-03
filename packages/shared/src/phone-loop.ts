import { z } from "zod";

/**
 * Core identifiers
 */
export const CallId = z.string().min(1);
export type CallId = z.infer<typeof CallId>;

export const ContactId = z.string().min(1);
export type ContactId = z.infer<typeof ContactId>;

export const ISODateTime = z.string().datetime({ offset: true });
export type ISODateTime = z.infer<typeof ISODateTime>;

export const PhoneNumber = z
  .string()
  .min(7)
  .max(32)
  .regex(/^[+0-9().\-\s]+$/, "Invalid phone number format");
export type PhoneNumber = z.infer<typeof PhoneNumber>;

/**
 * Terminal outcomes.
 * These are the only successful terminal states.
 */
export const CallOutcome = z.enum([
  "booked",
  "escalated",
  "follow_up_sent",
  "task_created",
  "disqualified",
]);
export type CallOutcome = z.infer<typeof CallOutcome>;

/**
 * Raw call metadata from the telephony layer.
 */
export const CallChannel = z.enum(["voice_inbound", "voice_outbound"]);
export type CallChannel = z.infer<typeof CallChannel>;

export const CallMetadata = z.object({
  callId: CallId,
  channel: CallChannel,
  startedAt: ISODateTime,
  endedAt: ISODateTime.optional(),
  fromPhone: PhoneNumber,
  toPhone: PhoneNumber,
  twilioCallSid: z.string().min(1),
  recordingUrl: z.string().url().optional(),
  durationSeconds: z.number().int().nonnegative().optional(),
});
export type CallMetadata = z.infer<typeof CallMetadata>;

/**
 * Structured transcript model.
 */
export const TranscriptTurnSpeaker = z.enum([
  "caller",
  "agent",
  "human",
  "system",
]);
export type TranscriptTurnSpeaker = z.infer<typeof TranscriptTurnSpeaker>;

export const TranscriptTurn = z.object({
  speaker: TranscriptTurnSpeaker,
  text: z.string().min(1),
  timestamp: ISODateTime.optional(),
});
export type TranscriptTurn = z.infer<typeof TranscriptTurn>;

export const CallTranscript = z.object({
  turns: z.array(TranscriptTurn).min(1),
  rawText: z.string().optional(),
});
export type CallTranscript = z.infer<typeof CallTranscript>;

/**
 * Contact snapshot at routing time.
 */
export const ContactSnapshot = z.object({
  contactId: ContactId.optional(),
  phone: PhoneNumber.optional(),
  customerName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  isDoNotCall: z.boolean().default(false),
  lastOutcome: CallOutcome.optional(),
  lastContactAt: ISODateTime.optional(),
  notes: z.string().default(""),
});
export type ContactSnapshot = z.infer<typeof ContactSnapshot>;

/**
 * Classification emitted by call-intelligence.
 * This is descriptive, not prescriptive.
 */
export const CallIntent = z.enum([
  "booking",
  "inquiry",
  "emergency",
  "support",
  "billing",
  "spam",
  "unknown",
]);
export type CallIntent = z.infer<typeof CallIntent>;

export const CallUrgency = z.enum(["low", "medium", "high"]);
export type CallUrgency = z.infer<typeof CallUrgency>;

export const ExtractedEntities = z.object({
  dates: z.array(z.string()).default([]),
  prices: z.array(z.string()).default([]),
  addresses: z.array(z.string()).default([]),
  services: z.array(z.string()).default([]),
});
export type ExtractedEntities = z.infer<typeof ExtractedEntities>;

export const CallClassification = z.object({
  intent: CallIntent,
  urgency: CallUrgency,
  confidence: z.number().min(0).max(1),
  customerName: z.string().min(1).optional(),
  phone: PhoneNumber.optional(),
  email: z.string().email().optional(),
  requestedTime: z.string().min(1).optional(),
  serviceAddress: z.string().min(1).optional(),
  summary: z.string().min(1),
  notes: z.string().default(""),
  extractedEntities: ExtractedEntities.default({
    dates: [],
    prices: [],
    addresses: [],
    services: [],
  }),
  disqualificationReason: z.string().optional(),
});
export type CallClassification = z.infer<typeof CallClassification>;

/**
 * Deterministic next action selected by the decision engine.
 */
export const NextAction = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("book"),
    requestedTime: z.string().optional(),
    reason: z.string().min(1),
  }),
  z.object({
    type: z.literal("escalate"),
    urgency: z.enum(["medium", "high"]),
    queue: z.string().min(1).optional(),
    reason: z.string().min(1),
  }),
  z.object({
    type: z.literal("send_sms"),
    template: z.enum([
      "booking_confirmation",
      "missed_call_recovery",
      "follow_up",
      "info_request",
    ]),
    reason: z.string().min(1),
  }),
  z.object({
    type: z.literal("create_task"),
    taskType: z.enum([
      "manual_follow_up",
      "quote_request",
      "support_review",
      "callback",
    ]),
    reason: z.string().min(1),
  }),
  z.object({
    type: z.literal("disqualify"),
    reason: z.string().min(1),
  }),
]);
export type NextAction = z.infer<typeof NextAction>;

/**
 * Action execution results.
 */
export const BookingResult = z.object({
  status: z.enum(["booked", "rescheduled"]),
  appointmentId: z.string().min(1),
  scheduledFor: ISODateTime.optional(),
  confirmationMessage: z.string().min(1),
});
export type BookingResult = z.infer<typeof BookingResult>;

export const SmsResult = z.object({
  status: z.enum(["sent", "queued"]),
  messageSid: z.string().min(1),
  template: z.string().min(1),
});
export type SmsResult = z.infer<typeof SmsResult>;

export const TaskResult = z.object({
  status: z.literal("created"),
  taskId: z.string().min(1),
  taskType: z.string().min(1),
});
export type TaskResult = z.infer<typeof TaskResult>;

export const EscalationResult = z.object({
  status: z.literal("escalated"),
  handoffId: z.string().min(1),
  queue: z.string().optional(),
});
export type EscalationResult = z.infer<typeof EscalationResult>;

export const DisqualificationResult = z.object({
  status: z.literal("disqualified"),
  reason: z.string().min(1),
});
export type DisqualificationResult = z.infer<typeof DisqualificationResult>;

export const ActionExecutionResult = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("book"),
    result: BookingResult,
  }),
  z.object({
    type: z.literal("send_sms"),
    result: SmsResult,
  }),
  z.object({
    type: z.literal("create_task"),
    result: TaskResult,
  }),
  z.object({
    type: z.literal("escalate"),
    result: EscalationResult,
  }),
  z.object({
    type: z.literal("disqualify"),
    result: DisqualificationResult,
  }),
]);
export type ActionExecutionResult = z.infer<typeof ActionExecutionResult>;

/**
 * Final closed-loop record.
 */
export const ClosedLoopCallRecord = z.object({
  callId: CallId,
  metadata: CallMetadata,
  transcript: CallTranscript,
  contact: ContactSnapshot.optional(),
  classification: CallClassification,
  nextAction: NextAction,
  execution: ActionExecutionResult,
  finalOutcome: CallOutcome,
  finalOutcomeReason: z.string().min(1),
  completedAt: ISODateTime,
});
export type ClosedLoopCallRecord = z.infer<typeof ClosedLoopCallRecord>;

export function deriveOutcome(
  action: NextAction,
  execution: ActionExecutionResult,
): CallOutcome {
  switch (action.type) {
    case "book":
      if (execution.type !== "book") {
        throw new Error("Execution/result mismatch for book action");
      }
      return "booked";

    case "escalate":
      if (execution.type !== "escalate") {
        throw new Error("Execution/result mismatch for escalate action");
      }
      return "escalated";

    case "send_sms":
      if (execution.type !== "send_sms") {
        throw new Error("Execution/result mismatch for send_sms action");
      }
      return "follow_up_sent";

    case "create_task":
      if (execution.type !== "create_task") {
        throw new Error("Execution/result mismatch for create_task action");
      }
      return "task_created";

    case "disqualify":
      if (execution.type !== "disqualify") {
        throw new Error("Execution/result mismatch for disqualify action");
      }
      return "disqualified";
  }
}

export function assertClosedLoop(record: ClosedLoopCallRecord): ClosedLoopCallRecord {
  const derived = deriveOutcome(record.nextAction, record.execution);

  if (record.finalOutcome !== derived) {
    throw new Error(`Invalid finalOutcome: expected ${derived}, got ${record.finalOutcome}`);
  }

  return ClosedLoopCallRecord.parse(record);
}

export const FallbackAction = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("send_sms"),
    template: z.enum(["missed_call_recovery", "follow_up"]),
    reason: z.string().min(1),
  }),
  z.object({
    type: z.literal("create_task"),
    taskType: z.enum(["manual_follow_up", "callback"]),
    reason: z.string().min(1),
  }),
  z.object({
    type: z.literal("escalate"),
    urgency: z.enum(["medium", "high"]),
    reason: z.string().min(1),
  }),
]);
export type FallbackAction = z.infer<typeof FallbackAction>;

/**
 * Shared plugin IO contracts.
 */
export const CallIntelligenceInput = z.object({
  metadata: CallMetadata,
  transcript: CallTranscript,
  contact: ContactSnapshot.optional(),
});
export type CallIntelligenceInput = z.infer<typeof CallIntelligenceInput>;

export const CallIntelligenceOutput = CallClassification;
export type CallIntelligenceOutput = z.infer<typeof CallIntelligenceOutput>;

export const DecisionEngineInput = z.object({
  metadata: CallMetadata,
  classification: CallClassification,
  contact: ContactSnapshot.optional(),
});
export type DecisionEngineInput = z.infer<typeof DecisionEngineInput>;

export const DecisionEngineOutput = NextAction;
export type DecisionEngineOutput = z.infer<typeof DecisionEngineOutput>;

export const BookingInput = z.object({
  callId: CallId,
  action: z.object({
    type: z.literal("book"),
    requestedTime: z.string().optional(),
    reason: z.string().min(1),
  }),
  classification: CallClassification,
  contact: ContactSnapshot.optional(),
});
export type BookingInput = z.infer<typeof BookingInput>;

export const SmsFollowupInput = z.object({
  callId: CallId,
  action: z.object({
    type: z.literal("send_sms"),
    template: z.enum([
      "booking_confirmation",
      "missed_call_recovery",
      "follow_up",
      "info_request",
    ]),
    reason: z.string().min(1),
  }),
  classification: CallClassification,
  contact: ContactSnapshot.optional(),
});
export type SmsFollowupInput = z.infer<typeof SmsFollowupInput>;

export const TaskCreateInput = z.object({
  callId: CallId,
  action: z.object({
    type: z.literal("create_task"),
    taskType: z.enum([
      "manual_follow_up",
      "quote_request",
      "support_review",
      "callback",
    ]),
    reason: z.string().min(1),
  }),
  classification: CallClassification,
  contact: ContactSnapshot.optional(),
});
export type TaskCreateInput = z.infer<typeof TaskCreateInput>;

export const EscalationInput = z.object({
  callId: CallId,
  action: z.object({
    type: z.literal("escalate"),
    urgency: z.enum(["medium", "high"]),
    queue: z.string().min(1).optional(),
    reason: z.string().min(1),
  }),
  classification: CallClassification,
  contact: ContactSnapshot.optional(),
});
export type EscalationInput = z.infer<typeof EscalationInput>;

export const DisqualifyInput = z.object({
  callId: CallId,
  action: z.object({
    type: z.literal("disqualify"),
    reason: z.string().min(1),
  }),
  classification: CallClassification,
  contact: ContactSnapshot.optional(),
});
export type DisqualifyInput = z.infer<typeof DisqualifyInput>;

export const CrmMemoryWriteInput = z.object({
  callId: CallId,
  contact: ContactSnapshot.optional(),
  classification: CallClassification,
  nextAction: NextAction,
  execution: ActionExecutionResult,
  finalOutcome: CallOutcome,
  finalOutcomeReason: z.string().min(1),
});
export type CrmMemoryWriteInput = z.infer<typeof CrmMemoryWriteInput>;

export const OutcomeEnforcerInput = z.object({
  metadata: CallMetadata,
  transcript: CallTranscript,
  contact: ContactSnapshot.optional(),
  classification: CallClassification,
  nextAction: NextAction,
  execution: ActionExecutionResult.optional(),
});
export type OutcomeEnforcerInput = z.infer<typeof OutcomeEnforcerInput>;
