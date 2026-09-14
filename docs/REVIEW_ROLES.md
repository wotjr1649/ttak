# Local role-review contract

`scripts/review-roles.cjs` validates and reconciles two role reports.
`scripts/review-role-workflow.cjs` sequences the reports, bounded repair and full rechecks.
These are local components for the [diagnostic 47 candidate](REASSESSMENT_47.ko.md).
They have no CLI, network, file-writing, plugin-registration or permission effects.
An injected callback supplies JSON results and transport session metadata. Native execution
and factual quality were unverified at the local checkpoint. The subsequent
[native transport check](NATIVE_REVIEW_TRANSPORT.md) audited one evidence-role call per host;
native context/repair/recheck and quality qualification remain open.

The later [diagnostic 49 screen](ROLE_SCREEN_49.ko.md) stopped on its first Claude evidence-role
call: complete unit enumeration still omitted a mandatory claim. No subsequent context or repair
call was launched. This candidate is not adopted for product integration.

## Input and revision identity

`preparePacket(input)` selects `task`, `draft` and `references`. Each reference retains only
`id`, `url` and `summary`. URLs are inert text, not fetch instructions. IDs must be unique.
Operator labels, expected findings and reference metadata are not forwarded.

Nonempty strings must contain well-formed Unicode and be at most 100,000 UTF-16 code units.
The draft uses the existing 512-unit maximum. Serialized references and each serialized role
report are separately limited to 100,000 code units. Each role can report at most 512 claims.
The future native adapter must bound bytes before parsing; these checks are not a streaming
transport limit. Inputs are JSON data, not arbitrary executable JavaScript objects.

`reviewKey(packet)` is SHA-256 of the normalized packet's JSON. It binds the exact task,
draft and supplied evidence, including order. It is not a signature, session ID or proof
of independent reasoning. Changed text or evidence requires a new matching report.

## Role reports

Each report has exactly `role`, `review_key`, `units`. `role` must match the assigned
`evidence` or `context` role. Units occur exactly once, in original order, with no omissions.
Each unit has exactly `id`, `non_claim_reason`, `claims`.

If claims are present, `non_claim_reason` is the empty string. Otherwise it must contain a
nonempty explanation. This records an explicit disposition for headings or non-claim text;
the validator cannot establish that the worker correctly identified every substantive claim.

| Claim field | Evidence role | Context role |
|---|---|---|
| `quote` | Exact, uniquely located text in this unit | Same |
| `verdict` | `supported`, `contradicted`, `not_established` | `consistent`, `internal_inconsistency`, `not_established` |
| `reason` | Nonempty explanation | Nonempty explanation |
| `reference_ids` | Unique supplied IDs; at least one for supported/contradicted | Absent |
| `related` | Absent | Array of `{unit_id, quote}` links; at least one for internal inconsistency |

Related quotes must resolve uniquely in their named unit. Duplicate links and a link to
exactly the claim's own span are rejected. Repeated quote text within a unit, including
self-overlapping matches such as `aa` in `aaa`, is ambiguous; a longer unique quote is needed.
Extra fields, a foreign quote, a wrong role, an old revision and broken Unicode are rejected.

Example evidence report for a one-unit fixture with reference `R1`:

```json
{
  "role": "evidence",
  "review_key": "<reviewKey of the actual packet>",
  "units": [{
    "id": "U001",
    "non_claim_reason": "",
    "claims": [{
      "quote": "The total is five.",
      "verdict": "contradicted",
      "reference_ids": ["R1"],
      "reason": "The supplied fixture specifies a total of four."
    }]
  }]
}
```

The placeholder is illustrative and is not an accepted digest. No experiment-specific
answer keys are embedded in runtime code. Native JSON-schema delivery and general worker
prompts are supplied separately by `review-native-format.cjs`, not by this local validator.

## Reconciliation and repair

`mergeRoles(packet, evidence, context)` revalidates both reports and retains copies of both.
It returns a status, the legacy repair `review` when usable, and both original `reports`.

* An error overlapping a positive or uncertain judgment produces `conflict`.
  This is deliberately conservative even when the roles' different meanings might explain it.
* Distinct, overlapping error spans produce `overlapping_findings`.
* Any remaining `not_established` claim produces `unresolved` and no repair input.
* Identical error spans become one repair target, retaining both role reasons. The legacy
  issue kind is `contradicted` when an evidence error is present, otherwise
  `internal_inconsistency`. This classification does not select a replacement or discard
  a role's original verdict. The repair callback receives both reports.
* No errors or unresolved claims produces `reviewed`; compatible errors produce `repairable`.

These are structural rules. They do not establish semantic agreement between reasons,
source entailment, complete claim extraction or correctness of a replacement. In particular,
two negative judgments at the same span can still suggest incompatible remedies in prose;
their retained reasons require substantive assessment. Unknown conflicts are not certified away.
The existing `ReviewSession` validates the resulting legacy review; `applyPatches` enforces
unique reviewed locations, complete patches, Unicode and preservation of all other characters.

## Local orchestration

`reviewByRoles({task, draft, references, maxCalls, maxRepairs = 1, stopOnFinding = false}, invoke)`
accepts 1–128 calls and 0–2 repairs. The callback receives a detached copy of:

* `phase`: `review`, `repair` or `recheck`;
* `packet` and `review_key`;
* `role` on review/recheck calls;
* `review` and both `reports` on repair calls only.

The callback returns `{session, value}`. The transport supplies `session`; model-produced
JSON must not supply it. A missing or reused session is rejected. Local tests using distinct
strings demonstrate this check, not actual native session isolation.

Evidence precedes context. A role never receives the other role's result through this
callback payload. Two remaining calls are required before a review pass begins. Repair
requires three remaining calls: one repair and two complete rechecks, including all newly
created paragraphs. Invalid patches or worker failures propagate immediately without retry.
After a repair, the old merged report is cleared; raw earlier reports remain in `history`.

`stopOnFinding: true` is an operator-side diagnostic option for the normal control. Any
negative or uncertain claim stops immediately with `finding_stop`, before another role or
repair; the option itself is not sent to a worker. False remains the normal component default.
This component does not perform the external expected-answer adjudication or enforce the
aggregate 27-call experiment allowance; the later runner must do both before scheduling work.

Results include `status`, `text`, `report`, `history`, `calls`, `repairs` and
`workflow_complete`. Only `reviewed` sets completion true. Budget exhaustion, conflicts,
unresolved claims, finding stops and repair limits leave it false.
`factual_correctness_verified` is always false, including on completed coverage.

## Observed local checks

Node v24.19.0: 17 new tests and 28 existing session/MCP/repair/workflow tests passed,
45 total with no skips. They include changed paragraph counts, source revision binding,
mutation isolation, claim/link validation, conflict handling, both repair limits and
recheck budgets. The original MCP tests include actual local stdio processes; the new
role tests inject deterministic responses and launch no models.

```powershell
& 'C:\Program Files\nodejs\node.exe' --test --test-concurrency=1 tests/review-session.test.cjs tests/review-mcp.test.cjs tests/review-repair.test.cjs tests/review-workflow.test.cjs tests/review-roles.test.cjs
```

The existing paragraph workflow, MCP adapter, product skills and diagnostic input manifest
are unchanged. The subsequent native transport and its bounded process-tree cleanup/model
audits are recorded in [diagnostic 48](NATIVE_REVIEW_TRANSPORT.md). A complete quality-run
execution freeze and cross-host adjudication/allowance ledger still remain.
