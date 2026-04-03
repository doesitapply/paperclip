---
name: voice-rollout-qa
description: >
  Rollout-gate QA skill for the voice system. Use when running staging calls,
  collecting latency evidence, validating interruption handling, mapping defects
  to system components, or deciding whether the rollout gate is actually clear.
---

# Voice Rollout QA

Use this skill when validating the voice system against the rollout gate.

## Gate Metrics

The current gate is:

- median time-to-first-audio-response under 1200ms
- playback stops within 300ms of caller interruption
- fatal staging defects resolved or explicitly blocked with owners
- execution and control-plane state remain truthful

## Evidence Requirements

Do not accept vague summaries. Collect:

- exact scenario tested
- observed behavior
- measured latency if relevant
- affected component or handoff
- whether the issue is reproducible
- owner for the next move

## Test Priorities

- caller interrupts mid-playback
- booking intent with incomplete information
- urgent caller requiring escalation
- missed call or dropped call recovery
- low-confidence classification path
- repeat caller continuity

## Mapping Rule

Every failure should map to:

- a known component
- a specific adapter or executor
- a control-plane state transition

If it cannot be mapped, that unknown is itself a defect.

## Done Criteria

QA work is done when:

- defects are logged in a repeatable way
- the system component map is updated if needed
- rollout claims are backed by evidence
- unresolved failures have owners and blockers, not vibes
