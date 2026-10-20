import {useEffect,useState} from 'react';

type Provider='google'|'discord';
export function useSocialProviders(){
  const [providers,setProviders]=useState<Provider[]>([]);
  useEffect(()=>{let active=true;void fetch('/api/v1/auth/oauth/providers').then(async response=>{if(response.ok&&active)setProviders((await response.json()).data.providers as Provider[]);}).catch(()=>{});return()=>{active=false;};},[]);
  return providers;
}
export function SocialSignIn({role,returnTo}:{role:'captain'|'member';returnTo:'participate'|'join'|'admin'}){
  const providers=useSocialProviders();
  if(!providers.length)return null;
  function rememberInvitation(){if(returnTo==='join'&&window.location.hash)sessionStorage.setItem('esp_pending_join_token',window.location.hash.slice(1));}
  return <div className="stack"><p>Or continue with</p>{providers.map(provider=><a key={provider} className="secondary" href={`/api/v1/auth/oauth/${provider}/start?role=${role}&return_to=${returnTo}`} onClick={rememberInvitation}>Continue with {provider==='google'?'Google':'Discord'}</a>)}{returnTo==='admin'&&<p>Connect a provider from Account security after your first password sign-in.</p>}</div>;
}
export function OAuthNotice(){
  const status=new URLSearchParams(window.location.search).get('oauth');
  if(!status)return null;
  return <p role="status" className={status==='failed'?'notice error':'notice success'}>{status==='failed'?'Provider sign-in could not be completed. If this email already has an account, sign in with your password and connect the provider under Account security.':status==='linked'?'Provider connected to this account.':'Provider sign-in completed.'}</p>;
}
