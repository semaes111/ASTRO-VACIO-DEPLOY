// ============================================================
// lib/ai/sonnet.ts - Wrapper de Claude Sonnet 4.5 para generacion
// ============================================================

import Anthropic from '@anthropic-ai/sdk';

export interface GenerationRequest {
  system: string;
  user: string;
  max_tokens?: number;
  temperature?: number;
}

export interface GenerationResult {
  content: string;
  tokens_in: number;
  tokens_out: number;
  model_used: string;
  cost_usd: number;
  duration_ms: number;
}

const SONNET_45_IN_PER_MTOK = 3;
const SONNET_45_OUT_PER_MTOK = 15;

export async function generateWithSonnet(
  req: GenerationRequest
): Promise<GenerationResult> {
  const start = Date.now();

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: req.max_tokens ?? 16000,
    temperature: req.temperature ?? 0.7,
    system: req.system,
    messages: [{ role: 'user', content: req.user }],
  });

  const content = response.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map((c) => c.text)
    .join('\n');

  const inTokens = response.usage.input_tokens;
  const outTokens = response.usage.output_tokens;
  const cost =
    (inTokens * SONNET_45_IN_PER_MTOK + outTokens * SONNET_45_OUT_PER_MTOK) / 1_000_000;

  return {
    content,
    tokens_in: inTokens,
    tokens_out: outTokens,
    model_used: 'claude-sonnet-4-5-20250929',
    cost_usd: cost,
    duration_ms: Date.now() - start,
  };
}
