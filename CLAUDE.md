# CLAUDE.md

> Repository Engineering Constitution
>
> This document defines how Claude should reason, explore, design, implement, refactor, review and validate code within this repository.
>
> It is intentionally opinionated.
>
> Every implementation should move the project closer to a production-quality browser.

---

# Mission

The objective of this repository is **not** to create another Electron application.

The objective is to build a browser that feels comparable in quality to professional products.

Users should notice:

- exceptional responsiveness
- polished interactions
- consistency
- stability
- reliability
- predictable behaviour

Every decision should optimise for long-term maintainability instead of short-term speed.

---

# Engineering Philosophy

Claude should behave like a principal software engineer.

Not a code generator.

Responsibilities include:

- understanding existing architecture
- identifying reusable systems
- minimising technical debt
- improving code quality
- protecting consistency
- avoiding regressions

The cheapest implementation is rarely the best implementation.

Prefer solutions that remain maintainable after years of development.

---

# Primary Objectives

When making engineering decisions, optimise in this order:

1. Correctness
2. Reliability
3. Maintainability
4. Simplicity
5. Performance
6. Developer Experience
7. Implementation Speed

Never sacrifice correctness purely to finish faster.

---

# Repository Exploration

Before modifying code:

Understand the existing implementation.

Never immediately begin coding.

Instead:

1. Locate entry point.

2. Identify feature boundaries.

3. Locate reusable components.

4. Locate shared utilities.

5. Understand data flow.

6. Understand ownership.

Only then begin implementation.

---

# Token Efficiency

Repository context is expensive.

Never scan the entire repository unless explicitly requested.

Instead:

Read only files that are directly relevant.

Expand outward following imports.

Build an internal understanding.

Avoid reopening previously inspected files.

Avoid repeatedly searching identical directories.

Summarise information internally instead of rereading it.

Read narrowly.

Think broadly.

---

# Incremental Context Loading

Preferred order:

Current file

↓

Imported utilities

↓

Shared components

↓

Feature folder

↓

Adjacent modules

↓

Global architecture

Only continue exploring if required.

Never perform unnecessary exploration.

---

# Planning

Every significant task begins with a plan.

The implementation plan should answer:

What exists already?

What must change?

Which files change?

Which systems interact?

Potential regressions?

Testing strategy?

Expected outcome?

Small fixes do not require lengthy planning.

Large architectural work always does.

---

# Before Writing Code

Ask internally:

Can existing code solve this?

Can this be extended?

Can logic be shared?

Is there already a utility?

Would another engineer expect code here?

Never duplicate existing behaviour.

---

# Modifying Existing Code

Prefer extending.

Avoid replacing.

Replacement should only occur when:

architecture is fundamentally flawed

existing implementation is unsafe

maintenance cost exceeds migration cost

Otherwise extend existing systems.

---

# Refactoring

Only refactor when:

It reduces complexity.

It improves reuse.

It improves readability.

It improves architecture.

Avoid refactoring purely for personal preference.

---

# Decision Framework

When multiple implementations exist ask:

Which is easier to understand?

Which scales better?

Which introduces fewer dependencies?

Which reduces maintenance?

Which keeps architecture consistent?

Choose that implementation.

---

# Simplicity

Simple code wins.

Simple code means:

clear names

small functions

predictable flow

minimal abstraction

Avoid clever code.

Future maintainers should understand logic quickly.

---

# Abstractions

Create abstractions only when they reduce duplication.

Avoid creating abstractions for single use cases.

Good abstractions simplify.

Bad abstractions hide complexity.

---

# Naming

Names should explain intent.

Good:

BrowserTab

SessionStore

DownloadManager

Bad:

DataHandler

Manager2

Helper

Util

Thing

Avoid generic names.

---

# File Size

Aim for focused files.

Large files become difficult to maintain.

When files exceed reasonable complexity:

Extract modules.

Avoid creating dozens of tiny files.

Find balance.

---

# Function Design

Functions should:

do one thing

have clear inputs

produce predictable outputs

avoid side effects

Small focused functions are preferred.

---

# State Ownership

State should have one owner.

Avoid duplicated state.

Avoid syncing multiple sources of truth.

Derived state should remain derived.

---

# Data Flow

Data should move predictably.

Prefer:

Parent

↓

Child

↓

Presentation

Avoid unpredictable bidirectional communication.

---

# Error Handling

Every failure should produce:

recoverable behaviour

useful logs

clear user feedback

Never silently ignore errors.

---

# Logging

Logs exist for debugging.

Logs should answer:

What happened?

Why?

Where?

Avoid noisy logging.

Remove temporary debugging logs.

---

# Comments

Code should explain itself.

Comments explain:

why

not

what.

Avoid obvious comments.

Bad:

increment counter

Good:

counter intentionally wraps after reaching session limit

---

# Dead Code

Remove:

unused imports

unused variables

unused helpers

obsolete components

commented code

Dead code increases maintenance cost.

---

# Dependencies

Adding a dependency has long-term cost.

Before installing one ask:

Can existing code solve this?

Can browser APIs solve this?

Can we implement a lightweight version?

Prefer fewer dependencies.

---

# Consistency

Consistency is more valuable than perfection.

If the repository follows a pattern:

Continue that pattern.

Avoid introducing competing styles.

---

# Technical Debt

Every implementation should reduce debt when practical.

Never knowingly introduce poor architecture for convenience.

Small improvements accumulate over time.

---

# Code Quality

Before considering work complete ask:

Is this readable?

Is this reusable?

Is this testable?

Is this scalable?

Would another engineer understand this?

If not:

Improve it.

---

# Browser Mindset

Remember:

Users interact with browsers constantly.

Tiny frustrations compound.

Milliseconds matter.

Animations matter.

Consistency matters.

Responsiveness matters.

Every interaction should feel intentional.

Never implement features that merely function.

Implement features that feel polished.

---

# Long-Term Thinking

Assume this repository will exist for many years.

Write code accordingly.

Optimise for:

future contributors

future features

future debugging

future scalability

Never optimise solely for today's task.


---

# Git Workflow

This repository follows a branch-first workflow.

Claude should never make large or risky changes directly on the default branch.

For substantial work, always create a dedicated feature branch.

Examples of substantial work include:

- new features
- UI redesigns
- architectural refactors
- dependency upgrades
- performance overhauls
- security improvements
- changes spanning multiple directories
- migrations
- large bug fixes
- renderer/main process changes
- IPC redesigns

Small changes (typos, documentation updates, minor bug fixes confined to a single area) may be committed directly if explicitly requested.

---

# Branch Naming

Use descriptive branch names.

Preferred formats:

feature/<feature-name>

fix/<issue-name>

refactor/<system>

perf/<system>

security/<system>

docs/<topic>

chore/<topic>

Examples:

feature/workspaces

feature/tab-groups

feature/download-manager

fix/history-crash

perf/startup-time

refactor/ipc-layer

security/context-isolation

Avoid generic names such as:

new

update

testing

branch1

---

# Working on Branches

For large tasks:

1. Create a feature branch.
2. Keep commits focused.
3. Avoid unrelated changes.
4. Rebase or merge from the default branch if necessary.
5. Ensure the branch builds successfully before completion.

Never mix unrelated work in a single branch.

---

# Pull Requests

When a substantial task is complete:

Always prepare a Pull Request instead of assuming the work should be merged.

The Pull Request should include:

## Summary

A concise description of the change.

## Motivation

Why the change was made.

## Implementation

High-level explanation of the approach.

## Testing

Describe how the change was verified.

## Risks

Potential regressions or areas requiring additional review.

## Checklist

- Builds successfully
- Lint passes
- Tests pass
- No known regressions
- Documentation updated if required
- Accessibility considered
- Performance considered
- Security implications reviewed

---

# Commit Standards

Commits should be logical and atomic.

One commit should represent one conceptual change.

Avoid giant "everything" commits.

Preferred commit style:

feat: add pinned tab support

fix: prevent renderer crash during download

refactor: simplify session management

perf: optimise tab rendering

docs: update browser architecture guide

security: validate IPC payloads

test: improve download integration tests

---

# Before Opening a Pull Request

Claude should verify:

- Project builds successfully.
- Existing tests continue to pass.
- New functionality is tested where appropriate.
- No unnecessary files are modified.
- Formatting is consistent.
- Linting passes.
- No debug code remains.
- No TODOs were introduced without explanation.
- Changes remain focused on the original objective.

---

# Scope Discipline

Avoid "while I'm here" changes.

If unrelated improvements are discovered:

- Note them separately.
- Do not include them in the current branch unless explicitly requested.

Each Pull Request should solve a single problem well.

---

# Definition of Ready for Review

A branch is ready for review only when:

- The implementation is complete.
- Code quality meets repository standards.
- UI has been polished.
- Performance impact has been considered.
- Security implications have been reviewed.
- The feature behaves consistently with the rest of the browser.
- Documentation has been updated where necessary.

Only then should a Pull Request be opened.