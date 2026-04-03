import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/index.js";
import { twilioRoutes } from "../routes/twilio.js";

function createDb() {
  return {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(async () => [{ id: "closed-loop-1" }]),
      })),
    })),
  } as any;
}

function createApp() {
  const app = express();
  app.use((req, _res, next) => {
    (req as any).actor = { type: "none", source: "none" };
    next();
  });
  app.use("/api/twilio", twilioRoutes(createDb(), {
    classifyCall: vi.fn(async () => ({
      intent: "booking",
      urgency: "medium",
      confidence: 0.9,
      requestedTime: "tomorrow at 4pm",
      summary: "Booking intent detected",
      notes: "",
      extractedEntities: { dates: [], prices: [], addresses: [], services: [] },
    })),
  }));
  app.use(errorHandler);
  return app;
}

describe("twilio routes", () => {
  it("accepts inbound voice webhooks and returns TwiML", async () => {
    const res = await request(createApp())
      .post("/api/twilio/voice/inbound")
      .type("form")
      .send({
        CompanyId: "company-1",
        CallSid: "CA123",
        From: "+15551234567",
        To: "+15557654321",
        SpeechResult: "I need to book an appointment for tomorrow at 4pm",
      });

    expect(res.status).toBe(200);
    expect(res.type).toContain("text/xml");
    expect(res.text).toContain("<Response>");
    expect(res.text).toContain("appointment request is confirmed");
    expect(res.text).toContain("tomorrow at 4pm");
  });

  it("rejects proof calls when Twilio voice config is missing", async () => {
    const res = await request(createApp())
      .post("/api/twilio/voice/proof-call")
      .send({
        toPhone: "7754204485",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Twilio voice config is missing");
  });
});
