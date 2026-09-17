# Source-addressed review transport

`scripts/review-anchors.cjs` lets a native worker select source ranges rather than copy quotes.
It adapts representations for the existing validators; it does not judge facts. Native transport
defaults to `verbatim`; `quoteMode: 'anchors'` explicitly selects the new path.

Each original unit is partitioned into numbered mechanical segments. A claim selects its first
and last segment IDs in that unit. The decoder takes the inclusive contiguous slice, preserving
intervening text, Unicode and line endings. The worker cannot substitute an ellipsis or its own
quote. Segments are not necessarily sentences, atomic claims or code constructs; ranges may
span several segments. The catalog is bounded at 4096 entries.

Unknown, reversed and cross-unit ranges fail. Decoded reports still pass `validateRole`, including
full ordered coverage, unique quotes, references, context links and revision identity. Uncertainty,
conflict and overlap still block repair. Repair target IDs refer only to locations from a complete
validated review with no unresolved findings. `applyPatches` retains its completeness, Unicode,
overlap and source-preservation checks. Raw addressed reports are preserved alongside accepted
decoded results; rejected historical reports are not converted or resumed.

Seven adapter tests cover preservation, invalid ranges and reports, ambiguity, uncertainty,
context links, catalog limits and repair validation. One native-format test covers closed schemas
and preservation of the legacy interface.

Diagnostic 55 used the complete draft and source packet from diagnostic 54. The first Haiku
evidence report passed source-quote validation. Its context report returned seven of fifteen
required units and failed `incomplete_anchored_report`. No repair ran. Semantic judgment errors
remained; this does not qualify a corrected explanation or installed product. Evidence is under
`.superpowers/haiku-anchors-55/`. Address validity cannot prove truth or claim completeness.
The installed TTAK skill does not yet invoke this experimental transport.
