---
name: Browser Performance Engineering
description: Performance engineering principles, optimisation techniques, memory management, rendering efficiency, startup optimisation, IPC performance, profiling workflow and scalability standards for a production-quality browser.
---

# Purpose

Performance is a feature.

Users should never consciously notice performance.

Instead they should describe the browser as:

- Fast
- Responsive
- Smooth
- Instant
- Lightweight

Performance should be designed into every feature rather than added afterwards.

---

# Philosophy

Never optimise blindly.

Never ignore performance.

Always understand the cost of new code.

Every feature should be evaluated based on:

- CPU usage
- Memory usage
- Startup cost
- Bundle size
- Render frequency
- IPC overhead
- Battery usage
- Animation smoothness

---

# Performance Priorities

Optimise in this order:

1. Startup time

2. Input responsiveness

3. Animation smoothness

4. Memory usage

5. Rendering performance

6. Background efficiency

7. Bundle size

---

# Golden Rule

The fastest code is code that never runs.

Always ask:

Can this work be avoided?

---

# Browser Expectations

A browser spends most of its lifetime idle.

Do not perform expensive work continuously.

Expensive work should happen:

- lazily
- on demand
- asynchronously

---

# Startup Performance

Startup should prioritise:

Window visibility.

First paint.

Interactive UI.

Everything else can happen later.

Avoid loading systems that are not immediately required.

---

# Lazy Loading

Load features only when needed.

Examples:

Downloads panel

Settings

History

Developer tools

Extension manager

Theme editor

Heavy editors

Do not initialise everything at launch.

---

# Code Splitting

Split large features.

Avoid enormous application bundles.

Each feature should ideally load independently.

---

# Rendering

Rendering should be predictable.

Avoid unnecessary re-renders.

Every render has a cost.

Always ask:

Why is this component rendering?

Can it render less often?

---

# React Optimisation

Prefer:

memo()

useMemo()

useCallback()

only where measurable.

Do not wrap everything in optimisation hooks.

Optimisation also has cost.

---

# Component Size

Large components re-render more work.

Break components into logical pieces.

Smaller rendering trees are easier to optimise.

---

# Derived Values

Never repeatedly calculate expensive values.

Memoise when calculations become expensive.

Avoid recalculating unchanged values.

---

# Virtualisation

Large collections should be virtualised.

Examples:

History

Bookmarks

Downloads

Tabs

Logs

Search results

Never render thousands of elements simultaneously.

---

# Lists

Always provide stable keys.

Never use array index unless order is guaranteed.

Stable keys reduce unnecessary reconciliation.

---

# State Updates

Batch updates where possible.

Avoid chains of state updates.

Prefer one meaningful update.

---

# Effects

Effects should be minimal.

Avoid:

effects triggering effects

nested effects

duplicated effects

infinite loops

Effects should synchronise external systems.

Not drive application logic.

---

# Timers

Avoid excessive intervals.

Clear timers immediately when unused.

Never leave orphaned timers.

---

# Event Listeners

Attach listeners only when required.

Always remove listeners.

Memory leaks frequently originate here.

---

# Memory

Memory leaks accumulate slowly.

Always consider:

subscriptions

listeners

intervals

observers

cached objects

window references

IPC callbacks

Dispose everything properly.

---

# Garbage Collection

Help garbage collection.

Release references.

Avoid unnecessary object retention.

Avoid global mutable caches.

---

# Images

Use appropriate image sizes.

Lazy load large assets.

Compress where practical.

Avoid oversized SVGs.

---

# Icons

Prefer vector icons.

Avoid duplicated icon libraries.

---

# Animations

Animate:

transform

opacity

Avoid animating:

width

height

margin

padding

left

top

These trigger layout work.

---

# Layout Thrashing

Avoid repeatedly reading and writing layout.

Group reads.

Group writes.

Avoid forcing synchronous layouts.

---

# Network Requests

Do not duplicate requests.

Cache where appropriate.

Cancel obsolete requests.

Debounce searches.

Throttle repeated actions.

---

# IPC Performance

IPC is expensive.

Batch related requests.

Avoid request spam.

Prefer structured payloads.

Avoid chatty communication.

---

# Main Process

Keep the main process lightweight.

Avoid blocking operations.

Use asynchronous APIs whenever possible.

Never freeze the event loop.

---

# Renderer Thread

The renderer should remain responsive.

Heavy work belongs elsewhere.

Avoid long synchronous loops.

---

# Background Tasks

Move expensive work into:

workers

background processes

main process

Never block interaction.

---

# Search Optimisation

Search should:

debounce input

cancel previous requests

cache recent queries

incrementally render results

---

# Caching

Cache only expensive computations.

Do not cache everything.

Every cache requires:

expiration

ownership

cleanup

---

# Bundle Size

Every dependency increases startup cost.

Before adding a dependency ask:

Can existing code solve this?

Can browser APIs solve this?

Can a smaller library solve this?

---

# Performance Budgets

Every feature should aim for:

Minimal startup impact.

Minimal idle CPU.

Minimal idle memory.

Minimal unnecessary rendering.

---

# Profiling

Always measure before large optimisations.

Use profiling tools to identify:

slow renders

memory leaks

expensive effects

blocking scripts

layout thrashing

Avoid optimisation based on assumptions.

---

# Regression Prevention

Every optimisation should preserve:

correctness

accessibility

maintainability

readability

Never trade stability for marginal speed.

---

# Browser-Specific Optimisation

Tabs should not update unnecessarily.

Inactive tabs should minimise work.

Background pages should consume minimal resources.

Download progress should update efficiently.

History should scale to tens of thousands of entries.

Bookmarks should remain responsive.

Settings should load instantly.

---

# Anti-Patterns

Avoid:

Premature optimisation

Nested render loops

Repeated expensive calculations

Large synchronous loops

Repeated IPC requests

Blocking filesystem operations

Huge context providers

Global mutable caches

Unbounded arrays

Massive object cloning

Expensive layout calculations

Heavy CSS effects

Large blur filters

Excessive box shadows

Multiple animation libraries

---

# Self Review

Before completing work ask:

Can this render less?

Can this allocate less memory?

Can this initialise later?

Can this communicate less over IPC?

Can this reuse existing work?

Can this avoid duplicate calculations?

Would this still feel responsive with:

100 tabs?

50,000 history entries?

10,000 bookmarks?

Thousands of downloads?

If not, improve scalability.

---

# Gold Standard

The browser should feel immediate.

Users should never wait wondering whether something happened.

Interactions should begin instantly.

Animations should remain smooth.

Scrolling should stay fluid.

Memory usage should remain stable over long sessions.

Performance should remain consistent regardless of browser age or workload.

Every new feature should leave the browser as fast—or faster—than before.