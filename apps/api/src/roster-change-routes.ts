import {randomUUID} from 'node:crypto';
import {Router,type Response} from 'express';
import type {Pool,PoolClient} from 'pg';
import {z} from 'zod';
import {rosterInputSchema} from '../../../packages/shared/registration.js';
import {requireAccount,requireAdmin,requireCsrf} from './auth.js';
import {notifyRegistration} from './notification-routes.js';
const uuid=z.uuid();
const requestSchema=rosterInputSchema.omit({role:true,self:true}).extend({entry_id:uuid,reason:z.string().trim().min(10).max(1000)}).strict();
const decisionSchema=z.object({approved:z.boolean(),note:z.string().trim().min(10).max(1000)}).strict();
const key=(value:string)=>value.normalize('NFKC').trim().toLocaleLowerCase('en');
function fail(res:Response,status:number,code:string,message:string){return res.status(status).json({error:{code,message,correlation_id:res.locals.correlationId}});}
async function tx<T>(pool:Pool,fn:(client:PoolClient)=>Promise<T>){const client=await pool.connect();try{await client.query('BEGIN');const value=await fn(client);await client.query('COMMIT');return value;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
async function audit(client:PoolClient,actor:string,action:string,id:string,after:unknown){await client.query('INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,after_value) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),actor,action,'roster_change_request',id,JSON.stringify(after)]);}
export function rosterChangeRouter(pool:Pool){const router=Router();
 router.get('/registrations/:id/roster-change-requests',requireAccount(pool),async(req,res)=>{if(!uuid.safeParse(req.params.id).success)return fail(res,400,'VALIDATION_FAILED','Invalid registration ID.');const owned=await pool.query('SELECT 1 FROM registrations r JOIN teams tm ON tm.id=r.team_id WHERE r.id=$1 AND tm.captain_id=$2',[req.params.id,res.locals.admin.id]);if(!owned.rowCount)return fail(res,404,'NOT_FOUND','Registration not found.');const rows=await pool.query('SELECT id,roster_entry_id,proposed_display_name,proposed_ign_raw,proposed_ign_exact,proposed_game_uid,reason,status,created_at,decision_note,decided_at FROM roster_change_requests WHERE registration_id=$1 ORDER BY created_at DESC',[req.params.id]);return res.json({data:rows.rows});});
 router.post('/registrations/:id/roster-change-requests',requireAccount(pool),requireCsrf(pool),async(req,res)=>{
  const id=uuid.safeParse(req.params.id),body=requestSchema.safeParse(req.body);if(!id.success||!body.success)return fail(res,400,'VALIDATION_FAILED','Provide a player, corrected details, current version and reason.');
  const data=await tx(pool,async client=>{
   const peek=await client.query<{tournament_id:string}>("SELECT r.tournament_id FROM registrations r JOIN teams tm ON tm.id=r.team_id WHERE r.id=$1 AND tm.captain_id=$2",[id.data,res.locals.admin.id]);if(!peek.rows[0])return 'missing' as const;
   const event=await client.query<{status:string;registration_close_at:Date}>("SELECT status,registration_close_at FROM tournaments WHERE id=$1 FOR UPDATE",[peek.rows[0].tournament_id]);
   const reg=await client.query<{version:number;status:string;approval_status:string}>("SELECT version,status,approval_status FROM registrations WHERE id=$1 FOR UPDATE",[id.data]);if(!reg.rows[0])return 'missing' as const;
   if(reg.rows[0].version!==body.data.expected_version)return 'stale' as const;
   if(!['RegistrationOpen','RegistrationClosed'].includes(event.rows[0]?.status??'')||Date.now()<event.rows[0]!.registration_close_at.getTime()||reg.rows[0].status!=='Submitted'||['Rejected','Disqualified'].includes(reg.rows[0].approval_status))return 'locked' as const;
   if((await client.query("SELECT 1 FROM tournament_rulesets WHERE tournament_id=$1 AND status='Frozen' LIMIT 1",[peek.rows[0].tournament_id])).rowCount)return 'started' as const;
   const entry=await client.query<{id:string;ign_raw:string}>("SELECT id,ign_raw FROM roster_entries WHERE registration_id=$1 AND status='Active' FOR UPDATE",[id.data]);if(!entry.rows.some(row=>row.id===body.data.entry_id))return 'entry' as const;
   if(entry.rows.some(row=>row.id!==body.data.entry_id&&key(row.ign_raw)===key(body.data.ign_raw)))return 'duplicate' as const;
   const released=await client.query("SELECT 1 FROM match_credentials c JOIN matches m ON m.id=c.match_id WHERE m.tournament_id=$1 AND c.status='Set' AND c.release_at<=now() LIMIT 1",[peek.rows[0].tournament_id]);if(released.rowCount)return 'released' as const;
   if((await client.query("SELECT 1 FROM roster_change_requests WHERE registration_id=$1 AND status='Pending'",[id.data])).rowCount)return 'pending' as const;
   const requestId=randomUUID();await client.query('INSERT INTO roster_change_requests(id,tournament_id,registration_id,roster_entry_id,expected_registration_version,proposed_display_name,proposed_ign_raw,proposed_ign_exact,proposed_game_uid,reason,requested_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[requestId,peek.rows[0].tournament_id,id.data,body.data.entry_id,body.data.expected_version,body.data.display_name,body.data.ign_raw,body.data.ign_exact,body.data.game_uid,body.data.reason,res.locals.admin.id]);
   await audit(client,res.locals.admin.id,'roster_change.requested',requestId,{registration_id:id.data,roster_entry_id:body.data.entry_id,reason:body.data.reason});return {id:requestId,status:'Pending'};
  });
  if(data==='missing'||data==='entry')return fail(res,404,'NOT_FOUND','Registration or player not found.');if(data==='stale')return fail(res,409,'STALE_VERSION','Registration changed. Reload and try again.');if(data==='locked')return fail(res,409,'NOT_ELIGIBLE','A submitted roster can be changed only after registration closes and before the event starts.');if(data==='started')return fail(res,409,'GATE_BLOCKED','A match already started; roster changes are closed.');if(data==='duplicate')return fail(res,409,'DUPLICATE','This in-game name is already on the roster.');if(data==='pending')return fail(res,409,'CONFLICT','A roster change is already waiting for a decision.');if(data==='released')return fail(res,409,'GATE_BLOCKED','Room details have been released. Rotate access before requesting a roster change.');return res.status(201).json({data});
 });
 router.get('/admin/tournaments/:id/roster-change-requests',requireAdmin(pool),async(req,res)=>{if(!uuid.safeParse(req.params.id).success)return fail(res,400,'VALIDATION_FAILED','Invalid tournament ID.');const rows=await pool.query('SELECT c.*,tm.name team_name,e.role roster_role FROM roster_change_requests c JOIN registrations r ON r.id=c.registration_id JOIN teams tm ON tm.id=r.team_id JOIN roster_entries e ON e.id=c.roster_entry_id WHERE c.tournament_id=$1 ORDER BY (c.status=$2) DESC,c.created_at DESC',[req.params.id,'Pending']);return res.json({data:rows.rows});});
 router.post('/admin/roster-change-requests/:id/decision',requireAdmin(pool),requireCsrf(pool),async(req,res)=>{
  const id=uuid.safeParse(req.params.id),body=decisionSchema.safeParse(req.body);if(!id.success||!body.success)return fail(res,400,'VALIDATION_FAILED','Choose a decision and provide a reason.');
  const data=await tx(pool,async client=>{
   const peek=await client.query<{tournament_id:string;registration_id:string}>("SELECT tournament_id,registration_id FROM roster_change_requests WHERE id=$1",[id.data]);if(!peek.rows[0])return 'missing' as const;
   const event=await client.query<{status:string}>("SELECT status FROM tournaments WHERE id=$1 FOR UPDATE",[peek.rows[0].tournament_id]);
   const reg=await client.query<{version:number;status:string;approval_status:string;captain_id:string}>("SELECT r.version,r.status,r.approval_status,tm.captain_id FROM registrations r JOIN teams tm ON tm.id=r.team_id WHERE r.id=$1 FOR UPDATE OF r",[peek.rows[0].registration_id]);
   const found=await client.query<{status:string;roster_entry_id:string;expected_registration_version:number;proposed_display_name:string;proposed_ign_raw:string;proposed_ign_exact:boolean;proposed_game_uid:string|null}>("SELECT * FROM roster_change_requests WHERE id=$1 FOR UPDATE",[id.data]);const change=found.rows[0];if(!change||change.status!=='Pending')return 'decided' as const;
   if(reg.rows[0]?.captain_id===res.locals.admin.id)return 'self' as const;
   if(body.data.approved){
    if(reg.rows[0]?.version!==change.expected_registration_version)return 'stale' as const;
    if(!['RegistrationOpen','RegistrationClosed'].includes(event.rows[0]?.status??'')||reg.rows[0]?.status!=='Submitted'||['Rejected','Disqualified'].includes(reg.rows[0]?.approval_status??''))return 'locked' as const;
    if((await client.query("SELECT 1 FROM tournament_rulesets WHERE tournament_id=$1 AND status='Frozen' LIMIT 1",[peek.rows[0].tournament_id])).rowCount)return 'started' as const;
    if((await client.query("SELECT 1 FROM match_credentials c JOIN matches m ON m.id=c.match_id WHERE m.tournament_id=$1 AND c.status='Set' AND c.release_at<=now() LIMIT 1",[peek.rows[0].tournament_id])).rowCount)return 'released' as const;
    const roster=await client.query<{id:string;role:string;ign_raw:string}>("SELECT id,role,ign_raw FROM roster_entries WHERE registration_id=$1 AND status='Active' FOR UPDATE",[peek.rows[0].registration_id]);const entry=roster.rows.find(row=>row.id===change.roster_entry_id);if(!entry)return 'entry' as const;
    if(roster.rows.some(row=>row.id!==entry.id&&key(row.ign_raw)===key(change.proposed_ign_raw)))return 'duplicate' as const;
    await client.query('UPDATE roster_invitations SET revoked_at=now() WHERE roster_entry_id=$1 AND accepted_at IS NULL AND revoked_at IS NULL',[entry.id]);
    await client.query("UPDATE roster_entries SET display_name=$1,ign_raw=$2,ign_exact=$3,game_uid=$4,account_id=CASE WHEN role='Captain' THEN account_id ELSE NULL END,ign_admin_confirmed_at=NULL,ign_admin_confirmed_by=NULL,ign_admin_note=NULL,version=version+1 WHERE id=$5",[change.proposed_display_name,change.proposed_ign_raw,change.proposed_ign_exact,change.proposed_game_uid,entry.id]);
    await client.query("UPDATE registrations SET approval_status='Unreviewed',approval_decided_by=NULL,approval_decided_at=NULL,approval_reason=NULL,eligibility_status='Pending',eligibility_reviewed_by=NULL,eligibility_reviewed_at=NULL,eligibility_review_note=NULL,version=version+1 WHERE id=$1",[peek.rows[0].registration_id]);
   }
   await client.query("UPDATE roster_change_requests SET status=$1,decided_by=$2,decided_at=now(),decision_note=$3 WHERE id=$4",[body.data.approved?'Approved':'Rejected',res.locals.admin.id,body.data.note,id.data]);
   await audit(client,res.locals.admin.id,'roster_change.decided',id.data,{approved:body.data.approved,note:body.data.note,review_required:body.data.approved});
   await notifyRegistration(client,peek.rows[0].registration_id,'Roster change reviewed',body.data.approved?'Your roster change was approved. Eligibility and team approval must be reviewed again before room access returns.':'Your roster change was declined. Open your registration for the organizer reason.');
   return {id:id.data,status:body.data.approved?'Approved':'Rejected',registration_version:(reg.rows[0]?.version??0)+(body.data.approved?1:0)};
  });
  if(data==='missing')return fail(res,404,'NOT_FOUND','Request not found.');if(data==='decided')return fail(res,409,'CONFLICT','This request is already decided.');if(data==='self')return fail(res,403,'FORBIDDEN','You cannot decide a change for your own team.');if(data==='stale')return fail(res,409,'STALE_VERSION','The registration changed. Decline this request and ask for a new one.');if(data==='locked'||data==='started')return fail(res,409,'INVALID_TRANSITION','Roster changes are closed for this event.');if(data==='released')return fail(res,409,'GATE_BLOCKED','Room details were released; a roster change cannot be approved now.');if(data==='entry')return fail(res,404,'NOT_FOUND','Roster entry not found.');if(data==='duplicate')return fail(res,409,'DUPLICATE','The proposed name duplicates a roster member.');return res.json({data});
 });
 return router;
}
