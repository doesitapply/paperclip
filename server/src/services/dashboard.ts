import { and, eq, gte, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents, approvals, callExecutionAttempts, closedLoopCalls, companies, costEvents, issues } from "@paperclipai/db";
import { notFound } from "../errors.js";
import { budgetService } from "./budgets.js";

export function dashboardService(db: Db) {
  const budgets = budgetService(db);
  return {
    summary: async (companyId: string) => {
      const company = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId))
        .then((rows) => rows[0] ?? null);

      if (!company) throw notFound("Company not found");

      const agentRows = await db
        .select({ status: agents.status, count: sql<number>`count(*)` })
        .from(agents)
        .where(eq(agents.companyId, companyId))
        .groupBy(agents.status);

      const taskRows = await db
        .select({ status: issues.status, count: sql<number>`count(*)` })
        .from(issues)
        .where(eq(issues.companyId, companyId))
        .groupBy(issues.status);

      const pendingApprovals = await db
        .select({ count: sql<number>`count(*)` })
        .from(approvals)
        .where(and(eq(approvals.companyId, companyId), eq(approvals.status, "pending")))
        .then((rows) => Number(rows[0]?.count ?? 0));

      const agentCounts: Record<string, number> = {
        active: 0,
        running: 0,
        paused: 0,
        error: 0,
      };
      for (const row of agentRows) {
        const count = Number(row.count);
        // "idle" agents are operational — count them as active
        const bucket = row.status === "idle" ? "active" : row.status;
        agentCounts[bucket] = (agentCounts[bucket] ?? 0) + count;
      }

      const taskCounts: Record<string, number> = {
        open: 0,
        inProgress: 0,
        blocked: 0,
        done: 0,
      };
      for (const row of taskRows) {
        const count = Number(row.count);
        if (row.status === "in_progress") taskCounts.inProgress += count;
        if (row.status === "blocked") taskCounts.blocked += count;
        if (row.status === "done") taskCounts.done += count;
        if (row.status !== "done" && row.status !== "cancelled") taskCounts.open += count;
      }

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const [{ monthSpend }] = await db
        .select({
          monthSpend: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
        })
        .from(costEvents)
        .where(
          and(
            eq(costEvents.companyId, companyId),
            gte(costEvents.occurredAt, monthStart),
          ),
        );

      const monthSpendCents = Number(monthSpend);
      const utilization =
        company.budgetMonthlyCents > 0
          ? (monthSpendCents / company.budgetMonthlyCents) * 100
          : 0;
      const budgetOverview = await budgets.overview(companyId);
      const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const callOutcomeRows = await db
        .select({
          finalOutcome: closedLoopCalls.finalOutcome,
          count: sql<number>`count(*)`,
        })
        .from(closedLoopCalls)
        .where(and(eq(closedLoopCalls.companyId, companyId), gte(closedLoopCalls.startedAt, last7d)))
        .groupBy(closedLoopCalls.finalOutcome);

      const executionModeRows = await db
        .select({
          executionMode: callExecutionAttempts.executionMode,
          count: sql<number>`count(*)`,
        })
        .from(callExecutionAttempts)
        .where(and(eq(callExecutionAttempts.companyId, companyId), gte(callExecutionAttempts.startedAt, last7d)))
        .groupBy(callExecutionAttempts.executionMode);

      const lastCallRow = await db
        .select({
          completedAt: closedLoopCalls.completedAt,
        })
        .from(closedLoopCalls)
        .where(eq(closedLoopCalls.companyId, companyId))
        .orderBy(sql`${closedLoopCalls.completedAt} desc`)
        .limit(1)
        .then((rows) => rows[0] ?? null);

      const outcomeCounts: Record<string, number> = {
        booked: 0,
        escalated: 0,
        follow_up_sent: 0,
        task_created: 0,
        disqualified: 0,
      };
      for (const row of callOutcomeRows) {
        outcomeCounts[row.finalOutcome] = Number(row.count);
      }

      const executionModeCounts: Record<string, number> = {
        live: 0,
        stub: 0,
      };
      for (const row of executionModeRows) {
        executionModeCounts[row.executionMode] = Number(row.count);
      }

      const twilioVoiceFrom = process.env.TWILIO_VOICE_FROM?.trim() || process.env.TWILIO_PHONE_NUMBER?.trim() || null;
      const twilioSmsFrom = process.env.TWILIO_SMS_FROM?.trim() || process.env.TWILIO_PHONE_NUMBER?.trim() || null;
      const twilioConfigured = Boolean(process.env.TWILIO_ACCOUNT_SID?.trim() && process.env.TWILIO_AUTH_TOKEN?.trim());
      const googleConfigured = Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim());
      const openAiConfigured = Boolean(process.env.OPENAI_API_KEY?.trim() && process.env.OPENAI_API_KEY !== "sk-REPLACE_WITH_REAL_OPENAI_KEY");

      return {
        companyId,
        company: {
          name: company.name,
          status: company.status,
          issuePrefix: company.issuePrefix,
          brandColor: company.brandColor ?? null,
        },
        agents: {
          active: agentCounts.active,
          running: agentCounts.running,
          paused: agentCounts.paused,
          error: agentCounts.error,
        },
        tasks: taskCounts,
        costs: {
          monthSpendCents,
          monthBudgetCents: company.budgetMonthlyCents,
          monthUtilizationPercent: Number(utilization.toFixed(2)),
        },
        pendingApprovals,
        budgets: {
          activeIncidents: budgetOverview.activeIncidents.length,
          pendingApprovals: budgetOverview.pendingApprovalCount,
          pausedAgents: budgetOverview.pausedAgentCount,
          pausedProjects: budgetOverview.pausedProjectCount,
        },
        voiceOps: {
          callsLast7d:
            outcomeCounts.booked +
            outcomeCounts.escalated +
            outcomeCounts.follow_up_sent +
            outcomeCounts.task_created +
            outcomeCounts.disqualified,
          booked: outcomeCounts.booked,
          followUpSent: outcomeCounts.follow_up_sent,
          taskCreated: outcomeCounts.task_created,
          escalated: outcomeCounts.escalated,
          disqualified: outcomeCounts.disqualified,
          liveExecutions: executionModeCounts.live,
          stubExecutions: executionModeCounts.stub,
          lastCallAt: lastCallRow?.completedAt?.toISOString() ?? null,
        },
        integrations: {
          twilioVoice: {
            configured: twilioConfigured && Boolean(twilioVoiceFrom),
            live: twilioConfigured && Boolean(twilioVoiceFrom),
            fromPhone: twilioVoiceFrom,
          },
          twilioSms: {
            configured: twilioConfigured && Boolean(twilioSmsFrom),
            live: twilioConfigured && Boolean(twilioSmsFrom),
            fromPhone: twilioSmsFrom,
          },
          googleCalendar: {
            configured: googleConfigured,
            live: googleConfigured,
          },
          openai: {
            configured: openAiConfigured,
            live: openAiConfigured,
          },
        },
      };
    },
  };
}
