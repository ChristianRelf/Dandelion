---
name: Debugging & Root Cause Analysis
description: Systematic debugging methodology, issue isolation, regression analysis, logging practices, diagnostics, and production incident resolution for a commercial-grade browser.
---

# Purpose

Debugging is investigation.

Not experimentation.

The objective is not to make the error disappear.

The objective is to understand exactly why the error exists and eliminate its root cause.

Every bug should leave the codebase more reliable than before.

---

# Debugging Philosophy

Never guess.

Never stack random fixes.

Never introduce defensive code that hides the real issue.

Every fix should be supported by evidence.

The debugging process should move from:

Observation

↓

Reproduction

↓

Isolation

↓

Root Cause

↓

Verification

↓

Regression Review

Only then should the issue be considered resolved.

---

# Golden Rules

Never implement multiple fixes simultaneously.

Change one thing.

Observe.

Repeat.

Making many unrelated changes destroys useful debugging information.

---

# Reproduce First

Before changing code:

Determine:

- Can the issue be reproduced?
- Is it deterministic?
- Does it happen every time?
- Does it require specific input?
- Does it depend on timing?
- Does it depend on operating system?

If the issue cannot be reproduced, gather more evidence before modifying code.

---

# Define Expected Behaviour

Before investigating ask:

What should happen?

What actually happens?

What is different?

Avoid debugging vague descriptions.

Be precise.

---

# Gather Evidence

Collect facts before writing code.

Evidence includes:

Error messages

Logs

Stack traces

Screenshots

Screen recordings

Console output

Network requests

IPC messages

Performance traces

Crash dumps

Browser version

Operating system

Do not form conclusions before evidence exists.

---

# Isolate the Problem

Reduce the scope.

Ask:

Is this:

Renderer?

Main process?

Preload?

IPC?

Network?

Filesystem?

UI?

State?

Rendering?

Animation?

Architecture?

Identify the smallest area that can produce the issue.

---

# Follow the Data

Trace information from origin to destination.

Example:

User Action

↓

UI Event

↓

Component

↓

State

↓

Service

↓

IPC

↓

Main Process

↓

Operating System

The fault exists somewhere along that path.

Find it.

---

# Root Cause Analysis

Do not stop at the first failure.

Ask repeatedly:

Why?

Until reaching the underlying cause.

Example:

Button doesn't update.

↓

State not changing.

↓

IPC failed.

↓

Validation rejected payload.

↓

Incorrect type sent.

↓

Shared type outdated.

The real fix is updating the shared type—not forcing a UI refresh.

---

# Browser-Specific Investigation

Common browser subsystems include:

Tabs

Navigation

History

Downloads

Bookmarks

Profiles

Settings

Sessions

Permissions

Networking

Extensions

Window Management

Determine which subsystem owns the issue before editing code.

---

# Renderer Issues

Investigate:

Component state

Props

Effects

Context

Rendering frequency

Hooks

Memoisation

Layout

Animations

Never assume the renderer is at fault because the UI is broken.

---

# Main Process Issues

Investigate:

IPC

Window lifecycle

Filesystem

Downloads

Permissions

Sessions

Dialogs

Native APIs

Keep debugging focused on process ownership.

---

# IPC Investigation

Verify:

Channel names

Payload types

Validation

Serialization

Response timing

Error propagation

Avoid generic logging.

Log meaningful data.

---

# Logging Strategy

Logs should answer:

What happened?

Where?

Why?

What inputs existed?

What state changed?

Avoid noisy logs.

Avoid "here", "test", or "debug" messages.

---

# Binary Search Debugging

For large issues:

Reduce the problem.

Disable half.

Observe.

Repeat.

Quickly narrow the failing area.

---

# Regression Analysis

Ask:

When did this start?

Which commit introduced it?

Which feature changed?

Which dependency changed?

Recent changes often contain the answer.

---

# Performance Bugs

Investigate:

Render count

Memory growth

CPU spikes

Layout recalculation

Large allocations

Repeated IPC

Unnecessary effects

Measure before optimising.

---

# Memory Leaks

Check for:

Event listeners

Intervals

Timeouts

Observers

Subscriptions

Large caches

Retained references

Always clean up allocated resources.

---

# Race Conditions

Look for:

Async ordering

Delayed state

Duplicate requests

Multiple event sources

Shared mutable state

Race conditions often appear intermittent.

---

# Timing Bugs

Avoid fixing timing bugs with arbitrary delays.

Never solve issues using:

setTimeout(...)

without understanding why it works.

Fix ordering—not timing.

---

# Browser Scale Testing

Attempt reproduction with:

Many tabs

Large history

Large bookmarks

Long sessions

Slow storage

Slow network

Small window

Large window

High DPI

Different operating systems

Scalability often exposes hidden bugs.

---

# Error Messages

Improve errors.

Good errors explain:

What failed.

Why.

Recovery steps.

Avoid cryptic failures.

---

# Temporary Debug Code

Temporary logging is acceptable during investigation.

Before completion:

Remove:

Debug logs

Console output

Temporary variables

Test branches

Commented code

The repository should remain clean.

---

# Verify the Fix

A fix is incomplete until verified.

Confirm:

Original bug resolved.

No regressions introduced.

Related features continue working.

Performance unaffected.

Accessibility preserved.

---

# Anti Patterns

Never:

Guess.

Apply multiple unrelated fixes.

Ignore evidence.

Suppress exceptions.

Hide bugs with retries.

Leave debug code.

Introduce workaround flags.

Disable failing functionality.

Ignore intermittent issues.

Use arbitrary delays.

Assume the first hypothesis is correct.

---

# Self Review

Before marking a bug fixed ask:

Can I explain exactly why the bug occurred?

Can I explain exactly why the fix works?

Would another engineer understand this investigation?

Could this happen elsewhere?

Have I removed temporary debugging code?

If not:

Continue investigating.

---

# Gold Standard

A debugging session should not only fix today's bug.

It should improve the overall reliability of the browser.

Every resolved issue should:

Increase understanding.

Reduce technical debt.

Prevent similar bugs.

Improve diagnostics.

Leave the codebase stronger than before.

Debugging is an engineering discipline—not trial and error.