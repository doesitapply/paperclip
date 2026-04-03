import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  doublePrecision,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const closedLoopCalls = pgTable(
  "closed_loop_calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    callId: text("call_id").notNull(),
    contactId: text("contact_id"),
    twilioCallSid: text("twilio_call_sid").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull(),
    intent: text("intent").notNull(),
    urgency: text("urgency").notNull(),
    confidence: doublePrecision("confidence").notNull(),
    nextActionType: text("next_action_type").notNull(),
    finalOutcome: text("final_outcome").notNull(),
    finalOutcomeReason: text("final_outcome_reason").notNull(),
    summary: text("summary").notNull(),
    rawRecordJson: jsonb("raw_record_json").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStartedIdx: index("closed_loop_calls_company_started_idx").on(table.companyId, table.startedAt),
    companyOutcomeIdx: index("closed_loop_calls_company_outcome_idx").on(table.companyId, table.finalOutcome),
    callIdIdx: uniqueIndex("closed_loop_calls_call_id_idx").on(table.callId),
    twilioCallSidIdx: uniqueIndex("closed_loop_calls_twilio_call_sid_idx").on(table.twilioCallSid),
  }),
);

