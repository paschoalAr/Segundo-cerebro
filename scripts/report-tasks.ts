import 'dotenv/config';
import { isNotNull } from 'drizzle-orm';
import { db } from '@/src/db';
import { planBlocks, tasks } from '@/src/db/schema';

const open = await db.select({ id: tasks.id, title: tasks.title, sector: tasks.sector, origin: tasks.origin }).from(tasks);
const linked = await db
  .select({ id: planBlocks.id, title: planBlocks.title, taskId: planBlocks.taskId })
  .from(planBlocks)
  .where(isNotNull(planBlocks.taskId));

console.log('tarefas:', open);
console.log('blocos ligados a tarefa:', linked);
