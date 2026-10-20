import type { ReactNode } from 'react';
import { ArrowUpRight, Trophy } from 'lucide-react';

export function SiteHeader({section,actions}:{section?:'events'|'players'|'admin';actions?:ReactNode}){
  return <header className="site-header">
    <div className="site-header-inner">
      <a href="/" className="site-brand"><span className="site-brand-mark"><Trophy size={19} strokeWidth={2.4}/></span><span>NSK<span className="site-brand-light">ESPORTS</span></span></a>
      <nav className="site-nav" aria-label="Main navigation">
        <a href="/#tournaments" className={section==='events'?'active':''}>Tournaments</a>
        <a href="/participate" className={section==='players'?'active':''}>Player portal</a>
        <a href="/admin" className={section==='admin'?'active':''}>Organizer</a>
      </nav>
      <div className="site-header-actions">{actions??<a className="site-header-cta" href="/participate">Join an event <ArrowUpRight size={16}/></a>}</div>
    </div>
  </header>;
}

export function SiteFooter(){return <footer className="site-footer"><div><strong>NSK ESPORTS</strong><span>Free Fire MAX tournament operations</span></div><nav aria-label="Footer navigation"><a href="/#tournaments">Tournaments</a><a href="/participate">Player portal</a><a href="/admin">Organizer</a></nav><small>Results become official only after organizer review and publication.</small></footer>;}
