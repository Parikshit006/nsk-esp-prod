import {useState,type FormEvent} from 'react';
import {useSocialProviders} from './social-auth.js';
export function AccountSecurity({csrf,onChanged}:{csrf:string;onChanged:()=>void}){
 const [current,setCurrent]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const providers=useSocialProviders();
 async function save(e:FormEvent){e.preventDefault();if(password!==confirm){setError('New passwords do not match.');return;}setBusy(true);setError('');try{const r=await fetch('/api/v1/auth/change-password',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({current_password:current,new_password:password})});const data=await r.json();if(!r.ok)throw new Error(data.error?.message??'Could not change password.');setCurrent('');setPassword('');setConfirm('');onChanged();}catch(e){setError(e instanceof Error?e.message:'Could not change password.');}finally{setBusy(false);}}
 async function connect(provider:'google'|'discord'){
   setBusy(true);setError('');
   try{
     const path=window.location.pathname,returnTo=path.startsWith('/admin')?'admin':path.startsWith('/join')?'join':'participate';
     if(returnTo==='join'&&window.location.hash)sessionStorage.setItem('esp_pending_join_token',window.location.hash.slice(1));
     const response=await fetch(`/api/v1/auth/oauth/${provider}/link?return_to=${returnTo}`,{method:'POST',headers:{'X-CSRF-Token':csrf}});
     const body=await response.json();if(!response.ok)throw new Error(body.error?.message??'Could not connect provider.');
     window.location.assign(body.data.authorization_url);
   }catch(caught){setError(caught instanceof Error?caught.message:'Could not connect provider.');setBusy(false);}
 }
 return <section className="panel"><details><summary>Account security</summary><h2>Change password</h2><p>Changing your password signs you out on every device. If you created this account with Google or Discord, use <a href="/reset-password">Forgot your password</a> to create a password first.</p>{error&&<p role="alert">{error}</p>}<form className="stack" onSubmit={e=>void save(e)}><label>Current password<input required type="password" autoComplete="current-password" value={current} onChange={e=>setCurrent(e.target.value)}/></label><label>New password<input required type="password" autoComplete="new-password" minLength={12} maxLength={1024} value={password} onChange={e=>setPassword(e.target.value)}/></label><label>Confirm new password<input required type="password" autoComplete="new-password" minLength={12} maxLength={1024} value={confirm} onChange={e=>setConfirm(e.target.value)}/></label><button className="button" disabled={busy}>Change password and sign out</button></form>{providers.length>0&&<><h2>Connected sign-in</h2><p>Connect a provider whose verified email matches this account. You can then use it to sign in.</p><div className="action-row">{providers.map(provider=><button type="button" className="secondary" key={provider} disabled={busy} onClick={()=>void connect(provider)}>Connect {provider==='google'?'Google':'Discord'}</button>)}</div></>}</details></section>;
}
