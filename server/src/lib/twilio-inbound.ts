import { z } from "zod";
import { badRequest } from "../errors.js";

export const twilioInboundEventSchema = z.object({
  companyId: z.string().min(1),
  callSid: z.string().min(1),
  fromPhone: z.string().min(1),
  toPhone: z.string().min(1),
  callStatus: z.string().optional(),
  recordingUrl: z.string().url().optional(),
  durationSeconds: z.number().int().nonnegative().optional(),
  transcriptText: z.string().min(1),
  callerName: z.string().min(1).optional(),
});

export type TwilioInboundEvent = z.infer<typeof twilioInboundEventSchema>;

type TwilioInboundRawBody = Record<string, string | string[] | undefined>;

function first(body: TwilioInboundRawBody, key: string): string | undefined {
  const value = body[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

export function parseTwilioInboundEvent(body: TwilioInboundRawBody): TwilioInboundEvent {
  const transcriptText = first(body, "SpeechResult") ?? first(body, "Transcript") ?? "";
  const durationRaw = first(body, "CallDuration");
  const recordingUrl = first(body, "RecordingUrl");
  const parsed = twilioInboundEventSchema.safeParse({
    companyId: first(body, "CompanyId") ?? first(body, "companyId"),
    callSid: first(body, "CallSid"),
    fromPhone: first(body, "From"),
    toPhone: first(body, "To"),
    callStatus: first(body, "CallStatus"),
    recordingUrl: recordingUrl && recordingUrl.length > 0 ? recordingUrl : undefined,
    durationSeconds: durationRaw ? Number.parseInt(durationRaw, 10) : undefined,
    transcriptText,
    callerName: first(body, "CallerName"),
  });

  if (!parsed.success) {
    throw badRequest("Invalid Twilio inbound payload", parsed.error.flatten());
  }

  return parsed.data;
}
