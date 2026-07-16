---
name: Electron Architecture & Best Practices
description: Standards for building secure, scalable, performant Electron applications. Covers process separation, IPC, preload APIs, window lifecycle, permissions, sessions, downloads, updates and platform integration.
---

# Purpose

Electron provides powerful native capabilities.

With that power comes responsibility.

Every feature should:

- be secure
- be performant
- be maintainable
- minimise IPC
- isolate privileges
- follow Electron best practices

The browser should never expose unnecessary system access.

---

# Philosophy

Treat the renderer as untrusted.

Treat IPC as a public API.

Treat the preload script as a security boundary.

Treat the main process as the operating system interface.

Never blur these responsibilities.

---

# Process Responsibilities

## Renderer

Responsible for:

- UI
- React components
- animations
- user interactions
- presentation
- local UI state

Renderer should NEVER directly:

- access filesystem
- execute shell commands
- spawn processes
- access Node APIs
- manipulate BrowserWindow
- bypass preload

---

## Preload

Responsible for:

- exposing safe APIs
- validating arguments
- providing typed interfaces
- hiding Electron internals

Preload should expose the minimum possible surface area.

Everything exposed becomes part of the browser API.

---

## Main Process

Responsible for:

- BrowserWindow
- filesystem
- downloads
- permissions
- dialogs
- notifications
- sessions
- native menus
- OS integration
- auto updater
- protocols

Business logic should remain minimal.

The main process coordinates.

It should not become a "god object."

---

# Context Isolation

Always enable:

contextIsolation

Never disable it.

Renderer and Electron must remain isolated.

Communication happens only through preload.

---

# Node Integration

Node Integration should remain disabled.

Never enable it for convenience.

Instead expose explicit preload APIs.

---

# Sandbox

Prefer sandboxed renderers whenever practical.

Reduce renderer privileges.

Assume third-party content may become hostile.

---

# IPC Philosophy

IPC is not free.

Every message has cost.

Every channel increases maintenance.

Create IPC channels intentionally.

---

# IPC Design

Each IPC channel should have:

clear purpose

typed request

typed response

input validation

error handling

documentation

Avoid generic "execute" style channels.

---

# IPC Naming

Good

browser:getVersion

downloads:start

tabs:create

settings:update

history:clear

Bad

run

command

execute

request

test

Names should describe intent.

---

# IPC Validation

Validate:

types

ranges

permissions

existence

ownership

Never trust renderer input.

---

# IPC Responses

Responses should be predictable.

Always return:

success

failure

structured errors

Avoid throwing raw exceptions across IPC.

---

# Browser Windows

Each window should have one owner.

Never create unmanaged windows.

Window lifecycle should be deterministic.

---

# Window Creation

Configure windows consistently.

Examples:

hidden title bar

minimum dimensions

background colour

icon

preload

sandbox

context isolation

spellcheck

zoom behaviour

Maintain a shared configuration.

---

# Window State

Persist:

size

position

maximised state

fullscreen state

Restore automatically.

---

# Crash Recovery

If renderer crashes:

inform user

offer reload

preserve session where possible

log diagnostics

Never silently disappear.

---

# Downloads

Downloads belong in the main process.

Renderer requests.

Main process owns.

Progress should stream efficiently.

Support:

pause

resume

cancel

retry

file reveal

---

# Sessions

Use Electron sessions intentionally.

Separate:

default profile

private profile

temporary sessions

guest sessions

Avoid accidental state leakage.

---

# Permissions

Every permission request should be explicit.

Examples:

camera

microphone

notifications

clipboard

geolocation

USB

Never grant automatically without policy.

---

# Navigation

Validate every navigation.

Prevent unexpected redirects.

Handle:

new windows

external links

downloads

custom protocols

---

# External URLs

Never open unknown URLs automatically.

Validate first.

Prefer opening external websites in the user's default browser.

---

# Custom Protocols

Register protocols securely.

Validate inputs.

Never expose arbitrary filesystem paths.

---

# File System

Filesystem access belongs only in the main process.

Renderer requests operations through preload.

Never expose unrestricted filesystem APIs.

---

# Shell Access

Never expose shell execution to renderer.

Avoid command execution APIs unless absolutely necessary.

---

# Native Dialogs

Dialogs belong in the main process.

Provide typed wrappers.

Do not expose Electron dialog directly.

---

# Clipboard

Clipboard APIs should be wrapped.

Support:

copy

paste

read

write

images

text

Validate formats.

---

# Notifications

Use native notifications where appropriate.

Do not spam users.

Respect operating system behaviour.

---

# Auto Updates

Updater should be isolated.

Support:

checking

download

verification

installation

rollback where possible

Failures should never corrupt installations.

---

# Logging

Separate logs by process.

Renderer logs.

Main process logs.

Updater logs.

Crash logs.

Avoid mixing responsibilities.

---

# Error Handling

Never crash the application because one subsystem fails.

Gracefully degrade.

Surface useful diagnostics.

---

# Security Checklist

Always verify:

contextIsolation enabled

nodeIntegration disabled

sandbox enabled where practical

validated IPC

restricted preload

secure navigation

safe external links

permission handling

session isolation

content security policy

---

# Performance

Avoid synchronous APIs.

Prefer asynchronous filesystem operations.

Avoid excessive IPC chatter.

Lazy initialise expensive native systems.

---

# Cross Platform

Every feature should consider:

Windows

macOS

Linux

Avoid platform assumptions.

Use Electron abstractions when appropriate.

---

# Testing

Electron features should be tested for:

startup

shutdown

multiple windows

downloads

permissions

session restoration

renderer crashes

preload APIs

---

# Anti Patterns

Never:

Expose ipcRenderer directly

Enable Node Integration

Disable Context Isolation

Execute shell commands from renderer

Expose unrestricted filesystem access

Use generic IPC channels

Mix renderer and main responsibilities

Store business logic inside preload

Access BrowserWindow from renderer

Duplicate Electron APIs

Ignore permission prompts

Trust renderer input

---

# Self Review

Before completing work ask:

Does the renderer remain unprivileged?

Is IPC minimal?

Is every IPC channel validated?

Can this preload API be smaller?

Can responsibilities be separated further?

Would this implementation pass an Electron security review?

Does this work across supported operating systems?

If any answer is "no", continue refining.

---

# Gold Standard

The Electron layer should feel invisible.

Renderer developers should interact with clean, typed APIs.

Native functionality should be secure by default.

Every privilege should be explicit.

Every IPC channel should be intentional.

The browser should follow Electron best practices without compromise, providing a secure, maintainable foundation for all future development.