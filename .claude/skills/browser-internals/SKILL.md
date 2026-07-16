---
name: Browser Internals
description: Architecture, behaviour, lifecycle and implementation standards for browser-specific systems including tabs, windows, navigation, history, downloads, bookmarks, sessions, permissions and browser lifecycle.
---

# Purpose

This repository is a browser.

Not an Electron application.

Not a web application.

Every feature should behave like users expect from a modern browser.

Users compare browsers subconsciously.

Small inconsistencies become noticeable.

Every browser subsystem should feel mature.

---

# Browser Philosophy

The browser should always feel:

Fast

Predictable

Stable

Recoverable

Forgiving

Responsive

Never surprise users.

Users should always understand:

Where they are.

What is loading.

What happened.

How to recover.

---

# Browser Lifecycle

The browser exists in a continuous lifecycle.

Launch

↓

Restore

↓

Navigate

↓

Interact

↓

Suspend

↓

Resume

↓

Shutdown

Every subsystem should integrate into this lifecycle.

---

# Browser Windows

Each window is independent.

Each window owns:

tabs

layout

sidebar state

workspace

focused tab

window dimensions

Do not allow one window to unexpectedly affect another.

---

# Window Behaviour

Support:

multiple windows

maximise

minimise

fullscreen

restore

window persistence

high DPI

multi-monitor

platform differences

Users expect these to "just work."

---

# Tabs

Tabs are the heart of the browser.

Every tab should maintain:

unique id

URL

title

favicon

loading state

history

security state

audio state

crash state

pin state

discard state

Do not overload tab objects with unrelated data.

---

# Tab Behaviour

Support:

Open

Close

Duplicate

Pin

Unpin

Move

Drag

Detach

Restore

Reload

Mute

Context menu

Keyboard shortcuts

Every action should feel instant.

---

# Tab Closing

Closing a tab should never feel destructive.

Support:

Undo close

Session restore

Graceful cleanup

Memory release

Preserve user confidence.

---

# Tab Restoration

Recently closed tabs should restore:

history

scroll position where possible

title

favicon

navigation state

Avoid unnecessary reloads.

---

# Tab Loading

Users should immediately understand:

Loading

Loaded

Failed

Waiting

Redirecting

Never leave ambiguous states.

---

# Navigation

Navigation should remain predictable.

Support:

Back

Forward

Reload

Hard Reload

Stop

Home

External links

Redirects

Navigation history

Do not lose user context.

---

# Address Bar

The address bar should always represent reality.

Synchronise:

Current URL

Security status

Loading

Search mode

Focus

Selection

History suggestions

Never allow stale information.

---

# History

History should record meaningful navigation.

Avoid duplicates where appropriate.

Support:

Search

Delete

Clear

Restore

Filtering

Grouping

History should scale efficiently.

---

# Bookmarks

Bookmarks should support:

Folders

Search

Sorting

Import

Export

Drag & Drop

Editing

Large collections should remain responsive.

---

# Downloads

Downloads should support:

Pause

Resume

Cancel

Retry

Reveal

Delete history

Progress

Failures

Interrupted downloads

Completed downloads

Downloads should survive application restarts where appropriate.

---

# Session Restore

Session restore should preserve:

Tabs

Pinned tabs

Window layout

Workspace

Navigation history

Active tab

Session restoration should feel reliable.

---

# Profiles

Profiles should isolate:

Cookies

History

Bookmarks

Downloads

Sessions

Permissions

Extensions

Themes

Profiles should never leak data into one another.

---

# Private Browsing

Private sessions should:

Avoid persistent storage

Destroy temporary data

Separate cookies

Separate cache

Avoid affecting normal sessions

Privacy should be respected.

---

# Permissions

Permissions should be:

Explicit

Revocable

Understandable

Examples:

Camera

Microphone

Notifications

Clipboard

Location

USB

Bluetooth

Do not repeatedly prompt unnecessarily.

---

# Security Indicators

Users should always know:

Secure

Insecure

Certificate issues

Blocked permissions

Mixed content

Security indicators should be clear.

---

# Search

Search should support:

Suggestions

History

Bookmarks

Open tabs

Search engines

Search should remain responsive.

---

# Crash Recovery

Browser crashes happen.

Recover gracefully.

Restore:

Windows

Tabs

Downloads

Session

Users should lose as little work as possible.

---

# Browser Performance

Support:

Hundreds of tabs

Thousands of bookmarks

Large histories

Long-running sessions

Memory should remain stable.

Inactive tabs should consume minimal resources.

---

# Browser Memory

Release resources when:

Tabs close

Downloads complete

Windows close

Sessions end

Avoid retaining unnecessary objects.

---

# Browser Shortcuts

Support standard browser shortcuts.

Examples:

New Tab

Close Tab

Reopen Closed Tab

Reload

Find

History

Downloads

Settings

Shortcuts should remain configurable where appropriate.

---

# Context Menus

Context menus should feel native.

Show only relevant actions.

Avoid excessive nesting.

Support keyboard navigation.

---

# Browser Consistency

Every subsystem should behave consistently.

Loading indicators.

Icons.

Animations.

Error handling.

Dialogs.

Menus.

Spacing.

The browser should feel like one cohesive product.

---

# Browser Events

Avoid unpredictable event chains.

Every event should have:

Clear source

Clear owner

Clear lifecycle

Avoid hidden side effects.

---

# Browser Data

Persist only meaningful information.

Avoid storing:

Temporary UI state

Transient animations

Hover state

Temporary calculations

Persist:

Settings

Sessions

Bookmarks

History

Profiles

Downloads

---

# Browser Scale

Assume users may have:

500 tabs

50 windows

100,000 history entries

20,000 bookmarks

Large download queues

Design accordingly.

---

# Anti Patterns

Never:

Lose user data

Unexpectedly close tabs

Reset sessions

Duplicate browser state

Block navigation

Freeze UI

Confuse loading state

Leak profile information

Store duplicate history

Ignore failed navigation

Hide browser errors

---

# Self Review

Before completing work ask:

Would Chrome behave like this?

Would Arc behave like this?

Would Zen behave like this?

Would Edge behave like this?

Would Firefox behave like this?

Does this interaction feel natural?

Would users expect this behaviour?

Can this scale?

Does this preserve user data?

If not:

Continue refining.

---

# Gold Standard

The browser should feel dependable.

Users should trust it with their work.

Every interaction should reinforce confidence.

The browser should remain fast, reliable and predictable regardless of session length or workload.

Every subsystem should integrate naturally with every other subsystem.

The browser should feel like a mature product—not a collection of independent features.