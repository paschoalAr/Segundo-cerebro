import { z } from 'zod';
import { BLOCK_KINDS } from './categories';
import { SECTORS } from '@/src/sectors/sector';

const FactKind = z.enum(['event', 'deadline', 'task', 'info']);
const BlockKind = z.enum(BLOCK_KINDS);

export const PlanOutputSchema = z.object({
  inbox: z.array(
    z.object({
      id: z.number(),
      interpretation: z.discriminatedUnion('type', [
        z.object({
          type: z.literal('fact'),
          kind: FactKind,
          title: z.string(),
          date: z.string(),
          end_date: z.string().nullable(),
          all_day: z.boolean(),
        }),
        z.object({ type: z.literal('question'), text: z.string() }),
        z.object({ type: z.literal('ignore'), why: z.string() }),
      ]),
    }),
  ),
  blocks: z.object({
    create: z.array(
      z.object({
        title: z.string(),
        start: z.string(),
        end: z.string(),
        kind: BlockKind,
        fact_id: z.number().nullable(),
        task_id: z.number().nullable(),
        reason: z.string(),
      }),
    ),
    update: z.array(
      z.object({
        id: z.number(),
        title: z.string(),
        start: z.string(),
        end: z.string(),
        reason: z.string(),
      }),
    ),
    delete: z.array(z.object({ id: z.number(), reason: z.string() })),
  }),
  conflicts: z.array(z.object({ text: z.string(), severity: z.enum(['info', 'warn']) })),
  questions: z.array(z.object({ text: z.string(), context: z.record(z.string(), z.unknown()) })),
  manual_suggestions: z.array(
    z.object({ section: z.string(), text: z.string(), from_question_id: z.number().nullable() }),
  ),
  task_suggestions: z.array(
    z.object({
      title: z.string(),
      sector: z.enum(SECTORS).nullable(),
      due: z.string().nullable(),
      reason: z.string(),
      from_question_id: z.number().nullable(),
    }),
  ),
  summary: z.string(),
});

export type PlanOutput = z.infer<typeof PlanOutputSchema>;
