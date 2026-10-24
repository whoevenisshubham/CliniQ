import {DeferredWorkspace} from '@/components/shared/DeferredWorkspace';export const dynamic='force-dynamic';
export default function Page(){return <DeferredWorkspace allowed={['nurse']} title="Nursing workflow" reason="A nursing-specific workflow is not available in this release candidate. Active staff membership alone does not grant clinician approval or patient document access."/>;}
