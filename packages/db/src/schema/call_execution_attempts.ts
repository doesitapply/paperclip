import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { closedLoopCalls } from "./closed_loop_calls.js";

export const callExecutionAttempts = pgTable(
  "call_execution_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    closedLoopCallId: uuid("closed_loop_call_id")
      .notNull()
      .references(() => closedLoopCalls.id, { onDelete: "cascade" }),
    callId: text("call_id").notNull(),
    sequence: integer("sequence").notNull(),
    actionType: text("action_type").notNull(),
    reason: text("reason").notNull(),
    status: text("status").notNull(),
    executionMode: text("execution_mode").notNull().default("stub"),
    provider: text("provider"),
    externalId: text("external_id"),
    template: text("template"),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }).notNull(),
    payloadJson: jsonb("payload_json").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCallIdx: index("call_execution_attempts_company_call_idx").on(table.companyId, table.callId),
    callRecordIdx: index("call_execution_attempts_call_record_idx").on(table.closedLoopCallId),
    uniqueSequenceIdx: uniqueIndex("call_execution_attempts_call_sequence_idx").on(table.callId, table.sequence),
  }),
);
