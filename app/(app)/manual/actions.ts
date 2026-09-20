'use server';

import { revalidatePath } from 'next/cache';
import { saveManual } from '@/src/manual/repo';

export async function updateManual(formData: FormData) {
  await saveManual(String(formData.get('content') ?? ''));
  revalidatePath('/manual');
}
