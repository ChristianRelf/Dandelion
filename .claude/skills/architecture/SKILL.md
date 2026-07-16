---
name: Browser Architecture
description: Repository architecture, feature design, module boundaries, dependency management, IPC patterns, scalability principles and implementation strategy for a production-quality browser.
---

# Purpose

This skill defines how every feature should be architected.

Good architecture is invisible.

It allows the browser to grow for years without becoming difficult to maintain.

The goal is not to create the fewest files.

The goal is to create the clearest system.

Every implementation should improve consistency across the repository.

---

# Philosophy

Architecture exists to reduce complexity.

Not increase it.

Every abstraction should remove cognitive load.

Every module should have a single responsibility.

Every dependency should have a clear reason to exist.

The browser should be understandable by a new engineer within a reasonable amount of time.

---

# Long-Term Thinking

Every feature should assume:

- the browser will continue growing
- more contributors will join
- features will interact
- APIs will evolve
- UI will change
- performance requirements will increase

Never optimise purely for today's implementation.

---

# Core Principles

Optimise in this order:

1. Correctness

2. Simplicity

3. Maintainability

4. Scalability

5. Performance

6. Flexibility

Never sacrifice maintainability for cleverness.

---

# Project Layers

The repository should be separated into clear layers.

Example:

Renderer

↓

UI Components

↓

Feature Modules

↓

Services

↓

State

↓

Utilities

↓

Electron Bridge

↓

Main Process

Every layer should have a single responsibility.

---

# Layer Responsibilities

Renderer

Only UI.

No business logic.

No filesystem.

No Electron APIs.

No Node APIs.

---

Feature Modules

Contain browser behaviour.

Examples:

Tabs

Bookmarks

Downloads

History

Settings

Profiles

Extensions

Sidebar

Workspace

Each feature owns its own logic.

---

Services

Services communicate with external systems.

Examples:

DownloadService

HistoryService

SessionService

SearchService

PermissionService

Services should not render UI.

---

Utilities

Utilities should be completely generic.

Good:

formatBytes()

debounce()

generateId()

Bad:

saveBrowserTab()

Utilities should not know browser behaviour.

---

State

State should represent application truth.

Never duplicate state.

Never maintain multiple conflicting sources.

Derived values should remain derived.

---

Electron Bridge

Acts as the only communication layer.

Never expose Electron directly to the renderer.

Everything passes through secure APIs.

---

Main Process

Owns:

windows

filesystem

downloads

native dialogs

system integrations

permissions

Renderer never directly performs these tasks.

---

# Module Ownership

Every feature owns:

components

hooks

types

services

tests

styles

documentation

Avoid scattering feature logic throughout the repository.

---

# Feature Structure

Example

feature/

components/

hooks/

types/

services/

utils/

tests/

constants/

index.ts

The goal is discoverability.

---

# Single Responsibility

Each module should answer exactly one question.

Examples

Download Manager

Manages downloads.

Not bookmarks.

Not history.

Not permissions.

Avoid "god objects."

---

# Dependencies

Dependencies should point downward.

UI

↓

Features

↓

Services

↓

Utilities

Never reverse this relationship.

---

# Circular Dependencies

Never introduce circular imports.

If two systems depend on each other:

Architecture is wrong.

Extract shared behaviour.

---

# Shared Code

Extract only when duplication becomes meaningful.

Do not prematurely generalise.

Prefer duplication over poor abstractions.

---

# IPC Principles

IPC is expensive.

Use it sparingly.

Batch requests where appropriate.

Validate every payload.

Never expose unrestricted IPC.

Every IPC channel should have:

clear purpose

typed payload

typed response

validation

error handling

---

# Browser Systems

The following systems should remain isolated:

Tabs

History

Downloads

Bookmarks

Profiles

Permissions

Extensions

Networking

Settings

Sessions

Crashes

Each should communicate through defined interfaces.

Never tightly couple browser systems.

---

# Public APIs

Every module should expose a small public API.

Avoid exposing internal implementation details.

Consumers should not depend upon private behaviour.

---

# File Growth

Large files indicate multiple responsibilities.

When files become difficult to navigate:

Extract logical modules.

Avoid creating 50 tiny files.

Seek balance.

---

# Component Design

Components should be:

predictable

reusable

focused

Avoid components exceeding several hundred lines unless genuinely justified.

Split by responsibility.

---

# State Management

Prefer local state first.

Shared state only when necessary.

Global state should remain minimal.

Avoid unnecessary global stores.

---

# Event Flow

Events should move in one direction.

User

↓

UI

↓

Feature

↓

Service

↓

IPC

↓

Main Process

Responses return the opposite direction.

Avoid unpredictable event chains.

---

# Error Boundaries

Features should fail gracefully.

One broken component should not break the browser.

Recover where possible.

---

# Configuration

Configuration belongs in dedicated configuration modules.

Avoid magic constants.

Avoid duplicated values.

---

# Code Reuse

Before writing code ask:

Does this already exist?

Can this module be extended?

Would another engineer expect code here?

Avoid solving the same problem twice.

---

# Anti-Patterns

Avoid:

Massive utility files

Generic managers

Global mutable state

Circular imports

Renderer filesystem access

Node access from UI

Duplicated business logic

Nested feature dependencies

Feature-to-feature tight coupling

Massive components

Massive hooks

Massive contexts

Premature abstraction

---

# Architecture Review Checklist

Before finishing work ask:

Does every file have one responsibility?

Does every module have a clear owner?

Is IPC minimal?

Are dependencies one-directional?

Can another engineer quickly locate this code?

Have I duplicated logic?

Can this feature evolve independently?

Would this architecture still make sense in two years?

If any answer is "no", improve the architecture before considering the implementation complete.

---

# Gold Standard

The repository should feel as though every feature was designed by the same engineering team.

A contributor should be able to:

- predict where new code belongs
- understand feature boundaries
- follow data flow
- extend systems without rewriting them

Architecture should remove uncertainty, not create it.

Every new feature should leave the repository cleaner than it was found.