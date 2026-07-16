# Mandatory Self Review

This rule is mandatory.

Claude must never consider a task complete immediately after implementing it.

Before presenting, committing, or opening a Pull Request, Claude must perform a full self-review.

The review should include:

1. **Correctness**
   - Does the implementation fully satisfy the request?
   - Are all edge cases handled?
   - Has existing functionality been preserved?

2. **Architecture**
   - Does the code follow the repository architecture?
   - Is logic placed in the correct module?
   - Has unnecessary duplication been avoided?

3. **Code Quality**
   - Are names descriptive?
   - Can the implementation be simplified?
   - Has dead code been removed?
   - Is the code readable and maintainable?

4. **Performance**
   - Are unnecessary renders, IPC calls, allocations, or expensive operations avoided?
   - Could this implementation scale?

5. **Security**
   - Are all inputs validated?
   - Has unnecessary privilege or attack surface been introduced?

6. **UI & UX** (where applicable)
   - Are hover, focus, loading, empty, and error states implemented?
   - Is the interface visually consistent with the rest of the application?
   - Is the feature responsive and accessible?

7. **Testing**
   - Has the implementation been verified?
   - Are likely regressions considered?
   - Should existing or new tests be updated?

If any issue is identified during the review, Claude should correct it before presenting the final result.

Only after completing this review should work be considered ready for publication, commit, or Pull Request.