// Final/interim separation adapted from retained CliniQ useMedicalScribe.
// This reducer has no provider access and never treats an interim as a saved fact.
export class SpeechStreamText {
 private finals=new Map<number,string>();
 readonly rawFinals:unknown[]=[];
 interim='';
 accept(raw:unknown){
  if(!raw||typeof raw!=='object')return null;
  const r=raw as {type?:unknown;start?:unknown;is_final?:unknown;channel?:{alternatives?:{transcript?:unknown}[]}};
  if(r.type!=='Results')return null;
  const text=r.channel?.alternatives?.[0]?.transcript;
  if(typeof text!=='string'||text.length>8000)throw Error('INVALID_STREAM_RESULT');
  if(!text.trim())return null;
  if(typeof r.is_final!=='boolean'||typeof r.start!=='number'||!Number.isFinite(r.start)||r.start<0||r.start>70)throw Error('INVALID_STREAM_RESULT');
  if(r.is_final){
   // An upstream final for the same time span replaces that span; it is not appended twice.
   this.finals.set(r.start,text.trim());this.interim='';this.rawFinals.push(raw);
   if(this.rawFinals.length>128||new TextEncoder().encode(JSON.stringify(this.rawFinals)).length>60000||this.text.length>8000)throw Error('STREAM_RESULT_LIMIT');
  }else this.interim=text.trim();
  return {type:r.is_final?'final':'interim',text:r.is_final?this.text:this.interim};
 }
 get text(){return [...this.finals].sort(([a],[b])=>a-b).map(([,t])=>t).join(' ');}
}
