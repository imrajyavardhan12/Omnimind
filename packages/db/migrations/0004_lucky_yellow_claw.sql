CREATE TABLE "file_extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"extraction_type" text NOT NULL,
	"output_text" text,
	"output_storage_key" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"storage_bucket" text NOT NULL,
	"storage_key" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"sha256" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"extracted_text_key" text,
	"metadata_json" jsonb,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"attachment_role" text DEFAULT 'user_upload' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "file_extractions" ADD CONSTRAINT "file_extractions_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_user_id_app_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "file_extractions_file_idx" ON "file_extractions" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "files_workspace_idx" ON "files" USING btree ("workspace_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "message_attachments_message_idx" ON "message_attachments" USING btree ("message_id");