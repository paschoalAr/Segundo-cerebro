import { readdir } from 'node:fs/promises';
import path from 'node:path';

/** Compara versões tipo "2.1.275" numericamente, componente a componente — não como string. */
export function pickLatestVersion(versions: string[]): string | null {
  const parsed = versions
    .map((v) => ({ raw: v, parts: v.split('.').map(Number) }))
    .filter((v) => v.parts.length > 0 && v.parts.every((n) => Number.isFinite(n)));
  if (parsed.length === 0) return null;

  parsed.sort((a, b) => {
    const len = Math.max(a.parts.length, b.parts.length);
    for (let i = 0; i < len; i++) {
      const diff = (a.parts[i] ?? 0) - (b.parts[i] ?? 0);
      if (diff !== 0) return diff;
    }
    return 0;
  });

  return parsed[parsed.length - 1].raw;
}

/** O app desktop instala o claude.exe numa pasta versionada dentro do pacote MSIX —
 * o número de versão muda a cada atualização, então isso precisa ser resolvido a cada
 * execução, nunca hardcoded (achado durante o brainstorm desta task, contra a instalação real). */
export async function findClaudeCliPath(): Promise<string> {
  const packagesDir = path.join(process.env.LOCALAPPDATA ?? '', 'Packages');
  const packageDirs = await readdir(packagesDir).catch(() => [] as string[]);
  const claudePackage = packageDirs.find((d) => d.startsWith('Claude_'));
  if (!claudePackage) throw new Error(`Não encontrei a pasta do app Claude em ${packagesDir}`);

  const claudeCodeDir = path.join(packagesDir, claudePackage, 'LocalCache', 'Roaming', 'Claude', 'claude-code');
  const versions = await readdir(claudeCodeDir).catch(() => [] as string[]);
  const latest = pickLatestVersion(versions);
  if (!latest) throw new Error(`Não encontrei nenhuma versão do Claude Code em ${claudeCodeDir}`);

  return path.join(claudeCodeDir, latest, 'claude.exe');
}
