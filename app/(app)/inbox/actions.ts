'use server';

import { revalidatePath } from 'next/cache';
import { addInboxItem, deleteInboxItem } from '@/src/inbox/repo';

export async function sendToInbox(formData: FormData) {
  await addInboxItem(String(formData.get('text') ?? ''));
  revalidatePath('/inbox');
}

export async function removeFromInbox(formData: FormData) {
  await deleteInboxItem(Number(formData.get('id')));
  revalidatePath('/inbox');
}
