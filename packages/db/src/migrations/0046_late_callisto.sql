CREATE TABLE "closed_loop_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"call_id" text NOT NULL,
	"contact_id" text,
	"twilio_call_sid" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	"intent" text NOT NULL,
	"urgency" text NOT NULL,
	"confidence" double precision NOT NULL,
	"next_action_type" text NOT NULL,
	"final_outcome" text NOT NULL,
	"final_outcome_reason" text NOT NULL,
	"summary" text NOT NULL,
	"raw_record_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "call_execution_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"closed_loop_call_id" uuid NOT NULL,
	"call_id" text NOT NULL,
	"sequence" integer NOT NULL,
	"action_type" text NOT NULL,
	"reason" text NOT NULL,
	"status" text NOT NULL,
	"execution_mode" text DEFAULT 'stub' NOT NULL,
	"provider" text,
	"external_id" text,
	"template" text,
	"error" text,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone NOT NULL,
	"payload_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "closed_loop_calls" ADD CONSTRAINT "closed_loop_calls_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "call_execution_attempts" ADD CONSTRAINT "call_execution_attempts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "call_execution_attempts" ADD CONSTRAINT "call_execution_attempts_closed_loop_call_id_closed_loop_calls_id_fk" FOREIGN KEY ("closed_loop_call_id") REFERENCES "public"."closed_loop_calls"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "closed_loop_calls_company_started_idx" ON "closed_loop_calls" USING btree ("company_id","started_at");
--> statement-breakpoint
CREATE INDEX "closed_loop_calls_company_outcome_idx" ON "closed_loop_calls" USING btree ("company_id","final_outcome");
--> statement-breakpoint
CREATE UNIQUE INDEX "closed_loop_calls_call_id_idx" ON "closed_loop_calls" USING btree ("call_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "closed_loop_calls_twilio_call_sid_idx" ON "closed_loop_calls" USING btree ("twilio_call_sid");
--> statement-breakpoint
CREATE INDEX "call_execution_attempts_company_call_idx" ON "call_execution_attempts" USING btree ("company_id","call_id");
--> statement-breakpoint
CREATE INDEX "call_execution_attempts_call_record_idx" ON "call_execution_attempts" USING btree ("closed_loop_call_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "call_execution_attempts_call_sequence_idx" ON "call_execution_attempts" USING btree ("call_id","sequence");
