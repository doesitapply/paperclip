import express, { Router } from "express";
import type { Db } from "@paperclipai/db";
import { type ActionExecutionResult } from "@paperclipai/shared";
import { badRequest } from "../errors.js";
import {
  parseAndNormalizeTwilioInbound,
  runTwilioPhoneLoop,
  type TwilioPhoneLoopAdapterDeps,
} from "../lib/twilio-phone-loop-adapter.js";
import { renderTwilioVoiceResponse } from "../lib/twilio-response.js";
import { createTwilioSmsExecutor, getTwilioSmsConfigFromEnv } from "../lib/twilio-sms-executor.js";
import { createTwilioProofCall, getTwilioVoiceConfigFromEnv } from "../lib/twilio-voice-executor.js";

function notImplementedResult(type: ActionExecutionResult["type"]): ActionExecutionResult {
  switch (type) {
    case "book":
      return {
        type: "book",
        result: {
          status: "booked",
          appointmentId: "stub-appointment",
          confirmationMessage: "Your appointment request is confirmed.",
        },
      };
    case "send_sms":
      return {
        type: "send_sms",
        result: {
          status: "sent",
          messageSid: "stub-message",
          template: "follow_up",
        },
      };
    case "create_task":
      return {
        type: "create_task",
        result: {
          status: "created",
          taskId: "stub-task",
          taskType: "manual_follow_up",
        },
      };
    case "escalate":
      return {
        type: "escalate",
        result: {
          status: "escalated",
          handoffId: "stub-handoff",
        },
      };
    case "disqualify":
      return {
        type: "disqualify",
        result: {
          status: "disqualified",
          reason: "Call disqualified",
        },
      };
  }
}

function createDefaultDeps(): TwilioPhoneLoopAdapterDeps {
  const twilioSmsConfig = getTwilioSmsConfigFromEnv();
  return {
    executorMetadata: {
      book: { executionMode: "stub" },
      send_sms: twilioSmsConfig
        ? { executionMode: "live", provider: "twilio" }
        : { executionMode: "stub", provider: "twilio" },
      create_task: { executionMode: "stub" },
      escalate: { executionMode: "stub" },
      disqualify: { executionMode: "stub" },
    },
    async executeBooking() {
      return notImplementedResult("book");
    },
    executeSmsFollowup: twilioSmsConfig
      ? createTwilioSmsExecutor(twilioSmsConfig)
      : async () => notImplementedResult("send_sms"),
    async executeTaskCreate() {
      return notImplementedResult("create_task");
    },
    async executeEscalation() {
      return notImplementedResult("escalate");
    },
    async executeDisqualify() {
      return notImplementedResult("disqualify");
    },
  };
}

export function twilioRoutes(db: Db, deps: Partial<TwilioPhoneLoopAdapterDeps> = {}) {
  const router = Router();
  router.use(express.json());
  router.use(express.urlencoded({ extended: false }));

  router.post("/voice/inbound", async (req, res, next) => {
    try {
      if (!req.body || typeof req.body !== "object") {
        throw badRequest("Twilio inbound payload is required");
      }
      const event = parseAndNormalizeTwilioInbound(req.body as Record<string, string | string[] | undefined>);
      const result = await runTwilioPhoneLoop(db, event, {
        ...createDefaultDeps(),
        ...deps,
      });
      res.status(200).type("text/xml").send(renderTwilioVoiceResponse(result));
    } catch (error) {
      next(error);
    }
  });

  router.post("/voice/proof-call", async (req, res, next) => {
    try {
      const toPhone = typeof req.body?.toPhone === "string" ? req.body.toPhone.trim() : "";
      if (!toPhone) {
        throw badRequest("toPhone is required");
      }
      const voiceConfig = getTwilioVoiceConfigFromEnv();
      if (!voiceConfig) {
        throw badRequest("Twilio voice config is missing. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VOICE_FROM.");
      }
      const message = typeof req.body?.message === "string" && req.body.message.trim().length > 0
        ? req.body.message.trim()
        : "This is a proof call from your Paperclip Twilio test path. The outbound voice flow is live.";
      const call = await createTwilioProofCall({
        config: voiceConfig,
        toPhone,
        message,
      });
      res.status(200).json({
        ok: true,
        toPhone,
        callSid: call.callSid,
        status: call.status,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
