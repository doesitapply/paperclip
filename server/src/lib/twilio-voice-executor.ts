const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01";

export interface TwilioVoiceConfig {
  accountSid: string;
  authToken: string;
  fromPhone: string;
  statusCallbackUrl?: string;
}

type TwilioCallApiResponse = {
  sid: string;
  status?: string;
  error_message?: string | null;
};

export function getTwilioVoiceConfigFromEnv(env: NodeJS.ProcessEnv = process.env): TwilioVoiceConfig | null {
  const accountSid = env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = env.TWILIO_AUTH_TOKEN?.trim();
  const fromPhone = env.TWILIO_VOICE_FROM?.trim() || env.TWILIO_SMS_FROM?.trim();
  if (!accountSid || !authToken || !fromPhone) return null;
  const statusCallbackUrl = env.TWILIO_VOICE_STATUS_CALLBACK_URL?.trim() || undefined;
  return {
    accountSid,
    authToken,
    fromPhone,
    statusCallbackUrl,
  };
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

function buildProofCallTwiml(message: string): string {
  return `<Response><Say voice="alice">${escapeXml(message)}</Say></Response>`;
}

export async function createTwilioProofCall(input: {
  config: TwilioVoiceConfig;
  toPhone: string;
  message: string;
}): Promise<{ callSid: string; status: string }> {
  const body = new URLSearchParams({
    To: input.toPhone,
    From: input.config.fromPhone,
    Twiml: buildProofCallTwiml(input.message),
  });

  if (input.config.statusCallbackUrl) {
    body.set("StatusCallback", input.config.statusCallbackUrl);
  }

  const response = await fetch(
    `${TWILIO_API_BASE}/Accounts/${encodeURIComponent(input.config.accountSid)}/Calls.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${input.config.accountSid}:${input.config.authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );

  const data = await response.json() as TwilioCallApiResponse;
  if (!response.ok || !data.sid) {
    throw new Error(data.error_message || `Twilio voice call failed with status ${response.status}`);
  }

  return {
    callSid: data.sid,
    status: data.status ?? "queued",
  };
}
