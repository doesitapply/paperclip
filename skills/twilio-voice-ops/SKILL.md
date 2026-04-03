---
name: twilio-voice-ops
description: >
  Twilio operating skill for inbound voice, outbound proof calls, SMS follow-up,
  webhook wiring, and provider-level debugging. Use when work touches Twilio
  credentials, call flows, phone numbers, TwiML, SMS sends, or delivery proofs.
---

# Twilio Voice Ops

Use this skill when the work touches Twilio directly.

## Scope

- inbound voice webhooks
- TwiML responses
- outbound proof calls
- SMS sends and status callbacks
- Twilio env wiring
- phone-number configuration
- provider-side debugging

## Rules

- Keep business logic out of the Twilio adapter.
- Twilio code should normalize input, execute one action, and persist proof.
- Do not hide provider failures behind fake success records.
- Use the same configured phone numbers across inbound and outbound paths unless there is a deliberate separation.

## Required Environment

For live sends/calls, expect:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_SMS_FROM`
- `TWILIO_VOICE_FROM`

If live config is missing, fail plainly instead of pretending the provider call succeeded.

## Operational Checks

When shipping Twilio work, verify:

- the route accepts Twilio form payloads correctly
- the TwiML response is valid XML
- SMS sends return a real `messageSid`
- proof calls return a real `callSid`
- persisted attempt records mark `live` vs `stub`

## Done Criteria

Twilio work is done when:

- a real Twilio request can be made successfully
- the provider SID is captured in persistence
- the spoken or text response is not generic boilerplate unless that is the intended fallback
- the failure mode is visible when Twilio rejects the request
