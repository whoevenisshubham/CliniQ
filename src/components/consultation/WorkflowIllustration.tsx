import { FileText, Check, ArrowRight, LockKeyhole } from 'lucide-react';
export function WorkflowIllustration() {
    return <figure className="journey-preview" aria-label="Illustration of the implemented manual consultation journey">
 <div className="journey-window"><span className="journey-window-dots" aria-hidden="true">● ● ●</span><span>CLINIQ+ / consultation</span><span className="journey-draft">Draft</span></div>
 <div className="journey-body"><aside><p className="eyebrow">Context</p><div className="journey-source"><FileText size={22}/><strong>Earlier visit note</strong><span>Private original · page 1</span><svg viewBox="0 0 100 70" aria-hidden="true"><path d="M12 12h58M12 23h76M12 34h67M12 45h72M12 56h43" fill="none" stroke="currentColor" strokeWidth="3"/></svg></div></aside>
 <div className="journey-findings"><p className="eyebrow">Typed conversation</p><blockquote>“बुखार नहीं है। No fever reported.”</blockquote><div className="journey-connector" aria-hidden="true">↓</div><div className="journey-field"><span>Clinician findings</span><strong>Review of the earlier note</strong><p>Original wording and source stay close.</p><span className="journey-review"><Check size={13}/> Review required before approval</span></div></div></div>
 <div className="journey-flow"><span>Save draft</span><ArrowRight size={14}/><span>Review revision</span><ArrowRight size={14}/><span><LockKeyhole size={12}/> Approved record</span></div>
 <figcaption>Workflow illustration · synthetic text · speech and generation unavailable</figcaption>
 </figure>;
}
