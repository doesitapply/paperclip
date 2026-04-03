import type { ActionExecutionResult, SmsFollowupInput } from "@paperclipai/shared";

const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01";

export interface TwilioSmsConfig {
  accountSid: string;
  authToken: string;
  fromPhone: string;
  statusCallbackUrl?: string;
}

type TwilioSmsApiResponse = {
  sid: string;
  status?: string;
  error_message?: string | null;
};

function renderSmsBody(input: SmsFollowupInput): string {
  switch (input.action.template) {
    case "booking_confirmation":
      return input.classification.requestedTime
        ? `You're confirmed for ${input.classification.requestedTime}. Reply if you need to reschedule.`
        : "Your booking request is confirmed. We'll text you any updates.";
    case "missed_call_recovery":
      return "Sorry we missed your call. Reply here and we'll help you book the next step.";
    case "follow_up":
      return input.classification.summary;
    case "info_request":
      return "Thanks for calling. Reply with your preferred time and we'll follow up.";
  }
}

function resolveToPhone(input: SmsFollowupInput): string {
  const toPhone = input.contact?.phone ?? input.classification.phone;
  if (!toPhone) {
    throw new Error("SMS follow-up requires a destination phone number");
  }
  return toPhone;
}

export function getTwilioSmsConfigFromEnv(env: NodeJS.ProcessEnv = process.env): TwilioSmsConfig | null {
  const accountSid = env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = env.TWILIO_AUTH_TOKEN?.trim();
  const fromPhone = env.TWILIO_SMS_FROM?.trim();
  if (!accountSid || !authToken || !fromPhone) return null;
  const statusCallbackUrl = env.TWILIO_SMS_STATUS_CALLBACK_URL?.trim() || undefined;
  return {
    accountSid,
    authToken,
    fromPhone,
    statusCallbackUrl,
  };
}

export function createTwilioSmsExecutor(config: TwilioSmsConfig) {
  return async function executeSmsFollowup(input: SmsFollowupInput): Promise<ActionExecutionResult> {
    const body = new URLSearchParams({
      To: resolveToPhone(input),
      From: config.fromPhone,
      Body: renderSmsBody(input),
    });
    if (config.statusCallbackUrl) {
      body.set("StatusCallback", config.statusCallbackUrl);
    }

    const response = await fetch(
      `${TWILIO_API_BASE}/Accounts/${encodeURIComponent(config.accountSid)}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      },
    );

    const data = await response.json() as TwilioSmsApiResponse;
    if (!response.ok || !data.sid) {
      throw new Error(data.error_message || `Twilio SMS send failed with status ${response.status}`);
    }

    return {
      type: "send_sms",
      result: {
        status: data.status === "queued" ? "queued" : "sent",
        messageSid: data.sid,
        template: input.action.template,
      },
    };
  };
}
