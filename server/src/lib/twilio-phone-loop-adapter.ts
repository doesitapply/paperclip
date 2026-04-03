import { closedLoopCalls, type Db, callExecutionAttempts } from "@paperclipai/db";
import {
  type ActionExecutionResult,
  type CallClassification,
  type CallIntelligenceInput,
  type CallTranscript,
  type ContactSnapshot,
  type NextAction,
  runPhoneLoop,
  type PhoneLoopDeps,
  type PhoneLoopRunResult,
} from "@paperclipai/shared";
import { parseTwilioInboundEvent, type TwilioInboundEvent } from "./twilio-inbound.js";

export interface TwilioPhoneLoopAdapterDeps extends Partial<Omit<PhoneLoopDeps, "writeCrmMemory" | "now">> {
  lookupContact?: (event: TwilioInboundEvent) => Promise<ContactSnapshot | undefined>;
  writeCrmMemory?: PhoneLoopDeps["writeCrmMemory"];
  now?: () => string;
  executorMetadata?: Partial<Record<NextAction["type"], {
    executionMode: "live" | "stub";
    provider?: string;
  }>>;
}

function defaultClassifier(input: CallIntelligenceInput): Promise<CallClassification> {
  const text = (input.transcript.rawText ?? input.transcript.turns.map((turn) => turn.text).join(" ")).toLowerCase();
  if (text.includes("emergency") || text.includes("urgent")) {
    return Promise.resolve({
      intent: "emergency",
      urgency: "high",
      confidence: 0.9,
      summary: "Emergency language detected in call transcript",
      notes: "",
      extractedEntities: { dates: [], prices: [], addresses: [], services: [] },
    });
  }
  if (text.includes("book") || text.includes("appointment") || text.includes("schedule")) {
    return Promise.resolve({
      intent: "booking",
      urgency: "medium",
      confidence: 0.8,
      requestedTime: text,
      summary: "Booking request detected in call transcript",
      notes: "",
      extractedEntities: { dates: [], prices: [], addresses: [], services: [] },
    });
  }
  if (text.includes("spam") || text.includes("wrong number")) {
    return Promise.resolve({
      intent: "spam",
      urgency: "low",
      confidence: 0.95,
      summary: "Spam or irrelevant call detected",
      notes: "",
      extractedEntities: { dates: [], prices: [], addresses: [], services: [] },
      disqualificationReason: "Spam or wrong number",
    });
  }
  return Promise.resolve({
    intent: "unknown",
    urgency: "low",
    confidence: 0.4,
    summary: "Unable to classify call confidently from transcript",
    notes: "",
    extractedEntities: { dates: [], prices: [], addresses: [], services: [] },
  });
}

function defaultWriteCrmMemory(): Promise<void> {
  return Promise.resolve();
}

function missingExecutor(name: string) {
  return async (): Promise<ActionExecutionResult> => {
    throw new Error(`${name} is not configured`);
  };
}

function buildTranscript(event: TwilioInboundEvent, now: string): CallTranscript {
  return {
    turns: [
      {
        speaker: "caller",
        text: event.transcriptText,
        timestamp: now,
      },
    ],
    rawText: event.transcriptText,
  };
}

function toCallIntelligenceInput(
  event: TwilioInboundEvent,
  contact: ContactSnapshot | undefined,
  now: string,
): CallIntelligenceInput {
  return {
    metadata: {
      callId: event.callSid,
      channel: "voice_inbound",
      startedAt: now,
      fromPhone: event.fromPhone,
      toPhone: event.toPhone,
      twilioCallSid: event.callSid,
      recordingUrl: event.recordingUrl,
      durationSeconds: event.durationSeconds,
    },
    transcript: buildTranscript(event, now),
    contact,
  };
}

export async function persistPhoneLoopResult(
  db: Db,
  companyId: string,
  result: PhoneLoopRunResult,
  executorMetadata: TwilioPhoneLoopAdapterDeps["executorMetadata"] = {},
): Promise<void> {
  const inserted = await db.insert(closedLoopCalls).values({
    companyId,
    callId: result.record.callId,
    contactId: result.record.contact?.contactId ?? null,
    twilioCallSid: result.record.metadata.twilioCallSid,
    startedAt: new Date(result.record.metadata.startedAt),
    completedAt: new Date(result.record.completedAt),
    intent: result.record.classification.intent,
    urgency: result.record.classification.urgency,
    confidence: result.record.classification.confidence,
    nextActionType: result.record.nextAction.type,
    finalOutcome: result.record.finalOutcome,
    finalOutcomeReason: result.record.finalOutcomeReason,
    summary: result.record.classification.summary,
    rawRecordJson: result.record as unknown as Record<string, unknown>,
  }).returning({ id: closedLoopCalls.id });

  const callRecordId = inserted[0]?.id;
  if (!callRecordId) return;

  if (result.attempts.length > 0) {
    await db.insert(callExecutionAttempts).values(
      result.attempts.map((attempt) => ({
        companyId,
        closedLoopCallId: callRecordId,
        callId: result.record.callId,
        sequence: attempt.sequence,
        actionType: attempt.action.type,
        reason: attempt.action.reason,
        status: attempt.status,
        executionMode: executorMetadata?.[attempt.action.type]?.executionMode ?? "stub",
        provider: executorMetadata?.[attempt.action.type]?.provider ?? null,
        externalId: attempt.result?.type === "send_sms"
          ? attempt.result.result.messageSid
          : attempt.result?.type === "book"
            ? attempt.result.result.appointmentId
            : attempt.result?.type === "create_task"
              ? attempt.result.result.taskId
              : attempt.result?.type === "escalate"
                ? attempt.result.result.handoffId
                : null,
        template: attempt.action.type === "send_sms" ? attempt.action.template : null,
        error: attempt.error ?? null,
        startedAt: new Date(attempt.startedAt),
        finishedAt: new Date(attempt.finishedAt),
        payloadJson: attempt.action as unknown as Record<string, unknown>,
      })),
    );
  }
}

export async function runTwilioPhoneLoop(
  db: Db,
  event: TwilioInboundEvent,
  deps: TwilioPhoneLoopAdapterDeps,
): Promise<PhoneLoopRunResult> {
  const now = deps.now?.() ?? new Date().toISOString();
  const contact = await deps.lookupContact?.(event);
  const input = toCallIntelligenceInput(event, contact, now);
  const result = await runPhoneLoop(input, {
    classifyCall: deps.classifyCall ?? defaultClassifier,
    executeBooking: deps.executeBooking ?? missingExecutor("executeBooking"),
    executeSmsFollowup: deps.executeSmsFollowup ?? missingExecutor("executeSmsFollowup"),
    executeTaskCreate: deps.executeTaskCreate ?? missingExecutor("executeTaskCreate"),
    executeEscalation: deps.executeEscalation ?? missingExecutor("executeEscalation"),
    executeDisqualify: deps.executeDisqualify ?? missingExecutor("executeDisqualify"),
    writeCrmMemory: deps.writeCrmMemory ?? defaultWriteCrmMemory,
    now: deps.now,
  });
  await persistPhoneLoopResult(db, event.companyId, result, deps.executorMetadata);
  return result;
}

export function parseAndNormalizeTwilioInbound(body: Record<string, string | string[] | undefined>) {
  return parseTwilioInboundEvent(body);
}
