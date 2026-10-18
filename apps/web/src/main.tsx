import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowLeft, ArrowRight, Check, CircleHelp, LockKeyhole, ShieldCheck, Trophy, WifiOff } from 'lucide-react';
import { publicConfigSchema, type PublicConfig } from '../../../packages/shared/contracts.js';
import './styles.css';

const systemPages:Record<string,{title:string;body:string}>={
  '/403':{title:"You don't have access to this page.",body:'Return to the platform overview to find an available page.'},
  '/404':{title:"We couldn't find that page.",body:'Check the address or return to the platform overview.'},
  '/500':{title:"We couldn't confirm your last action.",body:'Check the relevant page before trying again. If this continues, contact your organizer.'},
  '/session-expired':{title:'Your session ended.',body:'Sign-in will be available when account setup is complete. No account actions are available in this foundation preview.'},
  '/maintenance':{title:'The platform is being prepared.',body:'Tournament registration and results are not available yet. No maintenance end time has been announced.'}
};
function App(){
  const [config,setConfig]=useState<PublicConfig>();
  const [error,setError]=useState(false);
  const [offline,setOffline]=useState(!navigator.onLine);
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{const online=()=>setOffline(false), off=()=>setOffline(true); window.addEventListener('online',online);window.addEventListener('offline',off);return()=>{window.removeEventListener('online',online);window.removeEventListener('offline',off);};},[]);
  useEffect(()=>{
    const controller=new AbortController();let active=true;
    const timer=setTimeout(()=>controller.abort(),10000);
    setError(false);
    fetch('/api/v1/meta/config',{signal:controller.signal}).then(async response=>{if(!response.ok) throw new Error(); const value=await response.json(); return publicConfigSchema.parse(value.data);}).then(value=>{if(active)setConfig(value);}).catch(()=>{if(active)setError(true);}).finally(()=>clearTimeout(timer));
    return()=>{active=false;clearTimeout(timer);controller.abort();};
  },[attempt]);
  const path=window.location.pathname;
  const system=path==='/'?undefined:systemPages[path]??systemPages['/404'];
  return <><a className="skip" href="#content">Skip to content</a>
    {offline&&<div className="connection" role="alert"><WifiOff size={20}/>You're offline. Information may be out of date.</div>}
    <header className="topbar"><a href="/" className="wordmark"><span className="mark"><Trophy size={20}/></span>TOURNAMENT<span className="wordmark-light">OPERATIONS</span></a><span className="preview-label">Foundation preview</span></header>
    <main id="content">{system?<section className="system-page"><span className="large-icon"><CircleHelp size={32}/></span><p className="eyebrow">Tournament operations</p><h1>{system.title}</h1><p>{system.body}</p><a className="button" href="/"><ArrowLeft size={18}/>Return to overview</a></section>:<>
      <section className="hero"><div className="hero-inner"><div><p className="eyebrow"><span className="rule"/>College Free Fire MAX</p><h1>Every match.<br/>Every decision.<br/><span>Accounted for.</span></h1><p className="hero-copy">A clear path from team registration to official results. Built around evidence, human review, and scores you can trace.</p><a href="#readiness" className="button light">View platform readiness<ArrowRight size={18}/></a></div><div className="evidence-ladder" aria-label="Required result workflow"><p className="eyebrow">The path to official results</p>{['Evidence','Draft','Verified','Published'].map((label,index)=><div className="ladder-row" key={label}><span className="ladder-number">0{index+1}</span><span>{label}<small>{['Preserve the original screenshot','Read, map, and flag uncertainty','A human checks the complete result','Release the official standings'][index]}</small></span>{index===3?<ShieldCheck size={24}/>:<ArrowRight size={20}/>}</div>)}<p className="ladder-note">Verification and publication are separate decisions.</p></div></div></section>
      <section id="readiness" className="content-section"><div className="section-heading"><div><p className="eyebrow">A reliable foundation</p><h2>Know what is ready.</h2></div><span className="status"><LockKeyhole size={16}/>Not open for registration</span></div><div className="readiness-grid"><article className="panel"><div className="panel-icon"><ShieldCheck/></div><h3>Connected to the platform</h3>{error?<div role="alert"><p>We couldn't reach the platform. Check your connection and try again.</p><button onClick={()=>setAttempt(n=>n+1)} className="secondary">Try again</button></div>:config?<><p>The configuration service is responding. Tournament workflows are still being built.</p><div className="connection-status" role="status"><Check size={16}/>Configuration loaded</div></>:<div aria-busy="true" role="status"><p>Checking platform configuration…</p><div className="skeleton"/></div>}</article><article className="panel"><div className="panel-icon"><Trophy/></div><h3>No tournaments published yet</h3><p>Event discovery, registration, and standings will become available as their complete workflows are verified.</p><p className="subtle">No illustrative teams or scores are shown as real results.</p></article></div></section>
      <section className="content-section principles"><p className="eyebrow">Designed for match day</p><h2>Clear states. Deliberate decisions.</h2><div className="principle-grid">{[['01','Payment is not approval','Payment review, team approval, and slot assignment each have their own checks.'],['02','Uncertainty stays visible','An unclear name or missing statistic needs a decision before a result can be verified.'],['03','History stays intact','Corrections create a new version. The original evidence and earlier results stay traceable.']].map(([n,title,body])=><article key={n}><span className="principle-number">{n}</span><h3>{title}</h3><p>{body}</p></article>)}</div></section>
    </>}</main><footer><span>Tournament operations</span><span>Evidence → Review → Official results</span><span>Development · not a live event service</span></footer>
  </>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
