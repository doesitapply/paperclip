import {
  type ContactSnapshot,
  type DecisionEngineInput,
  type FallbackAction,
  type NextAction,
  type OutcomeEnforcerInput,
} from "./phone-loop.js";

export const DEFAULT_AUTO_ROUTE_CONFIDENCE_THRESHOLD = 0.75;

export interface DecisionEngineOptions {
  autoRouteConfidenceThreshold?: number;
}

function hasSmsTarget(input: {
  metadata: DecisionEngineInput["metadata"] | OutcomeEnforcerInput["metadata"];
  contact?: ContactSnapshot;
}): boolean {
  if (input.contact?.isDoNotCall) return false;
  return Boolean(input.contact?.phone || input.metadata.fromPhone);
}

function shouldDisqualify(contact: ContactSnapshot | undefined, intent: DecisionEngineInput["classification"]["intent"]): boolean {
  return Boolean(contact?.isDoNotCall) && intent !== "emergency";
}

function fallbackTaskType(intent: DecisionEngineInput["classification"]["intent"]): "manual_follow_up" | "support_review" | "callback" {
  switch (intent) {
    case "support":
    case "billing":
      return "support_review";
    case "booking":
      return "callback";
    default:
      return "manual_follow_up";
  }
}

function fallbackTaskReason(intent: DecisionEngineInput["classification"]["intent"]): string {
  switch (intent) {
    case "support":
      return "Support issue requires manual review";
    case "billing":
      return "Billing issue requires manual review";
    case "booking":
      return "Booking request requires manual callback";
    case "unknown":
      return "Unable to resolve caller intent automatically";
    default:
      return "Manual follow-up required";
  }
}

export function decideNextAction(
  input: DecisionEngineInput,
  options: DecisionEngineOptions = {},
): NextAction {
  const threshold = options.autoRouteConfidenceThreshold ?? DEFAULT_AUTO_ROUTE_CONFIDENCE_THRESHOLD;
  const { classification, contact } = input;

  if (shouldDisqualify(contact, classification.intent)) {
    return {
      type: "disqualify",
      reason: "Contact is marked do-not-call",
    };
  }

  if (classification.intent === "spam") {
    return {
      type: "disqualify",
      reason: classification.disqualificationReason ?? "Spam call",
    };
  }

  if (classification.intent === "emergency") {
    return {
      type: "escalate",
      urgency: "high",
      queue: "emergency",
      reason: "Emergency intent detected",
    };
  }

  if (classification.urgency === "high") {
    return {
      type: "escalate",
      urgency: "high",
      queue: "priority",
      reason: "High-urgency call requires immediate human handoff",
    };
  }

  if (classification.confidence < threshold) {
    const taskType = fallbackTaskType(classification.intent);
    return {
      type: "create_task",
      taskType,
      reason: `Low-confidence classification (${classification.confidence.toFixed(2)}) requires human review`,
    };
  }

  switch (classification.intent) {
    case "booking":
      if (classification.requestedTime) {
        return {
          type: "book",
          requestedTime: classification.requestedTime,
          reason: "Booking intent with requested time provided",
        };
      }
      if (hasSmsTarget(input)) {
        return {
          type: "send_sms",
          template: "info_request",
          reason: "Booking request needs scheduling details before confirmation",
        };
      }
      return {
        type: "create_task",
        taskType: "callback",
        reason: "Booking request is missing scheduling details and requires callback",
      };

    case "inquiry":
      if (hasSmsTarget(input)) {
        return {
          type: "send_sms",
          template: "follow_up",
          reason: "Inquiry can be handled with follow-up information by SMS",
        };
      }
      return {
        type: "create_task",
        taskType: "manual_follow_up",
        reason: "Inquiry requires manual follow-up",
      };

    case "support":
      return {
        type: "create_task",
        taskType: "support_review",
        reason: "Support issue requires manual review",
      };

    case "billing":
      return {
        type: "create_task",
        taskType: "support_review",
        reason: "Billing issue requires manual review",
      };

    case "unknown":
      return {
        type: "create_task",
        taskType: "manual_follow_up",
        reason: "Caller intent is unknown",
      };

  }
}

export function deriveFallbackAction(input: OutcomeEnforcerInput): FallbackAction {
  if (input.execution) {
    throw new Error("Fallback should only be derived when primary execution is missing");
  }

  if (input.classification.intent === "emergency" || input.classification.urgency === "high") {
    return {
      type: "escalate",
      urgency: input.classification.urgency === "low" ? "medium" : input.classification.urgency,
      reason: "Primary action did not complete for an urgent call",
    };
  }

  if (hasSmsTarget(input)) {
    return {
      type: "send_sms",
      template: input.classification.intent === "booking" ? "missed_call_recovery" : "follow_up",
      reason: "Primary action did not complete, sending fallback SMS",
    };
  }

  return {
    type: "create_task",
    taskType: input.classification.intent === "booking" ? "callback" : "manual_follow_up",
    reason: "Primary action did not complete, creating manual follow-up task",
  };
}
