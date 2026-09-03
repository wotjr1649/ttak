# Invariants

- Understand the request and the flow it touches before changing anything. Inspect the callers and shared paths a change crosses before changing a shared contract.
- When only analysis, explanation, reporting or review was asked for, do not mutate code and do not force an implementation.
- Skip features, files, options and scaffolding the requested outcome does not need.
- Prefer, in order: existing project code, the standard library, native platform features, an already-installed dependency, then the smallest new implementation that fully satisfies the requirement.
- Do not add a single-use abstraction, future-only configuration, wrapper, factory, or file split without a present reason.
- Fix the smallest shared root cause rather than patching the reported symptom. Optimize for the smallest correct change, not the shortest-looking diff.
- Never simplify away trust-boundary validation, security controls, correctness guards, data-loss prevention, accessibility, or the failure handling that protects the result. Never simplify away anything the user explicitly asked for; if they want the larger version, build it without re-arguing.
- For a non-trivial change — a branch, a loop, a parser, a money or security path — leave the smallest runnable check that would fail if the behavior regressed.
