import type {OCRAccounting} from './accounting';
// Derived from Qwen's published Qwen3.8-27B chat_template.jinja: one system,
// one user, generation prefix, at most two image wrappers/labels, and the
// longest reasoning instruction. Count literal UTF-8 bytes, not an estimated
// tokens/character ratio; special-token spellings only overcount their IDs.
// https://huggingface.co/Qwen/Qwen3.8-27B/blob/main/chat_template.jinja
const wrappers='<|im_start|>system\n\n\n<|im_end|>\n<|im_start|>user\n<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n'
 +'Picture 1: <|vision_start|><|image_pad|><|vision_end|>Picture 2: <|vision_start|><|image_pad|><|vision_end|>'
 +'Reasoning effort is set to xhigh. Please think carefully through the task, validate key assumptions, consider plausible alternatives, and prioritize correctness, consistency, and clarity in the final answer.';
export const previewOCRAccounting:OCRAccounting={version:'ocr-accounting-v1',model:'qwen/qwen3.8-27b',documentation:'https://console.groq.com/docs/vision',textAccounting:'utf8-byte-upper-bound',framingTokens:Buffer.byteLength(wrappers,'utf8'),image:{kind:'fixed',tokens:2048},contextTokens:131072,maxInputTokens:7000,maxOutputTokens:1000,outputTokens:1000};
export const previewGroqLimits={requestsPerMinute:30,requestsPerDay:1000,tokensPerMinute:8000,tokensPerDay:200000,minIntervalSeconds:60};
