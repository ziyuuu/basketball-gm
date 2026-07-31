# P01 R1 Event Audit Remediation

## Rejected baseline

- Commit: `32861501d8df84814b18959d527fac033c659729`
- Independent decision: P01 `FAIL`
- Confirmed defect: event IDs used post-mutation calendar metrics and omitted a command-local
  sequence. Year-end events were therefore one week ahead in the ID and repeated for players of
  the same event type.

## R1 contract

Event IDs now have this deterministic shape:

```text
event-r<committedRevision>-w<absoluteWeek>-s<commandSequence>-<eventType>
```

The absolute week comes from the resolved `Week`, never from a mutable post-resolution counter.
The sequence starts at one and follows event order inside one accepted command.

The runtime also validates:

- canonical event ID structure;
- ID week against the event date;
- ID type against the event type;
- ID revision against the audit record's committed revision;
- uniqueness within one audit record and across the bounded saved audit tail;
- strictly increasing committed revisions in that tail.

## Regression evidence

- one full three-year persistent session has globally unique IDs;
- every full-run ID matches committed revision, actual week, command sequence, and type;
- the second-year settlement retains 22 distinct player lifecycle IDs after save and restore;
- a duplicate event ID supplied in a restored audit tail is rejected;
- 23/23 tests pass;
- same-seed double run has equal state and replay hashes;
- 1,000/1,000 explicit batch runs complete with zero replay mismatches or illegal terminal states.

## Compatibility decision

The replay identity changed, so the engine version is now `0.1.1-p01-r1`. The failed baseline was
never promoted and its prototype saves contain unreliable audit tails. R1 deliberately rejects
those saves instead of claiming a trustworthy migration.

## Gate boundary

This file records implementation evidence only. P00 and P01 still require independent review, and
P02 remains prohibited until both Gates pass.
