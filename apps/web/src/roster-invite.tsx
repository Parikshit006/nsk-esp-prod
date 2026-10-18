import { useState } from 'react';
import { Link2 } from 'lucide-react';
export function RosterInvite({registrationId,entryId,csrf}:{registrationId:string;entryId:string;csrf:string}){
  const [email,setEmail]=useState('');const [url,setUrl]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  async function create(){setBusy(true);setError('');setUrl('');try{const response=await fetch(`/api/v1/registrations/${registrationId}/roster/${entryId}/invitations`,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({email})});const result=await response.json();if(!response.ok)throw new Error(result.error?.message??'Could not create invitation.');setUrl(result.data.invite_url);}catch(caught){setError(caught instanceof Error?caught.message:'Could not create invitation.');}finally{setBusy(false);}}
  return <div className="invite-form"><label>Player email<input type="email" value={email} onChange={event=>setEmail(event.target.value)} placeholder="player@example.com"/></label><button type="button" className="secondary" disabled={busy||!email.includes('@')} onClick={()=>void create()}><Link2 size={16}/>Create invite link</button>{url&&<p>Share this one-time link privately with the player: <a href={url}>{url}</a></p>}{error&&<p role="alert">{error}</p>}</div>;
}
