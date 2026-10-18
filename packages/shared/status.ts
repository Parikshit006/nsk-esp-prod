/** Stored names follow problem.md; display labels follow design.md §10.3. */
export const statuses = {
  tournament: { Draft:'Draft', Published:'Published', RegistrationOpen:'Registration open', RegistrationClosed:'Registration closed', InProgress:'In progress', Finalizing:'Finalizing', Completed:'Completed', Archived:'Archived', Cancelled:'Cancelled' },
  registration: { Draft:'Draft', Submitted:'Submitted', NeedsCorrection:'Needs correction', Withdrawn:'Withdrawn', Cancelled:'Cancelled' },
  payment: { NotRequired:'Not required', Pending:'Pending', ProofSubmitted:'Proof submitted', Verified:'Verified', Rejected:'Rejected', Waived:'Waived' },
  approval: { Unreviewed:'Unreviewed', Approved:'Approved', Rejected:'Rejected', Waitlisted:'Waitlisted', Disqualified:'Disqualified' },
  slot: { Unassigned:'Unassigned', Assigned:'Assigned', Released:'Released' },
  match: { Scheduled:'Scheduled', Ready:'Ready', InProgress:'In progress', AwaitingEvidence:'Awaiting evidence', ResultProcessing:'Processing', UnderReview:'Under review', Verified:'Verified', Published:'Published', Corrected:'Corrected', Delayed:'Delayed', Rescheduled:'Rescheduled', Interrupted:'Interrupted', Restarted:'Restarted', Cancelled:'Cancelled' },
  job: { Queued:'Queued', Running:'Running', Succeeded:'Draft ready', PartiallySucceeded:'Partially read', Failed:'Failed', TimedOut:'Timed out', Retrying:'Retrying', Cancelled:'Cancelled', Superseded:'Superseded' },
  identity: { Unmatched:'Unmatched', Suggested:'Suggested', Confirmed:'Confirmed', Overridden:'Overridden', Rejected:'Rejected', Ambiguous:'Ambiguous', Collision:'Roster collision', Unreadable:'Unreadable', UnknownPlayer:'Not on roster', Ignored:'Ignored' },
  result: { Draft:'Draft', InReview:'In review', Verified:'Verified', Published:'Published', Superseded:'Superseded', Voided:'Voided' },
  credentials: { NotSet:'Not set', Set:'Set', Released:'Released', Superseded:'Superseded', Revoked:'Revoked' },
  dispute: { Open:'Open', UnderInvestigation:'Under investigation', Upheld:'Upheld', Rejected:'Rejected', Withdrawn:'Withdrawn', Closed:'Closed' }
} as const;
export function statusLabel(domain: keyof typeof statuses, state: string): string {
  const labels: Record<string,string> = statuses[domain];
  if (!Object.hasOwn(labels, state)) throw new Error('Unknown status');
  return labels[state]!;
}
