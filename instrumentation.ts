export function register() {
  // Vercel roda em UTC e bloqueia a env var TZ (nome reservado). getCollectionWindow/getWeekRange
  // fazem aritmética de data em horário local — sem isso, "hoje" e os limites da semana
  // ficam até 3h errados em produção (Brasil não tem DST).
  process.env.TZ = 'America/Sao_Paulo';
}
