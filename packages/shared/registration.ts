import { z } from 'zod';
export const teamInputSchema=z.object({name:z.string().trim().min(3).max(80)}).strict();
export const registrationInputSchema=z.object({team_id:z.uuid()}).strict();
export const rosterInputSchema=z.object({expected_version:z.number().int().positive(),display_name:z.string().trim().min(2).max(80),ign_raw:z.string().min(1).max(80),ign_exact:z.boolean(),game_uid:z.string().trim().max(80).nullable(),role:z.enum(['Captain','Player']),self:z.boolean()}).strict();
export const submitRegistrationSchema=z.object({expected_version:z.number().int().positive(),eligibility_note:z.string().trim().min(5).max(4000)}).strict();
