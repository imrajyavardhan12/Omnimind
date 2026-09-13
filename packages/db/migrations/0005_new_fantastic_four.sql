CREATE TABLE "council_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"conversation_id" uuid,
	"created_by_user_id" uuid NOT NULL,
	"query" text NOT NULL,
	"chairman_provider" text NOT NULL,
	"chairman_model" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "council_stage_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"council_run_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"model_provider" text,
	"model_id" text,
	"payload_json" jsonb,
	"status" text DEFAULT 'queued' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "council_runs" ADD CONSTRAINT "council_runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "council_runs" ADD CONSTRAINT "council_runs_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "council_runs" ADD CONSTRAINT "council_runs_created_by_user_id_app_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "council_stage_results" ADD CONSTRAINT "council_stage_results_council_run_id_council_runs_id_fk" FOREIGN KEY ("council_run_id") REFERENCES "public"."council_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "council_runs_workspace_idx" ON "council_runs" USING btree ("workspace_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "council_stage_results_run_idx" ON "council_stage_results" USING btree ("council_run_id");