---
name: voice-infrastructure-dev-shop
description: >
  Company-specific operating doctrine for Voice Infrastructure Dev Shop. Use with
  the bundled Paperclip skill whenever work touches the voice-agent rollout gate,
  swarm coordination, staging truth, stale execution state, or parent/child issue
  hygiene.
---

# Voice Infrastructure Dev Shop Skill

Use this skill alongside `paperclip` whenever you are working inside this company.
`paperclip` handles the generic heartbeat/API contract. This skill supplies the
company-specific rules that the stock skill does not know.

## Current Objective

The company is in a stabilization sprint for a proprietary AI voice agent.

The rollout gate is strict:

- median time-to-first-audio-response under 1200ms
- playback stop within 300ms of caller interruption
- fatal staging defects resolved
- execution metadata and control-plane state must stay truthful
- no feature work, sales polish, plugin expansion, or platform drift until staging clears

If a task does not move one of those outcomes, it is not priority work.

## Concrete Goals

Agents should optimize for these concrete goals, in order:

1. Restore staging truth.
   - No completed issue may retain stale checkout or execution-lock metadata.
   - Parent issues must accurately reflect whether work is delegated, blocked, or complete.
   - Stubbed executor paths must be visibly marked as stubbed in records and reads.

2. Clear the voice rollout gate.
   - Median time-to-first-audio-response under 1200ms in staging.
   - Caller interruption halts playback within 300ms in staging.
   - Fatal staging defects mapped, assigned, and either fixed or explicitly blocked with owners.

3. Produce hard evidence, not summaries.
   - A current system component map of the voice pipeline and latency handoffs.
   - A baseline adversarial defect log from staging calls mapped to that component map.
   - Persisted records showing real state changes, not just narrative updates.

4. Make one business-action path real end to end.
   - At least one live, non-stubbed terminal path must work through the system.
   - Current priority: inbound/missed call -> classify -> send SMS follow-up -> persist outcome.

5. Expand from “voice demo” to “good employee behavior.”
   - The system should not just answer; it should finish the next responsible action.
   - A strong path should be able to call back, text, book, create a task, escalate, or disqualify with evidence.
   - Optimize for business state change, not conversational impressiveness.

## Immediate Sprint Targets

Until the rollout gate clears, the company should be driving toward these near-term outputs:

- complete and keep updated the Phase 0 system component map
- complete the Phase 1 adversarial staging-call defect log
- eliminate stale execution metadata bugs in issue/run control-plane flows
- keep Twilio inbound -> phone loop -> persistence -> TwiML response working end to end
- keep `follow_up_sent` live through Twilio SMS, with stubbed paths clearly labeled everywhere else

## Employee-Like Capabilities

The end-state product should behave like a competent front-desk operator or dispatcher.
That means agents should actively drive toward these capabilities:

- answer inbound calls and classify the caller correctly
- send confirmation, reminder, missed-call-recovery, and follow-up texts
- place outbound callback attempts when a caller needs a human or misses the first conversion path
- book, reschedule, or cancel appointments
- create callback, quote, support-review, or manual-follow-up tasks
- escalate urgent or high-risk calls to a human queue
- remember contact history, prior outcomes, and next actions
- reject spam or disqualified leads cleanly without muddying the pipeline
- persist every call into a closed-loop outcome with evidence

## Target Outcomes

Every completed call should land in one of the legal terminal outcomes:

- `booked`
- `escalated`
- `follow_up_sent`
- `task_created`
- `disqualified`

Beyond those terminal states, the company should be moving toward these higher-level operational goals:

- missed calls reliably turn into callback or text recovery attempts
- qualified callers reliably receive a next step before the interaction ends
- repeat callers are recognized and handled with continuity
- urgent callers get human attention fast instead of dying in automation
- low-confidence situations create work for humans instead of disappearing
- every business-relevant conversation produces a persisted next action

## Definitions Of Done

Use these practical definitions of done:

- A control-plane fix is not done until the stale state is gone and a regression test exists.
- A voice-runtime fix is not done until staging behavior is measured against the latency/VAD target.
- A workflow fix is not done until the persisted record matches what the UI and comments claim happened.
- A delegated parent task is not done until the parent status/comment trail tells the truth about child execution.
- A business-action executor is not done until it changes external or persisted business state for real, not in stub mode.
- A callback/texting workflow is not done until a real outbound attempt is recorded with provider evidence.
- A booking workflow is not done until a real calendar state change or appointment record exists.
- A contact-memory workflow is not done until a repeat caller can be recognized from persisted history.

## Non-Negotiable Operating Rules

- Do not confuse simulated progress with production truth.
- If an executor, workflow, or external integration is stubbed, label it plainly.
- If a task, run, or call is marked complete, the persisted state must agree.
- No call, task, or run should exit in an unresolved limbo state.
- Do not leave control-plane inconsistencies sitting around as “cleanup later.”

## Execution Truth

Treat these as first-order defects:

- stale checkout state
- stale execution locks
- parent issues blocked for reasons already resolved
- child execution work that is real while parent status remains fiction
- dashboards or outcome records that hide stubbed execution as if it were live

When you see state drift, fix the root cause or create a tightly scoped task for it.

## Scope Discipline

Until the rollout gate clears:

- do not branch into new product/platform work
- do not expand plugin surfaces just because the architecture allows it
- do not polish demos while staging truth is broken
- do not add “smart” behavior where deterministic behavior is sufficient

Reliability first. Everything else is a distraction.

That said, “reliability” includes the ability to do useful employee work after the call.
Do not stop at a polished classifier if the system still cannot text, call back, book, or create a real task.

## Delegation Model

Use the real org roles:

- CEO: priority, staffing, approvals, cross-team routing, parent issue truth
- CTO: technical triage, decomposition, architecture, delivery ownership
- Agent_Audio_Architect: audio pipeline, playback timing, latency handoffs
- Agent_VAD_State_Engineer: interruption state, lock cleanup, run/control-plane consistency
- Agent_QA_Sim: adversarial staging calls, defect logs, rollout evidence

Do not invent fake departments or generic placeholder roles.

## Role-Specific Success Criteria

- CEO
  - Keep the company focused on rollout work only.
  - Remove stale blocker narratives from parent issues.
  - Ensure every critical stream has an owner and next step.

- CTO
  - Keep technical work decomposed, assigned, and moving.
  - Convert ambiguous bugs into concrete failing paths, fixes, and tests.
  - Prevent the repo from drifting into architecture theater.

- Agent_Audio_Architect
  - Maintain the current voice-pipeline map.
  - Identify audio-path latency handoffs and playback-stop timing risks.
  - Produce evidence that ties observed timing behavior to named system components.

- Agent_VAD_State_Engineer
  - Eliminate stale run ownership, lock cleanup, and interruption-state inconsistencies.
  - Keep execution-state transitions deterministic and auditable.
  - Treat any “completed but still active” state as a real defect.

- Agent_QA_Sim
  - Run adversarial staging calls.
  - Log failures in a strict schema.
  - Map every failure to a known component or clearly flag the unknown gap.

## Parent/Child Issue Hygiene

When work moves from a parent issue into child execution:

- update the parent immediately
- remove stale blocker language once the blocker is gone
- keep the parent as oversight only if that is truly its remaining function
- close the parent once the parent-level objective is satisfied

Do not leave executive theater in the tracker.

## Evidence Standard

Every meaningful update should leave evidence of:

- what changed
- what was observed
- what remains risky
- whether behavior is live, stubbed, or unverified
- who owns the next move

If you cannot show the state change, assume it is not done.
