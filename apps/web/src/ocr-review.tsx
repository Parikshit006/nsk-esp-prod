import { useEffect, useState } from 'react';
type Job={status:string;attempts:number;output:{text:string;confidence:number;warning:string}|null};
export function OcrReview({evidenceId,csrf}:{evidenceId:string;csrf:string}){
  const [job,setJob]=useState<Job|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const url=`/api/v1/admin/evidence/${evidenceId}/ocr`;
  useEffect(()=>{
    let active=true;let timer:ReturnType<typeof setTimeout>|undefined;
    const load=async()=>{try{const response=await fetch(url);if(!response.ok)throw new Error('Could not load screenshot reading.');const data=await response.json();if(active){setJob(data.data);if(['Queued','Running'].includes(data.data?.status))timer=setTimeout(()=>void load(),3000);}}catch(e){if(active)setError(String(e));}};
    void load();return()=>{active=false;clearTimeout(timer);};
  },[url,busy]);
  async function queue(){setBusy(true);setError('');try{const response=await fetch(url,{method:'POST',headers:{'X-CSRF-Token':csrf}});const body=await response.json();if(!response.ok)throw new Error(body.error?.message??'Could not queue screenshot.');setJob(body.data);}catch(e){setError(e instanceof Error?e.message:'Reading failed.');}finally{setBusy(false);}}
  return <section className="panel"><h3>Screenshot reading assistant</h3><p>Compare the original with the machine reading. Names and counts may be missing or wrong; enter and confirm every result below.</p><img src={`/api/v1/admin/evidence/${evidenceId}/image`} alt="Original result evidence for manual comparison" style={{width:'100%',height:'auto'}}/>{error&&<p role="alert">{error}</p>}{!job&&<button type="button" className="secondary" disabled={busy} onClick={()=>void queue()}>Read screenshot locally</button>}{job&&<p role="status">Reading: {job.status} · attempt {job.attempts??0} of 3</p>}{job?.status==='Failed'&&<p>Automatic reading failed after bounded retries. Use the original image to enter the result manually.</p>}{job?.output&&<><p>{job.output.warning}</p><label>Machine reading (review only)<textarea readOnly rows={12} value={job.output.text||'No readable text found.'}/></label></>}</section>;
}
