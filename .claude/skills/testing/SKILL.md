---
name: Testing & Quality Assurance
description: Production testing standards, regression prevention, validation methodology, browser QA practices, and verification workflows for a commercial-grade browser.
---

# Purpose

Quality is proven.

Not assumed.

A feature is not complete because it compiles.

A feature is complete when it has been validated.

Testing exists to increase confidence, reduce regressions and protect future development.

Every feature should be implemented with verification in mind.

---

# Philosophy

Test behaviour.

Not implementation.

Tests should verify what users experience.

Avoid tightly coupling tests to internal implementation details.

A good test should continue passing after a refactor that preserves behaviour.

---

# Testing Priorities

Always optimise for:

1. Correctness

2. Regression prevention

3. User experience

4. Stability

5. Maintainability

6. Performance

Never skip validation because a change appears "small."

---

# Test Pyramid

Prefer:

Many unit tests

↓

Some integration tests

↓

Fewer end-to-end tests

Each level serves a purpose.

Do not rely entirely on one testing style.

---

# Unit Tests

Unit tests verify individual logic.

Good candidates:

utility functions

parsers

formatters

validators

state reducers

business logic

Avoid testing implementation details.

---

# Integration Tests

Integration tests verify systems working together.

Examples:

Renderer ↔ IPC

IPC ↔ Main Process

Settings persistence

Downloads

History

Bookmarks

Session restoration

Integration testing catches architectural mistakes.

---

# End-to-End Tests

End-to-end tests verify complete user workflows.

Examples:

Open browser

Create tab

Navigate

Download file

Bookmark page

Restart browser

Restore session

These should simulate real user behaviour.

---

# Browser Workflows

Every major feature should consider testing:

Opening tabs

Closing tabs

Pinned tabs

Multiple windows

Navigation

Refresh

Back

Forward

History

Downloads

Bookmarks

Settings

Profiles

Private browsing

Crash recovery

Window restore

Theme changes

---

# Edge Cases

Always test beyond the happy path.

Examples:

Empty state

Invalid input

Rapid clicking

Repeated actions

Slow network

Offline mode

Permission denied

Renderer crash

Window resizing

Unexpected closure

Low memory

Large datasets

Interrupted downloads

Corrupted settings

Edge cases reveal production issues.

---

# UI Verification

Verify:

Hover states

Focus states

Loading states

Error states

Empty states

Success feedback

Responsive layouts

Keyboard navigation

Animations

No visual regressions

---

# Accessibility Testing

Every feature should support:

Tab navigation

Screen readers

Visible focus

ARIA where appropriate

Reduced motion

High contrast

Zoom

Accessibility should be validated, not assumed.

---

# Performance Testing

Verify:

Large tab counts

Large bookmark collections

Large history

Long-running sessions

Memory stability

Startup time

Repeated actions

Features should remain responsive under load.

---

# Regression Testing

Whenever modifying shared systems ask:

What existing behaviour could change?

What depends on this code?

What should be retested?

Every shared change increases regression risk.

---

# Manual Testing Checklist

Before completion verify:

Feature works.

Navigation works.

Keyboard works.

Mouse works.

Window resize works.

Dark mode works.

Light mode works.

Loading behaviour works.

Errors handled correctly.

Performance acceptable.

---

# Automated Testing

Automate whenever practical.

Automation should cover:

Critical workflows

Business logic

Browser lifecycle

Settings

Navigation

Session restoration

Downloads

Automation protects future development.

---

# Test Naming

Names should explain behaviour.

Good:

restores_previous_session

opens_new_tab_when_shortcut_pressed

persists_sidebar_width

Bad:

test1

browser_test

misc

---

# Stable Tests

Tests should be deterministic.

Avoid:

Random values

Timing assumptions

Network dependency

Machine-specific behaviour

Tests should produce identical results every run.

---

# Flaky Tests

Flaky tests reduce confidence.

If a test is unreliable:

Fix it.

Do not ignore intermittent failures.

---

# Browser Scale

Validate behaviour with:

100 tabs

10,000 history entries

5,000 bookmarks

Large downloads

Long sessions

Many windows

Applications should remain reliable.

---

# Error Validation

Verify failures are:

Graceful

Recoverable

Useful

Never expose raw exceptions.

Never silently fail.

---

# Logging

Review logs during testing.

Unexpected warnings often indicate hidden problems.

Temporary debug logs should be removed.

---

# Continuous Validation

Do not wait until the end.

Verify incrementally.

Small verification reduces debugging later.

---

# Before Opening a Pull Request

Confirm:

Project builds.

Type checking passes.

Lint passes.

Tests pass.

No debug code remains.

No temporary hacks remain.

No TODOs without explanation.

No unnecessary files modified.

---

# Anti Patterns

Avoid:

Testing implementation details

Ignoring edge cases

Skipping accessibility

Ignoring performance

Relying only on manual testing

Disabling failing tests

Overusing snapshots

Fragile timing assertions

Unverified refactors

Assuming code works because it compiles

---

# Self Review

Before marking work complete ask:

Have I tested the feature?

Have I considered regressions?

Would this survive a refactor?

Could this break another browser feature?

Would I trust this in production?

If any answer is uncertain:

Continue validating.

---

# Definition of Done

A feature is considered complete only when:

✓ Behaviour is correct.

✓ Existing functionality still works.

✓ Edge cases have been considered.

✓ Accessibility is preserved.

✓ Performance remains acceptable.

✓ No regressions are introduced.

✓ Code is maintainable.

✓ Testing provides confidence.

Compilation is the beginning of verification—not the end.

---

# Gold Standard

Users should be able to rely on the browser without encountering unexpected behaviour.

Every change should increase confidence in the codebase.

The browser should become more reliable with every release.

Testing is not a final step.

Testing is an engineering mindset.