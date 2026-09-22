import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { findClaudeCliPath } from './claude-cli';

const execFileAsync = promisify(execFile);

export type ClaudeCliResult = {
  structuredOutput: unknown;
  usage: { inputTokens: number; outputTokens: number; cacheReadInputTokens: number; cacheCreationInputTokens: number };
};

type Envelope = {
  is_error: boolean;
  result: string;
  structured_output?: unknown;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
  };
};

/** Roda `claude -p` com saída estruturada, num diretório neutro (sem CLAUDE.md do
 * projeto). Sem --bare de propósito: --bare exige ANTHROPIC_API_KEY e ignora
 * CLAUDE_CODE_OAUTH_TOKEN (confirmado no --help) — quebraria o uso da assinatura. */
export async function runClaudeCli(input: {
  systemPrompt: string;
  userPrompt: string;
  jsonSchema: Record<string, unknown>;
  model: string;
}): Promise<ClaudeCliResult> {
  const claudePath = await findClaudeCliPath();
  const cwd = path.join(os.tmpdir(), 'segundo-cerebro-motor');
  await mkdir(cwd, { recursive: true });

  const args = [
    '-p',
    '--output-format', 'json',
    '--json-schema', JSON.stringify(input.jsonSchema),
    '--system-prompt', input.systemPrompt,
    '--tools', '',
    '--permission-prompts', 'none',
    '--no-session-persistence',
    '--model', input.model,
    input.userPrompt,
  ];

  const { stdout } = await execFileAsync(claudePath, args, {
    cwd,
    encoding: 'utf8',
    timeout: 5 * 60 * 1000,
    maxBuffer: 32 * 1024 * 1024,
    env: process.env,
  });

  const envelope = JSON.parse(stdout) as Envelope;

  if (envelope.is_error) {
    throw new Error(`Claude Code retornou erro: ${envelope.result}`);
  }
  if (envelope.structured_output === undefined) {
    throw new Error(`Claude Code não retornou structured_output — resposta: ${envelope.result}`);
  }

  return {
    structuredOutput: envelope.structured_output,
    usage: {
      inputTokens: envelope.usage.input_tokens,
      outputTokens: envelope.usage.output_tokens,
      cacheReadInputTokens: envelope.usage.cache_read_input_tokens,
      cacheCreationInputTokens: envelope.usage.cache_creation_input_tokens,
    },
  };
}
