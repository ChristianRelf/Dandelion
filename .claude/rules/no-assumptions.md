# No Assumptions

Never assume requirements that have not been explicitly stated.

If implementation details are ambiguous:

- Investigate the existing codebase.
- Follow established patterns.
- If multiple valid implementations exist, choose the one most consistent with the repository architecture.
- If the ambiguity materially affects functionality, ask for clarification instead of guessing.

Never invent APIs, components, files, or behaviours that do not exist.

---

# Repository First

Before creating any new component, hook, utility, service, or abstraction:

1. Search the repository.
2. Look for existing implementations.
3. Extend existing systems where appropriate.
4. Only introduce new systems when no suitable solution exists.

The repository should evolve through reuse, not duplication.

---

# Production Quality Only

Never implement placeholder, mock, temporary, or incomplete solutions unless explicitly requested.

Avoid:

- TODO implementations
- fake APIs
- placeholder UI
- hardcoded values
- stub logic
- unfinished components

Every implementation should be production-ready and fully integrated.

---

# Preserve Existing Quality

When modifying existing code:

Do not unintentionally reduce:

- performance
- accessibility
- responsiveness
- maintainability
- security
- code consistency

Every change should leave the repository in an equal or better state.

---

# Root Cause First

Never patch symptoms.

Identify and resolve the underlying cause.

Avoid:

- unnecessary conditionals
- duplicate validation
- workaround logic
- defensive code hiding architectural issues

Fix the system, not the symptom.

---

# Minimise Change Surface

Implement the smallest change that fully solves the problem.

Avoid unnecessary refactors.

Avoid unrelated formatting changes.

Avoid touching files unrelated to the task.

Small, focused changes reduce regression risk.

---

# Consistency Over Preference

Personal coding preferences should never override repository conventions.

If multiple styles exist:

Prefer the style already established in nearby code.

The repository should feel as though it was written by one engineering team.

---

# Finish Completely

A task is not complete until all affected areas have been reviewed.

Review for:

- edge cases
- loading states
- error handling
- accessibility
- responsive behaviour
- keyboard support
- performance
- visual consistency

Do not stop after making the feature "work."

Complete the feature to production quality.

---

# Leave It Better

Whenever modifying existing code:

If a small improvement can be made safely without increasing scope, make it.

Examples:

- remove dead code
- improve naming
- simplify logic
- improve type safety
- remove duplication
- improve comments
- improve accessibility

Do not perform unrelated refactors, but always leave touched code cleaner than it was found.

---

# Think Before Coding

For every non-trivial task:

Think through the implementation before writing code.

Consider:

- architecture
- scalability
- security
- performance
- maintainability
- future extensibility

Optimise for the implementation that will still be correct years from now, not just the quickest implementation today.