/**
 * Valida o `fact_id` que a Claude devolve para um bloco.
 *
 * Ela não tem como referenciar um fato criado no MESMO run: os ids só nascem no insert,
 * depois que ela já respondeu. Quando quer apontar para um fato que acabou de sair da inbox,
 * acaba mandando o id do item da inbox — que aponta para outro fato, ou para nenhum. Um id
 * inexistente estoura a foreign key e derruba o run inteiro no meio da aplicação.
 *
 * Mesma escolha que `applyPlanOutput` já faz com seção de manual inválida: degradar, não
 * quebrar. O bloco vale por si; perder o vínculo com o fato é menos ruim que perder o plano.
 */
export function sanitizeFactId(factId: number | null, existingFactIds: readonly number[]): number | null {
  if (factId === null) return null;
  return existingFactIds.includes(factId) ? factId : null;
}
