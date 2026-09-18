import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Só servidor: server components, server actions, rotas de API e scripts.
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL não definida');

export const db = drizzle(neon(url), { schema });
export type Db = typeof db;
