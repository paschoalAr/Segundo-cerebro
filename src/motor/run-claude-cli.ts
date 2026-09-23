import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { findClaudeCliPath } from './claude-cli';

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

const MAX_BUFFER = 32 * 1024 * 1024;
const TIMEOUT_MS = 5 * 60 * 1000;

/** Roda `claude -p` com saída estruturada, num diretório neutro (sem CLAUDE.md do
 * projeto). Sem --bare de propósito: --bare exige ANTHROPIC_API_KEY e ignora
 * CLAUDE_CODE_OAUTH_TOKEN (confirmado no --help) — quebraria o uso da assinatura.
 *
 * userPrompt vai por stdin, não por argv: o Windows limita a linha de comando
 * inteira a ~32k caracteres (CreateProcess), e o userPrompt monta com manual +
 * knowledge + facts da semana — passa disso fácil e o spawn falha com
 * ENAMETOOLONG (`claude -p` lê o prompt do stdin quando o posicional é omitido,
 * confirmado contra o binário real). systemPrompt e jsonSchema continuam via
 * argv por serem pequenos (poucos KB, fixos). */
export async function runClaudeCli(input: {
  systemPrompt: string;
  userPrompt: string;
  jsonSchema: Record<string, unknown>;
  model: string;
}): Promise<ClaudeCliResult> {
  const claudePath = await findClaudeCliPath();
  const cwd = path.join(os.tmpdir(), 'segundo-cerebro-motor');
  await mkdir(cwd, { recursive: true });

  // O validador de --json-schema do claude.exe tenta resolver "$schema" como um
  // $ref de meta-schema e falha offline ("no schema with key or ref ...draft/2020-12
  // /schema") — z.toJSONSchema() sempre inclui esse campo, então ele precisa sair
  // antes de virar argv (confirmado contra o binário real).
  const { $schema: _unused, ...jsonSchemaForCli } = input.jsonSchema;

  const args = [
    '-p',
    '--output-format', 'json',
    '--json-schema', JSON.stringify(jsonSchemaForCli),
    '--system-prompt', input.systemPrompt,
    '--tools', '',
    '--permission-prompts', 'none',
    '--no-session-persistence',
    '--model', input.model,
  ];

  const stdout = await runViaStdin(claudePath, args, input.userPrompt, cwd);
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

function runViaStdin(command: string, args: string[], stdinInput: string, cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: process.env });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let stdoutBytes = 0;
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error(`Claude Code excedeu o timeout de ${TIMEOUT_MS}ms`));
    }, TIMEOUT_MS);

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > MAX_BUFFER) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        child.kill();
        reject(new Error(`Saída do Claude Code excedeu ${MAX_BUFFER} bytes`));
        return;
      }
      stdoutChunks.push(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`claude.exe saiu com código ${code}: ${Buffer.concat(stderrChunks).toString('utf8')}`));
        return;
      }
      resolve(Buffer.concat(stdoutChunks).toString('utf8'));
    });

    child.stdin.end(stdinInput, 'utf8');
  });
}
