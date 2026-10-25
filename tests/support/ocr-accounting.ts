import type {OCRAccounting} from '@/lib/server/ocr/accounting';
// Finite synthetic formula solely for doubles; never model/account metadata.
export const syntheticAccounting:OCRAccounting={version:'ocr-accounting-v1',model:'qwen/qwen3.8-27b',documentation:'https://console.groq.com/docs/vision',textAccounting:'utf8-byte-upper-bound',framingTokens:64,image:{kind:'fixed',tokens:2048},contextTokens:16000,maxInputTokens:12000,maxOutputTokens:1500,outputTokens:1000};
