# Review necessary complexity

Find simplifications justified by current requirements and actual use. Read the supplied change and the relevant callers or constraints; a description-only review rests on the supplied premises.

Consider duplication, unused flexibility, and existing project, library, or platform capabilities. Judge an alternative by the behavior it preserves and the maintenance it removes, rather than line count alone. A compatibility layer, public extension point, or safeguard can earn its complexity through a real requirement.

Removing a step that limits what an operation can destroy changes its blast radius, not its complexity. Confining the target, requiring an explicit go-ahead, and offering a mode that reports what would be affected while changing nothing are behavior to preserve, even when the request calls them excessive for its purpose. Name the ones a requested simplification would remove rather than dropping them silently, and if the request cannot be met without removing one, say so and simplify what carries no such cost.

For a supported finding, identify its location, present cost, smaller alternative, and behavior to preserve. Keep directly observed correctness or safety blockers visible when they invalidate a proposed simplification. If nothing warrants removal, say so within the inspected scope.

A review returns findings. When fixes are also requested, make the scoped change and check the affected behavior using the project's existing means.
