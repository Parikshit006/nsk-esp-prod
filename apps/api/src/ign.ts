import type {Pool,PoolClient} from 'pg';

export const IGN_ALGORITHM_VERSION='unicode-1';
export function ignForms(raw:string){
  const match_key=raw.normalize('NFKC').trim().replace(/\s+/gu,' ').toLocaleLowerCase('en');
  const skeleton_key=match_key.normalize('NFKD').replace(/\p{M}/gu,'').replace(/[\p{P}\p{S}\p{Z}\p{C}]/gu,'').toLocaleLowerCase('en');
  return {match_key,skeleton_key};
}
export async function recordIgnForms(client:PoolClient,entryId:string,version:number,raw:string){
  const forms=ignForms(raw);
  await client.query('INSERT INTO roster_ign_derivations(roster_entry_id,roster_version,algorithm_version,raw_value,match_key,skeleton_key) VALUES($1,$2,$3,$4,$5,$6)',[entryId,version,IGN_ALGORITHM_VERSION,raw,forms.match_key,forms.skeleton_key]);
}
export async function backfillIgnForms(client:PoolClient){
  const rows=await client.query<{id:string;version:number;ign_raw:string}>('SELECT e.id,e.version,e.ign_raw FROM roster_entries e WHERE NOT EXISTS (SELECT 1 FROM roster_ign_derivations d WHERE d.roster_entry_id=e.id AND d.roster_version=e.version) ORDER BY e.id');
  for(const row of rows.rows)await recordIgnForms(client,row.id,row.version,row.ign_raw);
}
export async function possibleIgnCollision(client:Pool|PoolClient,tournamentId:string,registrationId:string,raw:string){
  const candidate=ignForms(raw).skeleton_key;if(!candidate)return false;
  const rows=await client.query<{ign_raw:string}>("SELECT e.ign_raw FROM roster_entries e JOIN registrations r ON r.id=e.registration_id WHERE e.tournament_id=$1 AND e.registration_id<>$2 AND e.status='Active' AND r.status NOT IN ('Withdrawn','Cancelled')",[tournamentId,registrationId]);
  return rows.rows.some(row=>ignForms(row.ign_raw).skeleton_key===candidate);
}
