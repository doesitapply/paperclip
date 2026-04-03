import { describe, expect, it } from "vitest";
import { decideNextAction, deriveFallbackAction } from "./decision-engine.js";
import type { DecisionEngineInput, OutcomeEnforcerInput } from "./phone-loop.js";

const baseInput: DecisionEngineInput = {
  metadata: {
    callId: "call-123",
    channel: "voice_inbound",
    startedAt: "2026-04-03T18:00:00+00:00",
    fromPhone: "+15551234567",
    toPhone: "+15557654321",
    twilioCallSid: "CA123",
  },
  classification: {
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
  },
  contact: {
    customerName: "Jordan",
    phone: "+15551234567",
    isDoNotCall: false,
    notes: "",
  },
};

describe("decision-engine", () => {
  it("books high-confidence booking requests with a requested time", () => {
    expect(decideNextAction(baseInput)).toEqual({
      type: "book",
      requestedTime: "2026-04-04T16:00:00+00:00",
      reason: "Booking intent with requested time provided",
    });
  });

  it("disqualifies non-emergency do-not-call contacts", () => {
    expect(decideNextAction({
      ...baseInput,
      contact: {
        customerName: "Jordan",
        phone: "+15551234567",
        isDoNotCall: true,
        notes: "",
      },
    })).toEqual({
      type: "disqualify",
      reason: "Contact is marked do-not-call",
    });
  });

  it("escalates emergency calls immediately", () => {
    expect(decideNextAction({
      ...baseInput,
      classification: {
        ...baseInput.classification,
        intent: "emergency",
        urgency: "high",
      },
    })).toEqual({
      type: "escalate",
      urgency: "high",
      queue: "emergency",
      reason: "Emergency intent detected",
    });
  });

  it("creates a task for low-confidence calls", () => {
    expect(decideNextAction({
      ...baseInput,
      classification: {
        ...baseInput.classification,
        confidence: 0.4,
      },
    })).toEqual({
      type: "create_task",
      taskType: "callback",
      reason: "Low-confidence classification (0.40) requires human review",
    });
  });

  it("uses SMS info request when booking intent lacks time details", () => {
    expect(decideNextAction({
      ...baseInput,
      classification: {
        ...baseInput.classification,
        requestedTime: undefined,
      },
    })).toEqual({
      type: "send_sms",
      template: "info_request",
      reason: "Booking request needs scheduling details before confirmation",
    });
  });

  it("uses a callback task as fallback when no execution and no SMS target", () => {
    const input: OutcomeEnforcerInput = {
      metadata: baseInput.metadata,
      transcript: {
        turns: [{ speaker: "caller", text: "Need service" }],
      },
      classification: baseInput.classification,
      nextAction: {
        type: "book",
        requestedTime: baseInput.classification.requestedTime,
        reason: "Booking intent with requested time provided",
      },
      contact: {
        customerName: "Jordan",
        isDoNotCall: true,
        notes: "",
      },
    };

    expect(deriveFallbackAction(input)).toEqual({
      type: "create_task",
      taskType: "callback",
      reason: "Primary action did not complete, creating manual follow-up task",
    });
  });
});
