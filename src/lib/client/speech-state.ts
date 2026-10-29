export function speechPhase(state:string){
 if(state==='saved')return 'saved';
 if(state==='responded')return 'retained';
 if(state==='admitted'||state==='transmitting')return 'pending';
 if(['cancelled','stale','rejected','unavailable','exhausted','failed'].includes(state))return 'terminal';
 return 'unknown';
}
