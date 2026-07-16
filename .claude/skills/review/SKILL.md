---
name: Senior Code Review
description: Self-review methodology, engineering quality standards, maintainability guidelines, production readiness checks and continuous improvement principles for a commercial-grade browser.
---

# Purpose

Writing code is only half of software engineering.

Reviewing code is equally important.

Claude should never consider implementation complete immediately after writing code.

Instead:

Implement

↓

Review

↓

Critique

↓

Improve

↓

Validate

↓

Complete

Every feature should undergo a senior engineering review before being considered finished.

---

# Mindset

Review your own work as if it were submitted by another engineer.

Be skeptical.

Look for:

- hidden bugs
- poor architecture
- unnecessary complexity
- duplicated logic
- maintainability issues
- inconsistent behaviour
- regressions
- missing edge cases

Do not assume your first implementation is your best implementation.

---

# Review Objectives

Every review should improve at least one of:

Correctness

Readability

Performance

Maintainability

Security

Accessibility

Consistency

Developer Experience

Scalability

---

# The Three Pass Review

## Pass 1 — Correctness

Verify the implementation actually solves the requested problem.

Ask:

Does this work?

Does it solve every requirement?

Did I misunderstand anything?

Are edge cases handled?

Does it break existing behaviour?

---

## Pass 2 — Engineering Quality

Review the implementation itself.

Look for:

Duplicated code

Large functions

Poor naming

Magic values

Unclear logic

Missing abstractions

Over-engineering

Tight coupling

Circular dependencies

Inconsistent patterns

Improve where necessary.

---

## Pass 3 — Polish

Review from the user's perspective.

Questions:

Does this feel complete?

Are animations smooth?

Do hover states exist?

Are loading states obvious?

Are errors handled?

Would this feel premium?

Does this match the rest of the browser?

---

# Code Readability

Every function should answer one question.

Avoid forcing readers to mentally simulate code.

Prefer explicitness over cleverness.

Future contributors should understand code quickly.

---

# Naming Review

Review every new identifier.

Names should describe intent.

Bad:

helper

manager

handler

util

thing

temp

Good:

DownloadQueue

BrowserHistoryStore

PinnedTabButton

PermissionDialog

The name should eliminate ambiguity.

---

# Function Review

Each function should:

Have one responsibility

Have predictable output

Avoid side effects where practical

Remain reasonably small

Avoid excessive nesting

Avoid boolean flag explosions

---

# Component Review

Every component should have a clear responsibility.

Avoid components that:

Fetch data

Manage complex state

Render UI

Handle IPC

Perform calculations

All inside one file.

Split responsibilities.

---

# State Review

Ask:

Is state duplicated?

Is derived state stored?

Can state ownership be simplified?

Can local state replace global state?

Can unnecessary state disappear entirely?

---

# Architecture Review

Review module placement.

Would another engineer expect this code here?

Could this module be reused?

Does it belong elsewhere?

Would future contributors find it quickly?

---

# Dependency Review

Every dependency should justify its existence.

Ask:

Can browser APIs solve this?

Can existing utilities solve this?

Is this dependency maintained?

Does it increase bundle size?

Avoid unnecessary packages.

---

# Performance Review

Review every feature for:

Render frequency

Memory allocations

Repeated calculations

Expensive effects

Heavy DOM trees

Layout thrashing

IPC frequency

Large object creation

Do not optimise blindly.

Identify measurable improvements.

---

# Security Review

Every new feature should be evaluated for security.

Review:

IPC validation

Renderer permissions

Input validation

Filesystem access

Navigation

External links

User supplied content

Never assume input is trusted.

---

# Accessibility Review

Verify:

Keyboard navigation

Focus order

Visible focus

Screen reader support

ARIA labels where required

Contrast

Reduced motion

Accessibility is not optional.

---

# UX Review

Ask:

Would this confuse users?

Is the primary action obvious?

Does every interaction provide feedback?

Is loading communicated?

Are errors understandable?

Would this feel natural in a commercial browser?

---

# Consistency Review

Review against existing UI.

Spacing

Typography

Buttons

Icons

Animations

Colours

Menus

Dialogs

Notifications

The feature should feel like it always belonged.

---

# Browser Specific Review

Verify behaviour for:

Pinned tabs

Many tabs

Small windows

Large windows

High DPI

Multiple monitors

Private sessions

Downloads

History

Bookmarks

Settings

Theme changes

The browser should remain stable.

---

# Regression Review

Ask:

Could this affect unrelated features?

Could existing users notice unexpected changes?

Did shared utilities change?

Does this modify global behaviour?

If yes:

Increase testing.

---

# Error Review

Every failure should answer:

What happened?

Why?

What should the user do?

Never expose raw stack traces.

Never silently ignore failures.

---

# Logging Review

Logs should be:

Actionable

Minimal

Useful

Remove temporary debug logging before completion.

---

# Technical Debt Review

Ask:

Did this implementation increase technical debt?

Could a future engineer understand this quickly?

Would I be happy maintaining this for two years?

If not:

Improve it.

---

# Documentation Review

New systems should include:

Clear naming

Useful comments when needed

Updated documentation where appropriate

Avoid undocumented public APIs.

---

# Testing Review

Verify:

Happy path

Edge cases

Failure cases

Keyboard behaviour

Window resizing

Dark mode

Accessibility

Regression coverage

Do not assume code works because it compiles.

---

# Pull Request Review

Imagine another senior engineer reviewing this change.

Would they ask:

Why is this here?

Can this be simpler?

Is this duplicated?

Is this tested?

Can this scale?

Resolve obvious concerns before submission.

---

# Common Review Questions

Ask yourself:

Can this be deleted entirely?

Can this be simplified?

Can existing code be reused?

Can responsibilities be separated?

Will this scale?

Would another engineer immediately understand this?

Did I leave the repository cleaner than I found it?

---

# Anti Patterns

Avoid:

Massive pull requests

Drive-by refactors

Dead code

Unused imports

Commented-out code

Magic numbers

Overly clever solutions

Excessive abstraction

Premature optimisation

Generic naming

Large unreviewed components

Untested behaviour

Ignoring accessibility

Ignoring security

Ignoring consistency

---

# Definition of Excellent

Excellent code is:

Easy to understand

Easy to modify

Easy to test

Easy to debug

Easy to review

Easy to extend

Reliable

Performant

Consistent

Secure

Accessible

---

# Final Gate

Before marking work complete, ask:

✓ Does it fully solve the request?

✓ Does it fit the existing architecture?

✓ Does it introduce unnecessary complexity?

✓ Is the implementation readable?

✓ Are names clear?

✓ Is UI polished?

✓ Is performance acceptable?

✓ Is security maintained?

✓ Is accessibility preserved?

✓ Are tests updated where needed?

✓ Would I confidently approve this in a production code review?

If any answer is "no", continue improving before considering the work complete.

---

# Gold Standard

Claude should not strive to generate code.

Claude should strive to generate code that another senior engineer would merge without significant changes.

Every completed task should leave the repository cleaner, more consistent, and easier to maintain than before.