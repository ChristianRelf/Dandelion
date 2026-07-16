---
name: Browser State Management
description: Principles for designing, owning, updating, and synchronising application state in a production-quality browser. Covers local state, global state, derived state, persistence, IPC synchronisation, caching, and scalability.
---

# Purpose

State is the single source of truth.

Poor state management creates bugs that are difficult to reproduce and expensive to fix.

Every piece of state should have:

- one owner
- one responsibility
- one source of truth

State should always remain predictable.

---

# Philosophy

Do not store information simply because it might be useful.

Store only information that represents application state.

Everything else should be derived.

The less state the application owns, the simpler it becomes.

---

# Priorities

Optimise for:

1. Correctness

2. Predictability

3. Simplicity

4. Performance

5. Scalability

Never optimise for convenience.

---

# Single Source of Truth

Every value should have one owner.

Never duplicate application state.

Example:

Good

Tabs store:

title

URL

favicon

loading state

Do NOT also store these inside multiple components.

Components should consume state.

Not own copies.

---

# Local First

Always prefer local component state.

Promote state only when multiple systems require it.

Ask:

Can this remain local?

If yes:

Keep it local.

---

# Shared State

Shared state should exist only when genuinely required.

Examples:

Current profile

Theme

Open tabs

Window layout

Settings

Permissions

Downloads

History

Avoid turning every variable into global state.

---

# Derived State

Never store data that can be calculated.

Good:

selectedTabId

Derived:

selectedTab

Do not store both.

Duplicate truth eventually diverges.

---

# Immutable Updates

Treat state as immutable.

Avoid mutating existing objects.

Prefer predictable updates.

Immutable state simplifies:

debugging

undo

time travel

testing

change detection

---

# State Ownership

Every state value should answer:

Who owns me?

Who updates me?

Who consumes me?

If ownership is unclear:

The architecture needs improving.

---

# Browser State Domains

State should be separated by responsibility.

Examples:

Tabs

History

Bookmarks

Downloads

Settings

Profiles

Permissions

Workspace

Navigation

Search

Developer Tools

Each domain owns its own state.

Avoid giant application stores.

---

# UI State

UI state belongs close to the UI.

Examples:

Open dropdown

Hovered item

Dialog visibility

Input value

Panel width

Do not place temporary UI state globally.

---

# Persistent State

Persist only meaningful information.

Examples:

Theme

Window size

Sidebar width

Profiles

Bookmarks

History

Session restore

Avoid persisting temporary state.

---

# Session State

Session state should survive browser restarts where appropriate.

Examples:

Open tabs

Window positions

Pinned tabs

Workspace layout

Do not persist transient loading states.

---

# Synchronisation

Synchronise only when necessary.

Avoid keeping multiple stores manually synchronised.

One owner should publish changes.

Others should observe.

---

# IPC State

Renderer should not become the source of truth for privileged data.

Main process owns:

downloads

filesystem

permissions

native windows

Renderer reflects that state.

---

# Async State

Represent asynchronous operations explicitly.

Prefer states such as:

idle

loading

success

error

Avoid boolean combinations that become ambiguous.

---

# Error State

Errors should belong to the operation that produced them.

Avoid global "lastError" values.

Errors should be scoped.

---

# Loading State

Every asynchronous operation should expose loading state.

Avoid invisible work.

Users should always understand when something is happening.

---

# State Normalisation

Large collections should be normalised where practical.

Avoid deeply nested structures.

Prefer predictable lookup patterns.

---

# Caching

Cache expensive data only.

Every cache requires:

ownership

expiration

cleanup

Avoid permanent caches.

---

# Memory

Large state collections consume memory.

Examples:

History

Bookmarks

Downloads

Tabs

Logs

Do not duplicate these collections unnecessarily.

---

# Undo

Where appropriate, state changes should be reversible.

Examples:

Closed tabs

Deleted bookmarks

Settings

Workspace changes

Undo improves user confidence.

---

# Event Flow

Events should move in one direction.

User

↓

Component

↓

Feature

↓

Store

↓

Services

↓

IPC

↓

Main Process

Avoid circular update chains.

---

# Observability

State changes should be understandable.

A developer should be able to answer:

What changed?

Why?

When?

Where?

Predictable state simplifies debugging.

---

# Performance

Avoid updating large stores unnecessarily.

Only update what actually changed.

Minimise re-renders.

Batch updates where appropriate.

---

# Browser Scale

Design state for:

Hundreds of tabs

Thousands of bookmarks

Large history databases

Long-running sessions

Multiple windows

Large download queues

State architecture should scale naturally.

---

# Testing

State should be testable independently from UI.

Business logic should not require rendering components.

Separate behaviour from presentation.

---

# Anti Patterns

Never:

Duplicate state

Mutate state directly

Store derived values

Use global state unnecessarily

Hide business logic inside components

Share mutable objects

Create circular updates

Keep stale caches forever

Persist temporary UI state

Mix unrelated domains

---

# Self Review

Before completing work ask:

Does every value have one owner?

Is any state duplicated?

Can anything become derived?

Can state remain local?

Can responsibilities be separated further?

Will this scale to thousands of objects?

If not:

Refine the architecture.

---

# Gold Standard

State should always be:

Predictable.

Minimal.

Observable.

Immutable.

Scalable.

Every engineer should know exactly where a piece of information lives, who owns it, and how it changes.

A well-designed state system makes the rest of the browser significantly easier to build, debug, test, and maintain.