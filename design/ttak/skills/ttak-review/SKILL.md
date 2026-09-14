---
name: ttak-review
description: "Review code or a design for unnecessary complexity. Use when the user asks what can be simplified, reused, or removed."
license: MIT
---

# Review necessary complexity

Find simplifications justified by current requirements and actual use. Read the supplied change and the relevant callers or constraints; a description-only review rests on the supplied premises.

Consider duplication, unused flexibility, and existing project, library, or platform capabilities. Judge an alternative by the behavior it preserves and the maintenance it removes, rather than line count alone. A compatibility layer, public extension point, or safeguard can earn its complexity through a real requirement.

For a supported finding, identify its location, present cost, smaller alternative, and behavior to preserve. Keep directly observed correctness or safety blockers visible when they invalidate a proposed simplification. If nothing warrants removal, say so within the inspected scope.

A review returns findings. When fixes are also requested, make the scoped change and check the affected behavior using the project's existing means.
