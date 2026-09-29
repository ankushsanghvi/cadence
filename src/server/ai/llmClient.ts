import OpenAI from 'openai';
import type { Stream } from 'openai/streaming';

export const DEFAULT_API_KEY =
  process.env.OPENAI_API_KEY || '';

export const DEFAULT_BASE_URL =
  process.env.OPENAI_BASE_URL || 'https://aicredits.in/v1';

export const DEFAULT_MODEL =
  process.env.OPENAI_MODEL || 'openai/gpt-5-nano';

export type LLMRuntimeStatus = { configured: boolean; tracingEnabled: boolean; model: string; providerHost: string };

/** Safe diagnostic state; deliberately excludes credentials. */
export function getLLMRuntimeStatus(): LLMRuntimeStatus {
  let providerHost = 'invalid-url';
  try { providerHost = new URL(DEFAULT_BASE_URL).host; } catch { /* provider call reports malformed URL */ }
  return { configured: Boolean(DEFAULT_API_KEY.trim()), tracingEnabled: process.env.LANGSMITH_TRACING === 'true' && Boolean(process.env.LANGSMITH_API_KEY), model: DEFAULT_MODEL, providerHost };
}

/**
 * Creates and returns an OpenAI client configured for the aicredits.in endpoint.
 */
export function getOpenAIClient(customApiKey?: string, customBaseUrl?: string): OpenAI {
  const apiKey = (customApiKey && customApiKey.trim().length > 0) ? customApiKey : DEFAULT_API_KEY;
  const baseURL = (customBaseUrl && customBaseUrl.trim().length > 0) ? customBaseUrl : DEFAULT_BASE_URL;

  const client = new OpenAI({
    apiKey,
    baseURL,
  });
  return client;
}

export interface ChatOptions {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  model?: string;
  temperature?: number;
  responseFormat?: 'json_object' | 'text';
  stream?: false;
  apiKey?: string;
  baseURL?: string;
  timeoutMs?: number;
  maxRetries?: number;
  traceName?: string;
}

export interface StreamChatOptions extends Omit<ChatOptions, 'stream'> { stream: true; }

/**
 * Helper to run chat completions against the configured endpoint.
 */
export function executeChatCompletion(options: StreamChatOptions): Promise<Stream<OpenAI.ChatCompletionChunk>>;
export function executeChatCompletion(options: ChatOptions): Promise<OpenAI.ChatCompletion>;
export async function executeChatCompletion(options: ChatOptions | StreamChatOptions): Promise<OpenAI.ChatCompletion | Stream<OpenAI.ChatCompletionChunk>> {
  const client = getOpenAIClient(options.apiKey, options.baseURL);
  const model = options.model || DEFAULT_MODEL;

  const params: OpenAI.ChatCompletionCreateParamsNonStreaming = {
    model,
    messages: options.messages,
    temperature: options.temperature ?? 0.2,
  };

  if (options.responseFormat === 'json_object') {
    params.response_format = { type: 'json_object' };
  }

  const requestOptions: OpenAI.RequestOptions = {
    ...(Number.isInteger(options.timeoutMs) ? { timeout: options.timeoutMs } : {}),
    ...(Number.isInteger(options.maxRetries) ? { maxRetries: options.maxRetries } : {}),
  };
  const perform = async (): Promise<OpenAI.ChatCompletion | Stream<OpenAI.ChatCompletionChunk>> => {
   if (options.stream) {
    const streamParams = { ...params, stream: true } as OpenAI.ChatCompletionCreateParamsStreaming;
    return await client.chat.completions.create(streamParams, requestOptions);
   }
   return await client.chat.completions.create(params, requestOptions);
  };
  if (!getLLMRuntimeStatus().tracingEnabled || typeof window !== 'undefined') return perform();

  // Dynamic server-only import prevents the LangSmith Node runtime from being
  // bundled into browser code (this module is also used by client-safe agents).
  const { traceable } = await import('langsmith/traceable');
  const traced = traceable(perform, {
    name: options.traceName || 'Cadence LLM Call', run_type: 'llm', project_name: process.env.LANGSMITH_PROJECT || 'cadence',
    metadata: { service: 'cadence', model, environment: process.env.NODE_ENV || 'development' },
    processInputs: () => ({ redacted: true, model }),
    processOutputs: (result) => {
      const completion = result as OpenAI.ChatCompletion;
      return { model: completion?.model || model, usage: completion?.usage || null };
    },
  });
  return traced();
}
