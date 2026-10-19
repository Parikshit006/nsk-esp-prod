import {useCallback,useEffect,useState} from 'react';
type Notice={id:string;tournament_id:string;tournament_name:string;title:string;message:string;created_at:string;read_at:string|null};
export function Notifications({csrf}:{csrf:string}){
  const [items,setItems]=useState<Notice[]>([]),[error,setError]=useState('');
  const load=useCallback(async()=>{try{const r=await fetch('/api/v1/me/notifications');if(!r.ok)throw new Error('Could not load notices.');setItems((await r.json()).data);setError('');}catch(e){setError(e instanceof Error?e.message:'Could not load notices.');}},[]);
  useEffect(()=>{void load();},[load]);
  async function read(id:string){const r=await fetch(`/api/v1/me/notifications/${id}/read`,{method:'POST',headers:{'X-CSRF-Token':csrf}});if(!r.ok){setError('Could not mark notice read.');return;}await load();}
  return <section className="panel"><h2>Team notices</h2><button className="secondary" onClick={()=>void load()}>Refresh notices</button>{error&&<p role="alert">{error}</p>}{items.length===0?<p>No notices yet.</p>:<ul className="item-list">{items.map(item=><li key={item.id}><div><strong>{!item.read_at&&'Unread · '}{item.title}</strong><p>{item.tournament_name}</p><p>{item.message}</p><span>{new Date(item.created_at).toLocaleString()}</span></div>{!item.read_at&&<button className="secondary" onClick={()=>void read(item.id)}>Mark read</button>}</li>)}</ul>}</section>;
}
