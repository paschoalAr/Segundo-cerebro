import { BLOCK_KINDS } from '@/src/plan/categories';
import { SECTORS } from '@/src/sectors/sector';
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const inboxStatus = pgEnum('inbox_status', ['new', 'processed', 'ignored']);
export const factKind = pgEnum('fact_kind', ['event', 'deadline', 'task', 'info']);
export const factSource = pgEnum('fact_source', ['moodle', 'gcal', 'outlook', 'inbox']);
export const blockKind = pgEnum('block_kind', BLOCK_KINDS);
export const blockStatus = pgEnum('block_status', ['planned', 'done', 'skipped']);
export const questionStatus = pgEnum('question_status', ['open', 'answered', 'dismissed']);
export const suggestionStatus = pgEnum('suggestion_status', ['pending', 'accepted', 'rejected']);
export const knowledgeSource = pgEnum('knowledge_source', ['claude-memory', 'note']);
export const runTrigger = pgEnum('run_trigger', ['cron', 'manual']);
export const runStatus = pgEnum('run_status', ['running', 'ok', 'error']);
export const sectorEnum = pgEnum('sector', SECTORS);
export const taskStatus = pgEnum('task_status', ['open', 'done', 'dropped']);
export const taskOrigin = pgEnum('task_origin', ['manual', 'motor']);

export const planRuns = pgTable(
  'plan_runs',
  {
    id: serial('id').primaryKey(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    trigger: runTrigger('trigger').notNull(),
    status: runStatus('status').notNull().default('running'),
    inputTokens: integer('input_tokens'),
    cacheReadTokens: integer('cache_read_tokens'),
    outputTokens: integer('output_tokens'),
    summary: text('summary'),
    error: text('error'),
    conflicts: jsonb('conflicts').$type<{ text: string; severity: 'info' | 'warn' }[]>().default([]),
  },
  (t) => [
    // Trava de concorrência: no máximo UM run sem finished_at. O índice é sobre a constante
    // (1), então todas as linhas em voo colidem entre si. Ver src/runs/lock.ts.
    uniqueIndex('plan_runs_one_running_idx')
      .on(sql`(1)`)
      .where(sql`${t.finishedAt} is null`),
  ],
);

export const inboxItems = pgTable('inbox_items', {
  id: serial('id').primaryKey(),
  text: text('text').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  status: inboxStatus('status').notNull().default('new'),
  processedInto: jsonb('processed_into').$type<{ factIds?: number[]; questionIds?: number[]; why?: string }>(),
});

export const facts = pgTable(
  'facts',
  {
    id: serial('id').primaryKey(),
    kind: factKind('kind').notNull(),
    title: text('title').notNull(),
    date: timestamp('date', { withTimezone: true }).notNull(),
    endDate: timestamp('end_date', { withTimezone: true }),
    allDay: boolean('all_day').notNull().default(false),
    source: factSource('source').notNull(),
    sourceRef: text('source_ref').notNull(),
    meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
    sector: sectorEnum('sector'),
    firstSeen: timestamp('first_seen', { withTimezone: true }).notNull().defaultNow(),
    lastSeen: timestamp('last_seen', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('facts_source_ref_idx').on(t.source, t.sourceRef), index('facts_sector_idx').on(t.sector)],
);

export const planBlocks = pgTable(
  'plan_blocks',
  {
    id: serial('id').primaryKey(),
    factId: integer('fact_id').references(() => facts.id, { onDelete: 'set null' }),
    taskId: integer('task_id').references(() => tasks.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    start: timestamp('start', { withTimezone: true }).notNull(),
    end: timestamp('end', { withTimezone: true }).notNull(),
    kind: blockKind('kind').notNull(),
    sector: sectorEnum('sector'),
    gcalEventId: text('gcal_event_id'),
    status: blockStatus('status').notNull().default('planned'),
    reason: text('reason').notNull(),
    prep: jsonb('prep').$type<Record<string, unknown>>(),
    createdRunId: integer('created_run_id').references(() => planRuns.id),
    updatedRunId: integer('updated_run_id').references(() => planRuns.id),
  },
  (t) => [
    uniqueIndex('plan_blocks_gcal_event_id_idx')
      .on(t.gcalEventId)
      .where(sql`${t.gcalEventId} is not null`),
    index('plan_blocks_sector_idx').on(t.sector),
  ],
);

export const questions = pgTable('questions', {
  id: serial('id').primaryKey(),
  text: text('text').notNull(),
  context: jsonb('context').$type<Record<string, unknown>>().notNull().default({}),
  askedAt: timestamp('asked_at', { withTimezone: true }).notNull().defaultNow(),
  answer: text('answer'),
  answeredAt: timestamp('answered_at', { withTimezone: true }),
  status: questionStatus('status').notNull().default('open'),
  runId: integer('run_id').references(() => planRuns.id),
});

export const taskSuggestions = pgTable('task_suggestions', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  sector: sectorEnum('sector'),
  due: timestamp('due', { withTimezone: true }),
  reason: text('reason').notNull(),
  fromQuestionId: integer('from_question_id').references(() => questions.id, { onDelete: 'set null' }),
  status: suggestionStatus('status').notNull().default('pending'),
  runId: integer('run_id').references(() => planRuns.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const tasks = pgTable(
  'tasks',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    sector: sectorEnum('sector'),
    /** Prazo, não hora de compromisso: tarefa não tem horário. */
    due: timestamp('due', { withTimezone: true }),
    status: taskStatus('status').notNull().default('open'),
    origin: taskOrigin('origin').notNull().default('manual'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    doneAt: timestamp('done_at', { withTimezone: true }),
    fromSuggestionId: integer('from_suggestion_id').references(() => taskSuggestions.id, { onDelete: 'set null' }),
  },
  (t) => [index('tasks_status_idx').on(t.status), index('tasks_sector_idx').on(t.sector)],
);

export const manual = pgTable('manual', {
  id: integer('id').primaryKey(),
  content: text('content').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const manualSuggestions = pgTable('manual_suggestions', {
  id: serial('id').primaryKey(),
  section: text('section').notNull(),
  text: text('text').notNull(),
  fromQuestionId: integer('from_question_id').references(() => questions.id, { onDelete: 'set null' }),
  status: suggestionStatus('status').notNull().default('pending'),
  runId: integer('run_id').references(() => planRuns.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const knowledge = pgTable('knowledge', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  source: knowledgeSource('source').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  // `embedding vector` entra quando o pgvector for ligado (spec §9 F4).
});

export const sourcesCache = pgTable('sources_cache', {
  source: text('source').primaryKey(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  payload: jsonb('payload').$type<unknown>().notNull(),
});

export const oauthTokens = pgTable('oauth_tokens', {
  provider: text('provider').primaryKey(),
  refreshTokenEnc: text('refresh_token_enc').notNull(),
  accessToken: text('access_token'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
