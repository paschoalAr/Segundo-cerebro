-- Categorias de bloco por área da vida (trabalho / faculdade / pessoal), pra dar cor aos eventos do Cérebro.
-- O cast direto que o drizzle-kit gera quebraria: 'task' e 'buffer' não existem no enum novo.
-- Por isso a coluna passa por text e os valores antigos são traduzidos antes da conversão.
ALTER TABLE "plan_blocks" ALTER COLUMN "kind" SET DATA TYPE text;--> statement-breakpoint
UPDATE "plan_blocks" SET "kind" = 'assignment' WHERE "kind" = 'task';--> statement-breakpoint
UPDATE "plan_blocks" SET "kind" = 'personal' WHERE "kind" = 'buffer';--> statement-breakpoint
DROP TYPE "public"."block_kind";--> statement-breakpoint
CREATE TYPE "public"."block_kind" AS ENUM('work', 'class', 'exam', 'assignment', 'study', 'personal', 'travel');--> statement-breakpoint
ALTER TABLE "plan_blocks" ALTER COLUMN "kind" SET DATA TYPE "public"."block_kind" USING "kind"::"public"."block_kind";
