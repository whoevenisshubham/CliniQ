// Local configuration validation only: no provider, Auth, database or console call.
import {configuredAccounting} from '../src/lib/server/ocr/accounting';
import {PROPOSED_VISION_MODEL,ocrProvider} from '../src/lib/server/ocr/provider';
import {speechTransport} from '../src/lib/server/speech/transport';
const model=process.env.OCR_VISION_MODEL||PROPOSED_VISION_MODEL;
console.log(JSON.stringify({scope:'local configuration shape only; not account entitlement/schema/allowance acceptance',ocrRequested:process.env.OCR_ENABLED==='true',ocrAccountingReady:!!configuredAccounting(model),ocrServerConfigured:!!ocrProvider(),speechServerConfigured:speechTransport().mode==='live',legacyAI_OCR_MODEL_Ignored:!!process.env.AI_OCR_MODEL,schemaChecked:false,allowanceChecked:false,externalCalls:0,secretValuesPrinted:false}));
