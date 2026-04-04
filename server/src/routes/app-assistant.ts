import { Router } from "express";
import { z } from "zod";
import type { Db } from "@paperclipai/db";
import { forbidden } from "../errors.js";
import { assertCompanyAccess } from "./authz.js";
import { companyService } from "../services/companies.js";
import { issueService } from "../services/issues.js";

const assistantRequestSchema = z.object({
  message: z.string().min(1).max(6000),
  context: z.object({
    path: z.string().min(1).max(500),
    pageTitle: z.string().max(200).optional(),
    companyId: z.string().optional(),
    issueId: z.string().optional(),
  }),
});

function summarizeCommentBodies(comments: Array<{ body: string }>) {
  return comments
    .slice(-6)
    .map((comment, index) => `${index + 1}. ${comment.body.trim()}`)
    .join("\n\n");
}

function buildFallbackReply(input: {
  companyName?: string | null;
  issueTitle?: string | null;
  issueStatus?: string | null;
  issuePriority?: string | null;
  hasIssueContext: boolean;
  userMessage: string;
}) {
  const trimmed = input.userMessage.trim();
  const framing = input.hasIssueContext
    ? `I can help with "${input.issueTitle ?? "this issue"}" in ${input.companyName ?? "this company"}.`
    : `I can help you navigate ${input.companyName ?? "the app"} and draft the next move.`;

  const guidance = input.hasIssueContext
    ? [
        `Status: ${input.issueStatus ?? "unknown"}`,
        `Priority: ${input.issuePriority ?? "unknown"}`,
        "Best next moves:",
        "- comment with a direct ask if you need the assignee to reply",
        "- reassign if ownership is wrong",
        "- interrupt and reopen if the current run is stale",
      ].join("\n")
    : [
        "Best next moves:",
        "- open the issue you want to work on",
        "- ask me to draft a reply, summarize blockers, or suggest the next action",
        "- use the left rail to move between dashboard, issues, goals, and agents",
      ].join("\n");

  return `${framing}\n\nYou asked: "${trimmed}"\n\n${guidance}`;
}

export function appAssistantRoutes(db: Db) {
  const router = Router();
  const companies = companyService(db);
  const issues = issueService(db);

  router.post("/assistant/chat", async (req, res) => {
    if (req.actor.type !== "board") {
      throw forbidden("Board authentication required");
    }

    const parsed = assistantRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid assistant request" });
      return;
    }

    const { message, context } = parsed.data;
    if (context.companyId) {
      assertCompanyAccess(req, context.companyId);
    }

    const [company, issue] = await Promise.all([
      context.companyId ? companies.getById(context.companyId) : Promise.resolve(null),
      context.issueId ? issues.getById(context.issueId) : Promise.resolve(null),
    ]);

    if (issue && context.companyId && issue.companyId !== context.companyId) {
      res.status(403).json({ error: "Issue does not belong to the active company" });
      return;
    }

    const issueComments = issue
      ? await issues.listComments(issue.id, { order: "asc", limit: 6 })
      : [];

    const fallback = buildFallbackReply({
      companyName: company?.name ?? null,
      issueTitle: issue?.title ?? null,
      issueStatus: issue?.status ?? null,
      issuePriority: issue?.priority ?? null,
      hasIssueContext: Boolean(issue),
      userMessage: message,
    });

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      res.json({
        message: fallback,
        mode: "fallback",
      });
      return;
    }

    const model = process.env.PAPERCLIP_APP_ASSISTANT_MODEL?.trim() || "gpt-5.4";
    const prompt = [
      "You are SMIRK, the in-app operating copilot for Paperclip.",
      "Be concise, practical, and opinionated.",
      "Help the user navigate the app, draft comments, triage issues, and decide the next operational action.",
      "Do not claim actions were performed unless explicitly stated in the supplied context.",
      "",
      `Current page: ${context.pageTitle ?? "Unknown page"} (${context.path})`,
      `Company: ${company?.name ?? "Unknown"}`,
      issue
        ? `Issue: ${issue.identifier} — ${issue.title}\nStatus: ${issue.status}\nPriority: ${issue.priority}\nAssigneeAgentId: ${issue.assigneeAgentId ?? "none"}`
        : "Issue: none",
      issueComments.length > 0
        ? `Recent issue comments:\n${summarizeCommentBodies(issueComments)}`
        : "Recent issue comments: none",
      "",
      `User request:\n${message}`,
    ].join("\n");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: prompt,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      res.json({
        message: `${fallback}\n\nModel response was unavailable${detail ? ` (${detail.slice(0, 200)})` : ""}.`,
        mode: "fallback",
      });
      return;
    }

    const payload = (await response.json()) as {
      output_text?: string;
    };

    res.json({
      message: payload.output_text?.trim() || fallback,
      mode: "model",
    });
  });

  return router;
}
