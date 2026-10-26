// Shared Node server/background module; never imported by client components.
import Groq from 'groq-sdk';
import type { ProviderReply } from '@/lib/contracts/ai';
import { ProviderFailure } from './failure';
export const HISTORICAL_TEXT_MODEL = 'llama-3.3-70b-versatile';
export function classifyProviderFailure(status?:number){
    if(status===401||status===403)return new ProviderFailure('PROVIDER_AUTHENTICATION',true);
    if(status===429)return new ProviderFailure('RATE_LIMITED',true);
    // HTTP408/5xx or an unrecognized response do not establish whether upstream
    // processing occurred. Keep the reservation and never resend automatically.
    return new ProviderFailure('OUTCOME_UNKNOWN',false);
}
export function providerConfiguration() { return { enabled: process.env.AI_ENABLED === 'true' && !!process.env.LIVE_AI_AUTHORIZATION_REF && !!process.env.GROQ_API_KEY, model: process.env.AI_TEXT_MODEL || HISTORICAL_TEXT_MODEL, authorizationRef: process.env.LIVE_AI_AUTHORIZATION_REF ?? '' }; }
// Actual sends are reached only by the shared runner after an exact durable
// allowance reservation. Missing/default configuration performs no SDK call.
export async function executeLive(input: {
    messages: {
        role: 'system' | 'user';
        content: string;
    }[];
    maxOutput: number;
    signal: AbortSignal;
    attemptId: string;
    authorizationRef: string;
    model: string;
}): Promise<ProviderReply> {
    const c = providerConfiguration();
    if (!c.enabled || c.authorizationRef !== input.authorizationRef || c.model !== input.model || !input.attemptId)
        throw new Error('PROVIDER_DISABLED');
    if(input.signal.aborted)throw new ProviderFailure('OUTCOME_UNKNOWN',false);
    if(c.model==='openai/gpt-oss-20b'&&(!Number.isSafeInteger(input.maxOutput)||input.maxOutput<1||input.maxOutput>3000||Buffer.byteLength(JSON.stringify(input.messages),'utf8')+256+input.maxOutput>8000))throw new Error('PROVIDER_REQUEST_LIMIT');
    const client = new Groq({ apiKey: process.env.GROQ_API_KEY, maxRetries: 0, timeout: 45000 });
    let result;
    try {
        result = await client.chat.completions.create({ model: c.model, messages: input.messages, response_format: { type: 'json_object' }, ...(c.model==='openai/gpt-oss-20b'?{reasoning_effort:'low' as const,include_reasoning:false}:{}), temperature: 0.1, max_completion_tokens: input.maxOutput }, { signal: input.signal });
    }
    catch (e) {
        throw classifyProviderFailure(e instanceof Groq.APIError?e.status:undefined);
    }
    return { text: result.choices[0]?.message.content ?? '', finishReason: result.choices[0]?.finish_reason ?? 'missing', usage: result.usage ? { input: result.usage.prompt_tokens, output: result.usage.completion_tokens } : undefined };
}
