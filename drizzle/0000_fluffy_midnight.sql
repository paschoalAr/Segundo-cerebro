CREATE TYPE "public"."block_kind" AS ENUM('study', 'task', 'travel', 'buffer');--> statement-breakpoint
CREATE TYPE "public"."block_status" AS ENUM('planned', 'done', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."fact_kind" AS ENUM('event', 'deadline', 'task', 'info');--> statement-breakpoint
CREATE TYPE "public"."fact_source" AS ENUM('moodle', 'gcal', 'outlook', 'inbox');--> statement-breakpoint
CREATE TYPE "public"."inbox_status" AS ENUM('new', 'processed', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."knowledge_source" AS ENUM('claude-memory', 'note');--> statement-breakpoint
CREATE TYPE "public"."question_status" AS ENUM('open', 'answered', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('running', 'ok', 'error');--> statement-breakpoint
CREATE TYPE "public"."run_trigger" AS ENUM('cron', 'manual');--> statement-breakpoint
CREATE TYPE "public"."suggestion_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TABLE "facts" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" "fact_kind" NOT NULL,
	"title" text NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"all_day" boolean DEFAULT false NOT NULL,
	"source" "fact_source" NOT NULL,
	"source_ref" text NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbox_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "inbox_status" DEFAULT 'new' NOT NULL,
	"processed_into" jsonb
);
--> statement-breakpoint
CREATE TABLE "knowledge" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"source" "knowledge_source" NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "manual" (
	"id" integer PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manual_suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"section" text NOT NULL,
	"text" text NOT NULL,
	"from_question_id" integer,
	"status" "suggestion_status" DEFAULT 'pending' NOT NULL,
	"run_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_tokens" (
	"provider" text PRIMARY KEY NOT NULL,
	"refresh_token_enc" text NOT NULL,
	"access_token" text,
	"expires_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_blocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"fact_id" integer,
	"title" text NOT NULL,
	"start" timestamp with time zone NOT NULL,
	"end" timestamp with time zone NOT NULL,
	"kind" "block_kind" NOT NULL,
	"gcal_event_id" text,
	"status" "block_status" DEFAULT 'planned' NOT NULL,
	"reason" text NOT NULL,
	"prep" jsonb,
	"created_run_id" integer,
	"updated_run_id" integer
);
--> statement-breakpoint
CREATE TABLE "plan_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"trigger" "run_trigger" NOT NULL,
	"status" "run_status" DEFAULT 'running' NOT NULL,
	"input_tokens" integer,
	"cache_read_tokens" integer,
	"output_tokens" integer,
	"summary" text,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"asked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"answer" text,
	"answered_at" timestamp with time zone,
	"status" "question_status" DEFAULT 'open' NOT NULL,
	"run_id" integer
);
--> statement-breakpoint
CREATE TABLE "sources_cache" (
	"source" text PRIMARY KEY NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "manual_suggestions" ADD CONSTRAINT "manual_suggestions_from_question_id_questions_id_fk" FOREIGN KEY ("from_question_id") REFERENCES "public"."questions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_suggestions" ADD CONSTRAINT "manual_suggestions_run_id_plan_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."plan_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_blocks" ADD CONSTRAINT "plan_blocks_fact_id_facts_id_fk" FOREIGN KEY ("fact_id") REFERENCES "public"."facts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_blocks" ADD CONSTRAINT "plan_blocks_created_run_id_plan_runs_id_fk" FOREIGN KEY ("created_run_id") REFERENCES "public"."plan_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_blocks" ADD CONSTRAINT "plan_blocks_updated_run_id_plan_runs_id_fk" FOREIGN KEY ("updated_run_id") REFERENCES "public"."plan_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_run_id_plan_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."plan_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "facts_source_ref_idx" ON "facts" USING btree ("source","source_ref");