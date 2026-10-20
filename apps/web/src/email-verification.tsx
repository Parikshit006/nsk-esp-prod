import {useState} from 'react';
import { SiteFooter, SiteHeader } from './site-shell.js';
import {ArrowLeft} from 'lucide-react';

export function EmailVerificationNotice({email,csrf}:{email:string;csrf:string}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 async function resend(){setBusy(true);setError('');setMessage('');try{const response=await fetch('/api/v1/auth/resend-verification',{method:'POST',headers:{'X-CSRF-Token':csrf}});const result=await response.json();if(!response.ok)throw new Error(result.error?.message??'Could not send email.');setMessage('A new verification link was sent. Check your email, then reload this page after verifying.');}catch(caught){setError(caught instanceof Error?caught.message:'Could not send email.');}finally{setBusy(false);}}
 return <section className="panel"><h2>Verify your email</h2><p>We sent a link to {email}. Verify it before changing team or match information. The link expires after 24 hours.</p>{error&&<p role="alert" className="notice error">{error}</p>}{message&&<p role="status" className="notice success">{message}</p>}<button className="secondary" disabled={busy} onClick={()=>void resend()}>Send a new verification link</button></section>;
}
export function VerifyEmailApp(){
 const [token]=useState(()=>{const value=window.location.hash.slice(1);if(value)history.replaceState(null,'','/verify-email');return value;});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[verified,setVerified]=useState(false);
 async function verify(){setBusy(true);setError('');try{const response=await fetch('/api/v1/auth/verify-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});const result=await response.json();if(!response.ok)throw new Error(result.error?.message??'Could not verify email.');setVerified(true);}catch(caught){setError(caught instanceof Error?caught.message:'Could not verify email.');}finally{setBusy(false);}}
 return <><a className="skip" href="#content">Skip to content</a><SiteHeader section="players"/><main id="content" className="participant-shell"><a className="back-link" href="/"><ArrowLeft size={16}/>All tournaments</a><section className="panel login-panel"><h1>Verify your email</h1>{error&&<p role="alert" className="notice error">{error}</p>}{verified?<p role="status">Email verified. Return to your team page and reload it to continue.</p>:token?<button className="button" disabled={busy} onClick={()=>void verify()}>Verify email address</button>:<p>This verification link is missing its token. Sign in and request a new link.</p>}<a href="/participate">Go to team page</a></section></main><SiteFooter/></>;
}
