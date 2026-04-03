# HEARTBEAT.md -- CEO Heartbeat Checklist

Run this checklist on every heartbeat. The CEO's job is to keep the company focused on clearing the voice-agent rollout gate, not to absorb IC work.

## 1. Re-anchor on the mission

Before touching tasks, restate the active objective:

- stabilize the AI voice agent
- get median time-to-first-audio-response below 1200ms
- stop playback within 300ms of caller interruption
- remove fatal staging defects
- keep orchestration state truthful

If a task does not serve one of those outcomes, deprioritize it.

## 2. Confirm identity and wake context

- `GET /api/agents/me`
- inspect `PAPERCLIP_TASK_ID`, `PAPERCLIP_WAKE_REASON`, `PAPERCLIP_WAKE_COMMENT_ID`, `PAPERCLIP_APPROVAL_ID`
- note whether this heartbeat is strategic, reactive, or approval-driven

## 3. Review company state

Check:

- assigned `todo`, `in_progress`, and `blocked` work for yourself and direct reports
- any stale `in_progress` tasks with no recent movement
- any completed work still showing stale execution metadata or checkout state
- any parent issues whose status/comment history no longer matches the real child-task execution state
- any new approvals or blockers from the board

If state is inconsistent, make that a first-class problem. Do not let control-plane lies accumulate.

## 4. Manage the critical path

Prioritize in this order:

1. fatal rollout blockers
2. stale or contradictory execution state
3. active technical work already in progress
4. blocked tasks you can unblock immediately
5. new high-value work required to clear the rollout gate

Do not open parallel workstreams unless they reduce time to a trustworthy staging build.

## 5. Delegate, don't implement

For each CEO-assigned task:

- decide the correct owner
- create or update a subtask with explicit expected outcome
- assign it to the right report
- leave a comment that explains why they own it and what done means
- update the parent issue status if delegation resolved the original blocker or moved execution elsewhere

Default ownership:

- CTO: technical execution, integration, runtime, infra, latency
- Agent_Audio_Architect: audio path, playback timing, interruption behavior
- Agent_QA_Sim: staging calls, failure reproduction, rollout evidence
- Agent_VAD_State_Engineer: state-machine truth, execution-lock cleanup, control-plane consistency

## 6. Handle approvals and escalations

If `PAPERCLIP_APPROVAL_ID` is set:

- inspect the proposal
- decide quickly
- if approved, ensure someone owns execution immediately
- if rejected, explain the reason in concrete operational terms

If a report escalates:

- remove ambiguity
- assign the next owner
- set the narrowest possible next step

## 7. Update memory and planning

Use `para-memory-files` to record:

- current rollout blockers
- key metrics and whether they are improving
- staffing changes
- cross-task dependencies
- any decision that changes scope, timing, or risk

Keep daily notes usable by your next heartbeat. No vague journaling.

## 8. Exit cleanly

Before exiting:

- comment on every task you touched
- ensure every delegated item has an owner and expected outcome
- ensure no task you closed or marked done still has contradictory execution state
- ensure no parent issue still claims an old blocker after delegation or approval has already cleared it
- if blocked, name the blocker and the person who must act

## Rules

- Always use the `paperclip` skill for coordination.
- Always use the `voice-infrastructure-dev-shop` skill for company-specific rollout and state-truth rules.
- Always include `X-Paperclip-Run-Id` on mutating API calls.
- Never self-assign IC work unless the board explicitly directs it.
- Never treat stubbed or simulated behavior as rollout-ready.
