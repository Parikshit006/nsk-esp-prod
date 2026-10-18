import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { LockKeyhole } from 'lucide-react';

type Match={id:string;match_no:number;map:string;version:number;status:string};
type Credential={id:string;version_no:number;release_at:string;status:string;created_at:string};

export function CredentialSetup({tournamentId,csrf}:{tournamentId:string;csrf:string}){
  const [matches,setMatches]=useState<Match[]>([]);
  const [matchId,setMatchId]=useState('');
  const [history,setHistory]=useState<Credential[]>([]);
  const [roomId,setRoomId]=useState('');
  const [password,setPassword]=useState('');
  const [releaseAt,setReleaseAt]=useState('');
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const load=useCallback(async()=>{
    const response=await fetch(`/api/v1/admin/tournaments/${tournamentId}`,{credentials:'same-origin'});
    if(!response.ok)throw new Error('Could not load matches.');
    const data=(await response.json()).data as {matches:Match[]};
    setMatches(data.matches);
    setMatchId(current=>data.matches.some(match=>match.id===current)?current:data.matches[0]?.id??'');
  },[tournamentId]);
  useEffect(()=>{void load().catch(()=>setError('Could not load matches.'));},[load]);
  useEffect(()=>{if(!matchId){setHistory([]);return;}let live=true;fetch(`/api/v1/admin/matches/${matchId}/credentials`,{credentials:'same-origin'}).then(async response=>{if(!response.ok)throw new Error();return (await response.json()).data as Credential[];}).then(data=>{if(live)setHistory(data);}).catch(()=>{if(live)setError('Could not load credential history.');});return()=>{live=false;};},[matchId]);
  async function save(event:FormEvent){event.preventDefault();const match=matches.find(item=>item.id===matchId);if(!match)return;setBusy(true);setError('');setMessage('');try{
    const response=await fetch(`/api/v1/admin/matches/${matchId}/credentials`,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({expected_version:match.version,room_id:roomId,password,release_at:releaseAt})});
    const result=await response.json();if(!response.ok)throw new Error(result.error?.message??'Could not save room details.');
    setRoomId('');setPassword('');setMessage(`Room details saved as version ${result.data.version_no}. Earlier details are no longer active.`);
    await load();const records=await fetch(`/api/v1/admin/matches/${matchId}/credentials`,{credentials:'same-origin'});if(records.ok)setHistory((await records.json()).data);
  }catch(caught){setError(caught instanceof Error?caught.message:'Could not save room details.');}finally{setBusy(false);}}
  return <section className="panel credential-setup"><LockKeyhole className="panel-icon"/><h2>Private room details</h2><p>Set the room ID, password and release time for each match. A new save rotates the previous version. Saved secrets are not shown in this admin view.</p>{error&&<div className="notice error" role="alert">{error}</div>}{message&&<div className="notice success" role="status">{message}</div>}{matches.length===0?<p className="empty">Add a match to set its room details.</p>:<form className="stack" onSubmit={event=>void save(event)}><label>Match<select value={matchId} onChange={event=>{setMatchId(event.target.value);setMessage('');}}>{matches.map(match=><option key={match.id} value={match.id}>Match {match.match_no} · {match.map} · {match.status}</option>)}</select></label><div className="form-grid"><label>Room ID<input required minLength={2} maxLength={120} autoComplete="off" value={roomId} onChange={event=>setRoomId(event.target.value)}/></label><label>Room password<input required minLength={2} maxLength={120} autoComplete="off" value={password} onChange={event=>setPassword(event.target.value)}/></label></div><label>Release at, with time-zone offset<input required placeholder="2026-10-19T15:00:00+05:30" value={releaseAt} onChange={event=>setReleaseAt(event.target.value)}/></label><button className="button" disabled={busy||!matchId}>Save room details</button></form>}{history.length>0&&<><h3>Version history</h3><ul className="item-list">{history.map(record=><li key={record.id}><div><strong>Version {record.version_no} · {record.status}</strong><span>Release {new Date(record.release_at).toLocaleString('en-IN')}</span></div></li>)}</ul></>}</section>;
}
