import {DeferredWorkspace} from '@/components/shared/DeferredWorkspace';
export const dynamic='force-dynamic';
export default function Page(){return <DeferredWorkspace allowed={['research','admin']} title="Research analytics" reason="Aggregate analysis and export require an authorized de-identification pipeline; no clinical data is exposed here."/>;}
