import {useEffect,useState} from 'react';

type State={status:string;evidence_retention_due_at:string|null;evidence_hold_reason:string|null};
export function EvidenceRetention({tournamentId,csrf,version}:{tournamentId:string;csrf:string;version:number}){
  const [state,setState]=useState<State|null>(null),[reason,setReason]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const url=`/api/v1/admin/tournaments/${tournamentId}/evidence-retention`;
  useEffect(()=>{let active=true;setState(null);setMessage('');void fetch(url).then(async response=>{if(!response.ok)throw new Error();return response.json();}).then(body=>{if(active)setState(body.data);}).catch(()=>{if(active)setMessage('Could not load the evidence retention state.');});return()=>{active=false;};},[url,version]);
  async function update(action:'hold'|'release'){
    setBusy(true);setMessage('');
    try{const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({action,reason})});const body=await response.json();if(!response.ok)throw new Error(body.error?.message??'Could not update the legal hold.');setState(body.data);setReason('');setMessage(action==='hold'?'Legal hold placed. Automatic evidence deletion is paused for this event.':'Legal hold released. Expired evidence will be deleted by the daily retention job.');}
    catch(error){setMessage(error instanceof Error?error.message:'Could not update the legal hold.');}finally{setBusy(false);}
  }
  return <section className="panel"><h2>Private evidence retention</h2><p>Payment proofs, match screenshots, report screenshots and OCR text are scheduled for deletion 12 months after this event closes. Pending refund reviews and open result reports pause deletion.</p>{state&&<><p>Deletion due: {state.evidence_retention_due_at?new Date(state.evidence_retention_due_at).toLocaleString():'after the event closes'}.</p><p>Legal hold: {state.evidence_hold_reason??'none'}</p><label>{state.evidence_hold_reason?'Reason to release the legal hold':'Reason for the legal hold'}<textarea value={reason} onChange={event=>setReason(event.target.value)} minLength={10} maxLength={1000} rows={3}/></label><button type="button" className="secondary" disabled={busy||reason.trim().length<10} onClick={()=>void update(state.evidence_hold_reason?'release':'hold')}>{state.evidence_hold_reason?'Release legal hold':'Place legal hold'}</button></>}{message&&<p role="status">{message}</p>}</section>;
}
