import type { PhoneLoopRunResult } from "@paperclipai/shared";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

function say(message: string): string {
  return `<Say>${escapeXml(message)}</Say>`;
}

function pickVariant(seed: string, options: readonly string[]): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash << 5) - hash + seed.charCodeAt(index)) | 0;
  }
  return options[Math.abs(hash) % options.length] ?? options[0]!;
}

function normalizeSummary(summary: string | undefined): string | null {
  const trimmed = summary?.trim();
  if (!trimmed) return null;
  const sentence = trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
  return sentence;
}

function renderFollowUpResponse(result: PhoneLoopRunResult): string {
  const { record, attemptedAction, fallbackAction } = result;
  const greeting = pickVariant(record.callId, [
    "Thanks for calling.",
    "We have your request.",
    "You're all set on our side.",
  ]);
  const summary = normalizeSummary(record.classification.summary);
  const actionLine = record.execution.type === "send_sms"
    ? `We just texted ${record.contact?.customerName?.trim() ? record.contact.customerName.trim() : "you"} the next steps.`
    : "We sent a text with the next steps.";

  const reasonLine = attemptedAction.type !== "send_sms" && fallbackAction
    ? "The first path did not complete, so we sent a text to keep this moving."
    : null;

  return [greeting, summary, actionLine, reasonLine]
    .filter((line): line is string => Boolean(line))
    .map((line) => say(line))
    .join("");
}

function renderTaskCreatedResponse(result: PhoneLoopRunResult): string {
  const { record } = result;
  const summary = normalizeSummary(record.classification.summary);
  const timing = pickVariant(record.callId, [
    "A team member will call you back shortly.",
    "Someone on the team will follow up soon.",
    "We've created a follow-up task and the team will reach out.",
  ]);
  return [summary, timing]
    .filter((line): line is string => Boolean(line))
    .map((line) => say(line))
    .join("");
}

function renderBookedResponse(result: PhoneLoopRunResult): string {
  const { record } = result;
  const confirmation =
    record.execution.type === "book"
      ? record.execution.result.confirmationMessage
      : "Your appointment is confirmed.";
  const summary = record.classification.requestedTime
    ? `We captured your requested time: ${record.classification.requestedTime}.`
    : null;
  return [confirmation, summary]
    .filter((line): line is string => Boolean(line))
    .map((line) => say(line))
    .join("");
}

export function renderTwilioVoiceResponse(result: PhoneLoopRunResult): string {
  const { record } = result;

  switch (record.finalOutcome) {
    case "booked":
      return `<Response>${renderBookedResponse(result)}</Response>`;
    case "escalated": {
      const lead = pickVariant(record.callId, [
        "Please hold while we connect you.",
        "Stay on the line while we transfer you.",
        "One moment while we get a human on the line.",
      ]);
      const summary = normalizeSummary(record.classification.summary);
      return `<Response>${[lead, summary].filter((line): line is string => Boolean(line)).map((line) => say(line)).join("")}</Response>`;
    }
    case "follow_up_sent":
      return `<Response>${renderFollowUpResponse(result)}</Response>`;
    case "task_created":
      return `<Response>${renderTaskCreatedResponse(result)}</Response>`;
    case "disqualified": {
      const message = record.classification.disqualificationReason
        ? `Thanks for calling. ${record.classification.disqualificationReason}. Goodbye.`
        : "Thanks for calling. Goodbye.";
      return `<Response>${say(message)}</Response>`;
    }
  }
}
