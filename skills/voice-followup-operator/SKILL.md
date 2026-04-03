---
name: voice-followup-operator
description: >
  Closed-loop follow-up skill for voice leads. Use when work involves callbacks,
  missed-call recovery, SMS follow-up, task creation, booking handoff, or making
  sure a caller does not leave the system unresolved.
---

# Voice Follow-Up Operator

Use this skill when the work is no longer “understand the call,” but “finish the job.”

This skill is about employee behavior after the initial conversation:

- call back
- send a text
- create a task
- confirm the next step
- recover a missed lead
- make sure the business state changed

## Primary Rule

No call should end with “nothing happened.”

Every path should terminate in one of the legal outcomes:

- `booked`
- `escalated`
- `follow_up_sent`
- `task_created`
- `disqualified`

If the primary path fails, choose the next responsible action immediately.

## What Good Looks Like

- missed call -> text recovery sent
- booking request with missing detail -> callback or SMS request for detail
- low-confidence classification -> task created for human follow-up
- urgent lead -> escalate fast, do not bury it in generic follow-up
- repeat caller -> use memory and continue, do not restart from zero

## Callback Standards

When building or reviewing callback behavior:

- record who is being called back and why
- persist the callback attempt as a real action, not a note
- keep the callback reason short and explicit
- if callback cannot happen, create a task or send SMS instead

## SMS Standards

When building or reviewing text behavior:

- message should match the action template already chosen upstream
- executor should send, not think
- persist provider evidence like `messageSid`
- differentiate live vs stub execution clearly

## Done Criteria

This work is only done when:

- an actual outbound attempt or task exists
- the result is persisted
- the final outcome is explicit
- the fallback path is honest if the primary action failed
