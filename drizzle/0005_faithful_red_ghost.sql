CREATE TYPE "public"."task_origin" AS ENUM('manual', 'motor');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('open', 'done', 'dropped');--> statement-breakpoint
CREATE TABLE "task_suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"sector" "sector",
	"due" timestamp with time zone,
	"reason" text NOT NULL,
	"from_question_id" integer,
	"status" "suggestion_status" DEFAULT 'pending' NOT NULL,
	"run_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"sector" "sector",
	"due" timestamp with time zone,
	"status" "task_status" DEFAULT 'open' NOT NULL,
	"origin" "task_origin" DEFAULT 'manual' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"done_at" timestamp with time zone,
	"from_suggestion_id" integer
);
--> statement-breakpoint
ALTER TABLE "plan_blocks" ADD COLUMN "task_id" integer;--> statement-breakpoint
ALTER TABLE "task_suggestions" ADD CONSTRAINT "task_suggestions_from_question_id_questions_id_fk" FOREIGN KEY ("from_question_id") REFERENCES "public"."questions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_suggestions" ADD CONSTRAINT "task_suggestions_run_id_plan_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."plan_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_from_suggestion_id_task_suggestions_id_fk" FOREIGN KEY ("from_suggestion_id") REFERENCES "public"."task_suggestions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_status_idx" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tasks_sector_idx" ON "tasks" USING btree ("sector");--> statement-breakpoint
ALTER TABLE "plan_blocks" ADD CONSTRAINT "plan_blocks_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;