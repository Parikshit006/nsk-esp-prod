import type {Pool} from 'pg';

/** The database row is the durable once-only claim, including across app replicas. */
export async function runRoomReleaseAlerts(pool:Pool){
  const due=await pool.query<{id:string;match_id:string}>("SELECT c.id,c.match_id FROM match_credentials c JOIN matches m ON m.id=c.match_id JOIN tournaments t ON t.id=m.tournament_id WHERE c.status='Set' AND c.release_notified_at IS NULL AND c.release_at<=now() AND m.status IN ('Scheduled','Ready','InProgress') AND t.status IN ('Published','RegistrationOpen','RegistrationClosed','InProgress') ORDER BY c.release_at,c.id LIMIT 50");
  let delivered=0;
  for(const item of due.rows){
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      const match=await client.query<{tournament_id:string;match_no:number;status:string;tournament_status:string}>('SELECT m.tournament_id,m.match_no,m.status,t.status tournament_status FROM matches m JOIN tournaments t ON t.id=m.tournament_id WHERE m.id=$1 FOR UPDATE OF m',[item.match_id]);
      const credential=await client.query<{id:string}>("SELECT id FROM match_credentials WHERE id=$1 AND status='Set' AND release_notified_at IS NULL AND release_at<=now() FOR UPDATE",[item.id]);
      const row=match.rows[0];
      if(row&&credential.rows[0]&&['Scheduled','Ready','InProgress'].includes(row.status)&&['Published','RegistrationOpen','RegistrationClosed','InProgress'].includes(row.tournament_status)){
        await client.query("INSERT INTO notifications(account_id,tournament_id,title,message) SELECT DISTINCT recipient,$1,'Room details released',$2 FROM (SELECT tm.captain_id recipient FROM registrations r JOIN teams tm ON tm.id=r.team_id JOIN slots s ON s.registration_id=r.id AND s.status='Assigned' WHERE r.tournament_id=$1 AND r.status='Submitted' AND r.approval_status='Approved' AND r.slot_status='Assigned' AND r.payment_status IN ('NotRequired','Verified','Waived') AND NOT r.payment_recheck_required UNION SELECT e.account_id recipient FROM roster_entries e JOIN registrations r ON r.id=e.registration_id JOIN slots s ON s.registration_id=r.id AND s.status='Assigned' WHERE r.tournament_id=$1 AND e.status='Active' AND e.account_id IS NOT NULL AND r.status='Submitted' AND r.approval_status='Approved' AND r.slot_status='Assigned' AND r.payment_status IN ('NotRequired','Verified','Waived') AND NOT r.payment_recheck_required) eligible",[row.tournament_id,`Room details for match ${row.match_no} are available in your protected match access. Open the app to view them.`]);
        await client.query('UPDATE match_credentials SET release_notified_at=now() WHERE id=$1',[item.id]);
        delivered++;
      }
      await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  return delivered;
}

export function startRoomReleaseAlerts(pool:Pool){
  let stopped=false,pending:Promise<unknown>=Promise.resolve();
  const tick=()=>{pending=runRoomReleaseAlerts(pool).catch(()=>{process.stderr.write('Room release alert check failed.\n');}).finally(()=>{if(!stopped)timer=setTimeout(tick,15000);});};
  let timer=setTimeout(tick,1000);
  return async()=>{stopped=true;clearTimeout(timer);await pending;};
}
