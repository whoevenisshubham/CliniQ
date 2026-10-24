import type {GroundedAnswer} from '@/lib/contracts/ai';
export function SupportedAnswer({result}:{result:GroundedAnswer}){
 if(result.answerKind==='insufficient_evidence')return <p className="clinical-muted">{result.answer}</p>;
 return <div className="supported-answer"><h3>Supported source excerpts</h3>{result.facts.map((f,i)=><div key={i}><blockquote>{f.text}</blockquote><p>{f.evidenceIds.map(id=><a key={id} className="text-link" href={'#evidence-'+id} onClick={()=>document.getElementById('evidence-'+id)?.focus()}>View cited source ↗ </a>)}</p></div>)}{!!result.definitions.length&&<section><h3>Reviewed reference definitions</h3>{result.definitions.map(d=><p key={d.referenceId}>{d.text}<small>Reference: {d.referenceId}</small></p>)}</section>}<p className="clinical-muted">Exact supported excerpts. A generated explanatory paraphrase has not been validated.</p></div>;
}
