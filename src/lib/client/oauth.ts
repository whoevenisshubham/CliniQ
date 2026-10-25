export function verifiedGoogleStartUrl(value:unknown,supabaseUrl:string|undefined){
 if(typeof value!=='string'||value.length>8192||!supabaseUrl)throw new Error('Google sign-in could not be confirmed.');
 const target=new URL(value),expected=new URL(supabaseUrl);
 if(target.protocol!=='https:'||target.origin!==expected.origin||target.pathname!=='/auth/v1/authorize'||target.username||target.password||target.hash||target.searchParams.get('provider')!=='google')throw new Error('Google sign-in could not be confirmed.');
 return target.href;
}
