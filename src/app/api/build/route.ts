import {buildIdentity} from '@/lib/server/build-identity';
export const dynamic='force-dynamic';
export function GET(){return Response.json(buildIdentity(),{headers:{'Cache-Control':'no-store'}});}
