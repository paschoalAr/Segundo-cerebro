CREATE TYPE "public"."sector" AS ENUM('estudos', 'carreira', 'financas', 'saude', 'projetos', 'pessoal');--> statement-breakpoint
ALTER TABLE "facts" ADD COLUMN "sector" "sector";--> statement-breakpoint
ALTER TABLE "plan_blocks" ADD COLUMN "sector" "sector";--> statement-breakpoint
CREATE INDEX "facts_sector_idx" ON "facts" USING btree ("sector");--> statement-breakpoint
CREATE INDEX "plan_blocks_sector_idx" ON "plan_blocks" USING btree ("sector");