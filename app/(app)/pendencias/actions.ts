'use server';

import { revalidatePath } from 'next/cache';
import { answerQuestion, dismissQuestion } from '@/src/questions/repo';
import { acceptSuggestion, rejectSuggestion } from '@/src/manual/suggestions-repo';
import { acceptTaskSuggestion, rejectTaskSuggestion } from '@/src/tasks/suggestions-repo';

export async function answerQuestionAction(formData: FormData) {
  const answer = String(formData.get('answer') ?? '').trim();
  if (!answer) return;
  await answerQuestion(Number(formData.get('id')), answer);
  revalidatePath('/pendencias');
}

export async function dismissQuestionAction(formData: FormData) {
  await dismissQuestion(Number(formData.get('id')));
  revalidatePath('/pendencias');
}

export async function acceptSuggestionAction(formData: FormData) {
  const editedText = String(formData.get('text') ?? '').trim();
  await acceptSuggestion(Number(formData.get('id')), editedText || undefined);
  revalidatePath('/pendencias');
}

export async function rejectSuggestionAction(formData: FormData) {
  await rejectSuggestion(Number(formData.get('id')));
  revalidatePath('/pendencias');
}

export async function acceptTaskSuggestionAction(formData: FormData) {
  const editedTitle = String(formData.get('title') ?? '').trim();
  await acceptTaskSuggestion(Number(formData.get('id')), editedTitle || undefined);
  revalidatePath('/pendencias');
  revalidatePath('/semana');
  revalidatePath('/setor/[slug]', 'page');
}

export async function rejectTaskSuggestionAction(formData: FormData) {
  await rejectTaskSuggestion(Number(formData.get('id')));
  revalidatePath('/pendencias');
}
