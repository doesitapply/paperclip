import {
  assertClosedLoop,
  type ActionExecutionResult,
  type BookingInput,
  type CallClassification,
  type CallIntelligenceInput,
  type ClosedLoopCallRecord,
  type CrmMemoryWriteInput,
  type DecisionEngineInput,
  type DisqualifyInput,
  type EscalationInput,
  type FallbackAction,
  type NextAction,
  type SmsFollowupInput,
  type TaskCreateInput,
} from "./phone-loop.js";
import { decideNextAction, deriveFallbackAction } from "./decision-engine.js";
import { deriveOutcome } from "./phone-loop.js";

export interface PhoneLoopDeps {
  classifyCall: (input: CallIntelligenceInput) => Promise<CallClassification>;
  executeBooking: (input: BookingInput) => Promise<ActionExecutionResult>;
  executeSmsFollowup: (input: SmsFollowupInput) => Promise<ActionExecutionResult>;
  executeTaskCreate: (input: TaskCreateInput) => Promise<ActionExecutionResult>;
  executeEscalation: (input: EscalationInput) => Promise<ActionExecutionResult>;
  executeDisqualify: (input: DisqualifyInput) => Promise<ActionExecutionResult>;
  writeCrmMemory: (input: CrmMemoryWriteInput) => Promise<void>;
  now?: () => string;
}

export interface DispatchContext {
  input: CallIntelligenceInput;
  classification: CallClassification;
}

export interface PhoneLoopRunResult {
  record: ClosedLoopCallRecord;
  attemptedAction: NextAction;
  fallbackAction?: FallbackAction;
  attempts: PhoneLoopAttempt[];
}

export interface PhoneLoopAttempt {
  sequence: number;
  action: NextAction | FallbackAction;
  status: "succeeded" | "failed";
  error?: string;
  result?: ActionExecutionResult;
  startedAt: string;
  finishedAt: string;
}

function nowIso(now: PhoneLoopDeps["now"]): string {
  return (now?.() ?? new Date().toISOString());
}

function toDecisionEngineInput(
  input: CallIntelligenceInput,
  classification: CallClassification,
): DecisionEngineInput {
  return {
    metadata: input.metadata,
    classification,
    contact: input.contact,
  };
}

function toBookingInput(ctx: DispatchContext, action: Extract<NextAction, { type: "book" }>): BookingInput {
  return {
    callId: ctx.input.metadata.callId,
    action,
    classification: ctx.classification,
    contact: ctx.input.contact,
  };
}

function toSmsFollowupInput(
  ctx: DispatchContext,
  action: Extract<NextAction, { type: "send_sms" }>,
): SmsFollowupInput {
  return {
    callId: ctx.input.metadata.callId,
    action,
    classification: ctx.classification,
    contact: ctx.input.contact,
  };
}

function toTaskCreateInput(
  ctx: DispatchContext,
  action: Extract<NextAction, { type: "create_task" }>,
): TaskCreateInput {
  return {
    callId: ctx.input.metadata.callId,
    action,
    classification: ctx.classification,
    contact: ctx.input.contact,
  };
}

function toEscalationInput(
  ctx: DispatchContext,
  action: Extract<NextAction, { type: "escalate" }>,
): EscalationInput {
  return {
    callId: ctx.input.metadata.callId,
    action,
    classification: ctx.classification,
    contact: ctx.input.contact,
  };
}

function toDisqualifyInput(
  ctx: DispatchContext,
  action: Extract<NextAction, { type: "disqualify" }>,
): DisqualifyInput {
  return {
    callId: ctx.input.metadata.callId,
    action,
    classification: ctx.classification,
    contact: ctx.input.contact,
  };
}

function fallbackToNextAction(fallback: FallbackAction): Exclude<NextAction, { type: "book" | "disqualify" }> {
  return fallback;
}

export async function dispatchAction(
  action: NextAction,
  ctx: DispatchContext,
  deps: PhoneLoopDeps,
): Promise<ActionExecutionResult> {
  switch (action.type) {
    case "book":
      return deps.executeBooking(toBookingInput(ctx, action));
    case "send_sms":
      return deps.executeSmsFollowup(toSmsFollowupInput(ctx, action));
    case "create_task":
      return deps.executeTaskCreate(toTaskCreateInput(ctx, action));
    case "escalate":
      return deps.executeEscalation(toEscalationInput(ctx, action));
    case "disqualify":
      return deps.executeDisqualify(toDisqualifyInput(ctx, action));
  }
}

export async function runPhoneLoop(
  input: CallIntelligenceInput,
  deps: PhoneLoopDeps,
): Promise<PhoneLoopRunResult> {
  const classification = await deps.classifyCall(input);
  const attemptedAction = decideNextAction(toDecisionEngineInput(input, classification));
  const dispatchContext: DispatchContext = { input, classification };

  let finalAction: NextAction = attemptedAction;
  let execution: ActionExecutionResult;
  let fallbackAction: FallbackAction | undefined;
  let finalOutcomeReason = attemptedAction.reason;
  const attempts: PhoneLoopAttempt[] = [];

  try {
    const startedAt = nowIso(deps.now);
    execution = await dispatchAction(attemptedAction, dispatchContext, deps);
    attempts.push({
      sequence: 1,
      action: attemptedAction,
      status: "succeeded",
      result: execution,
      startedAt,
      finishedAt: nowIso(deps.now),
    });
  } catch (error) {
    const primaryFailure = error instanceof Error ? error.message : String(error);
    attempts.push({
      sequence: 1,
      action: attemptedAction,
      status: "failed",
      error: primaryFailure,
      startedAt: nowIso(deps.now),
      finishedAt: nowIso(deps.now),
    });
    fallbackAction = deriveFallbackAction({
      metadata: input.metadata,
      transcript: input.transcript,
      contact: input.contact,
      classification,
      nextAction: attemptedAction,
    });
    finalAction = fallbackToNextAction(fallbackAction);
    const fallbackStartedAt = nowIso(deps.now);
    execution = await dispatchAction(finalAction, dispatchContext, deps);
    attempts.push({
      sequence: 2,
      action: finalAction,
      status: "succeeded",
      result: execution,
      startedAt: fallbackStartedAt,
      finishedAt: nowIso(deps.now),
    });
    finalOutcomeReason = `${fallbackAction.reason} (primary action failed: ${primaryFailure})`;
  }

  const finalOutcome = deriveOutcome(finalAction, execution);
  const record = assertClosedLoop({
    callId: input.metadata.callId,
    metadata: input.metadata,
    transcript: input.transcript,
    contact: input.contact,
    classification,
    nextAction: finalAction,
    execution,
    finalOutcome,
    finalOutcomeReason,
    completedAt: nowIso(deps.now),
  });

  await deps.writeCrmMemory({
    callId: record.callId,
    contact: record.contact,
    classification: record.classification,
    nextAction: record.nextAction,
    execution: record.execution,
    finalOutcome: record.finalOutcome,
    finalOutcomeReason: record.finalOutcomeReason,
  });

  return {
    record,
    attemptedAction,
    fallbackAction,
    attempts,
  };
}
