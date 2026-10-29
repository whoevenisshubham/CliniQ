// Explicit locale/zone makes server rendering and browser hydration agree.
// Clinical source timestamps default to UTC; clinic/task callers keep their
// stored explicit zone. Missing timestamps never become epoch/default dates.
export function displayDateTime(value:string|null|undefined,zone='UTC'){
 const date=new Date(value??'');if(!Number.isFinite(date.getTime()))return 'Not recorded';
 try{return new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:zone}).format(date)+' · '+zone;}catch{return date.toISOString()+' · UTC';}
}
export function displayDate(value:string|null|undefined){
 const date=new Date(value??'');if(!Number.isFinite(date.getTime()))return 'Not recorded';
 return new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeZone:'UTC'}).format(date)+' · UTC';
}
