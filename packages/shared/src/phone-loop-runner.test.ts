import { describe, expect, it, vi } from "vitest";
import { runPhoneLoop, type PhoneLoopDeps } from "./phone-loop-runner.js";
import type {
  ActionExecutionResult,
  BookingInput,
  CallClassification,
  CallIntelligenceInput,
  CrmMemoryWriteInput,
  DisqualifyInput,
  EscalationInput,
  SmsFollowupInput,
  TaskCreateInput,
} from "./phone-loop.js";

const input: CallIntelligenceInput = {
  metadata: {
    callId: "call-123",
    channel: "voice_inbound",
    startedAt: "2026-04-03T18:00:00+00:00",
    fromPhone: "+15551234567",
    toPhone: "+15557654321",
    twilioCallSid: "CA123",
  },
  transcript: {
    turns: [{ speaker: "caller", text: "I need someone tomorrow at 4pm" }],
  },
  contact: {
    customerName: "Jordan",
    phone: "+15551234567",
    isDoNotCall: false,
    notes: "",
  },
};

const bookingClassification: CallClassification = {
  intent: "booking",
  urgency: "medium",
  confidence: 0.92,
  requestedTime: "2026-04-04T16:00:00+00:00",
  summary: "Caller wants to book a repair visit",
  notes: "",
  extractedEntities: {
    dates: [],
    prices: [],
    addresses: [],
    services: [],
  },
};

function createDeps(overrides?: {
  classifyCall?: (input: CallIntelligenceInput) => Promise<CallClassification>;
  executeBooking?: (input: BookingInput) => Promise<ActionExecutionResult>;
  executeSmsFollowup?: (input: SmsFollowupInput) => Promise<ActionExecutionResult>;
  executeTaskCreate?: (input: TaskCreateInput) => Promise<ActionExecutionResult>;
  executeEscalation?: (input: EscalationInput) => Promise<ActionExecutionResult>;
  executeDisqualify?: (input: DisqualifyInput) => Promise<ActionExecutionResult>;
  writeCrmMemory?: (input: CrmMemoryWriteInput) => Promise<void>;
}): PhoneLoopDeps {
  return {
    classifyCall: overrides?.classifyCall ?? vi.fn<PhoneLoopDeps["classifyCall"]>(async () => bookingClassification),
    executeBooking: overrides?.executeBooking ?? vi.fn<PhoneLoopDeps["executeBooking"]>(async () => ({
      type: "book",
      result: {
        status: "booked",
        appointmentId: "appt-123",
        scheduledFor: "2026-04-04T16:00:00+00:00",
        confirmationMessage: "Booked for tomorrow at 4pm",
      },
    })),
    executeSmsFollowup: overrides?.executeSmsFollowup ?? vi.fn<PhoneLoopDeps["executeSmsFollowup"]>(async () => ({
      type: "send_sms",
      result: {
        status: "sent",
        messageSid: "SM123",
        template: "missed_call_recovery",
      },
    })),
    executeTaskCreate: overrides?.executeTaskCreate ?? vi.fn<PhoneLoopDeps["executeTaskCreate"]>(async () => ({
      type: "create_task",
      result: {
        status: "created",
        taskId: "task-123",
        taskType: "callback",
      },
    })),
    executeEscalation: overrides?.executeEscalation ?? vi.fn<PhoneLoopDeps["executeEscalation"]>(async () => ({
      type: "escalate",
      result: {
        status: "escalated",
        handoffId: "handoff-123",
        queue: "priority",
      },
    })),
    executeDisqualify: overrides?.executeDisqualify ?? vi.fn<PhoneLoopDeps["executeDisqualify"]>(async () => ({
      type: "disqualify",
      result: {
        status: "disqualified",
        reason: "Spam call",
      },
    })),
    writeCrmMemory: overrides?.writeCrmMemory ?? vi.fn<PhoneLoopDeps["writeCrmMemory"]>(async () => {}),
    now: () => "2026-04-03T18:05:00+00:00",
  };
}

describe("phone-loop-runner", () => {
  it("runs a successful booking loop and persists the final record", async () => {
    const deps = createDeps();

    const result = await runPhoneLoop(input, deps);

    expect(result.attemptedAction).toEqual({
      type: "book",
      requestedTime: "2026-04-04T16:00:00+00:00",
      reason: "Booking intent with requested time provided",
    });
    expect(result.fallbackAction).toBeUndefined();
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0]?.status).toBe("succeeded");
    expect(result.attempts[0]?.result?.type).toBe("book");
    expect(result.record.finalOutcome).toBe("booked");
    expect(result.record.nextAction.type).toBe("book");
    expect(deps.writeCrmMemory).toHaveBeenCalledTimes(1);
  });

  it("falls back to SMS when the primary booking execution fails", async () => {
    const deps = createDeps({
      executeBooking: vi.fn(async () => {
        throw new Error("Calendar unavailable");
      }),
    });

    const result = await runPhoneLoop(input, deps);

    expect(result.attemptedAction.type).toBe("book");
    expect(result.fallbackAction).toEqual({
      type: "send_sms",
      template: "missed_call_recovery",
      reason: "Primary action did not complete, sending fallback SMS",
    });
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[0]).toMatchObject({
      sequence: 1,
      status: "failed",
      error: "Calendar unavailable",
    });
    expect(result.attempts[1]).toMatchObject({
      sequence: 2,
      status: "succeeded",
      action: {
        type: "send_sms",
        template: "missed_call_recovery",
      },
      result: {
        type: "send_sms",
      },
    });
    expect(result.record.nextAction).toEqual(result.fallbackAction);
    expect(result.record.finalOutcome).toBe("follow_up_sent");
    expect(result.record.finalOutcomeReason).toContain("Calendar unavailable");
  });
});
