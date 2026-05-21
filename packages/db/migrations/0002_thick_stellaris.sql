CREATE TABLE "model_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"model_id" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"context_window" integer NOT NULL,
	"max_output_tokens" integer NOT NULL,
	"input_cost_per_1m" numeric(12, 6) NOT NULL,
	"output_cost_per_1m" numeric(12, 6) NOT NULL,
	"supports_streaming" boolean DEFAULT true NOT NULL,
	"supports_vision" boolean DEFAULT false NOT NULL,
	"supports_tools" boolean DEFAULT false NOT NULL,
	"supports_json" boolean DEFAULT false NOT NULL,
	"supports_files" boolean DEFAULT false NOT NULL,
	"speed_tier" text,
	"quality_tier" text,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"is_deprecated" boolean DEFAULT false NOT NULL,
	"metadata_json" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "model_catalog_provider_model_idx" ON "model_catalog" USING btree ("provider","model_id");