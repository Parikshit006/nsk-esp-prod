import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowLeft, ArrowRight, CalendarDays, CircleHelp, ClipboardCheck, ShieldCheck, Swords, Trophy, Users, WifiOff } from 'lucide-react';
import { publicConfigSchema, type PublicConfig } from '../../../packages/shared/contracts.js';
import { AdminApp } from './admin.js';
import { PublicTournamentList, PublicTournamentPage } from './public-tournaments.js';
import { ParticipantApp } from './participant.js';
import { JoinApp } from './join.js';
import { RecoveryApp } from './recovery.js';
import { VerifyEmailApp } from './email-verification.js';
import { SiteFooter, SiteHeader } from './site-shell.js';
import './styles.css';
import './experience.css';

const systemPages:Record<string,{title:string;body:string}>={
  '/403':{title:"You don't have access to this page.",body:'Return to the platform overview to find an available page.'},
  '/404':{title:"We couldn't find that page.",body:'Check the address or return to the platform overview.'},
  '/500':{title:"We couldn't confirm your last action.",body:'Check the relevant page before trying again. If this continues, contact your organizer.'},
  '/session-expired':{title:'Your session ended.',body:'Sign in again to continue.'},
  '/maintenance':{title:'The platform is being prepared.',body:'Tournament registration and results are temporarily unavailable.'}
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
    <SiteHeader section="events"/>
    <main id="content">{system?<section className="system-page"><span className="large-icon"><CircleHelp size={32}/></span><p className="eyebrow">NSK Esports</p><h1>{system.title}</h1><p>{system.body}</p><a className="button" href="/"><ArrowLeft size={18}/>Return to overview</a></section>:<>
      <section className="arena-hero"><div className="arena-hero-inner"><div className="arena-hero-copy"><p className="eyebrow"><span className="rule"/> College Free Fire MAX tournaments</p><h1>YOUR SQUAD.<br/>YOUR <span>ARENA.</span></h1><p>Find an event, register your squad and follow verified results from the first drop to the final podium.</p><div className="arena-hero-actions"><a href="#tournaments" className="button light">Explore tournaments <ArrowRight size={18}/></a><a href="/participate" className="arena-text-link">Player sign-in <ArrowRight size={17}/></a></div><div className="arena-hero-meta"><span><Users size={17}/> Squad registration</span><span><ShieldCheck size={17}/> Organizer-verified scores</span></div></div><div className="arena-hero-feature" aria-label="Tournament journey"><div className="arena-feature-top"><span>THE ROAD TO THE PODIUM</span><Trophy size={24}/></div><div className="arena-feature-center"><span className="arena-feature-number">12</span><span>TEAMS<br/>ONE LOBBY</span></div><div className="arena-feature-steps"><span><strong>01</strong> Register</span><span><strong>02</strong> Compete</span><span><strong>03</strong> Rise</span></div><p>Event capacity and team size are set by each organizer. A typical full lobby has 12 squads of 4.</p></div></div></section>
      <section className="arena-strip" aria-label="How it works"><div><Users size={19}/><span><strong>Build your squad</strong>Invite and link your players</span></div><div><CalendarDays size={19}/><span><strong>Join an event</strong>Follow its rules and schedule</span></div><div><ClipboardCheck size={19}/><span><strong>Track results</strong>See published standings</span></div></section>
      <section id="tournaments" className="content-section arena-events"><div className="section-heading"><div><p className="eyebrow">Find your next match</p><h2>Tournaments</h2><p>Browse published events, check the details and register while places are open.</p></div><a href="/participate" className="secondary arena-inline-link">My team <ArrowRight size={17}/></a></div><PublicTournamentList/></section>
      <section className="content-section arena-how"><div><p className="eyebrow">Built for fair play</p><h2>Every point has a path.</h2><p>Organizers choose each event's scoring rules. Result screenshots help fill the draft, then an organizer checks every team before the leaderboard changes.</p><a href="/admin" className="arena-inline-link">Organizer workspace <ArrowRight size={17}/></a></div><div className="arena-how-grid"><article><Swords size={22}/><strong>Play the match</strong><span>Teams compete with their approved roster and assigned slot.</span></article><article><ClipboardCheck size={22}/><strong>Review the evidence</strong><span>Visible screenshot rows are assisted; unclear and hidden results are entered manually.</span></article><article><Trophy size={22}/><strong>Publish standings</strong><span>Verified scores and the final podium are released by an organizer.</span></article></div></section>
      <div className="arena-health" role="status">{error?<><span>Platform connection unavailable. Check your connection and try again.</span><button onClick={()=>setAttempt(n=>n+1)} className="secondary">Try again</button></>:config?<><ShieldCheck size={17}/><span>Configuration loaded</span></>:<span>Checking platform configuration…</span>}</div>
    </>}</main><SiteFooter/>
  </>;
}
const eventId=window.location.pathname.match(/^\/tournaments\/([0-9a-f-]{36})$/)?.[1];
createRoot(document.getElementById('root')!).render(window.location.pathname==='/verify-email'?<VerifyEmailApp/>:window.location.pathname==='/reset-password'?<RecoveryApp/>:window.location.pathname==='/admin'?<AdminApp/>:window.location.pathname==='/participate'?<ParticipantApp/>:window.location.pathname==='/join'?<JoinApp/>:eventId?<PublicTournamentPage id={eventId}/>:<React.StrictMode><App/></React.StrictMode>);
