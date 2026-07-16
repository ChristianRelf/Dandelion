---
name: Browser Security Engineering
description: Security architecture, secure coding standards, threat modelling, Electron hardening, secure defaults, permission handling, dependency management and production security practices for a commercial browser.
---

# Purpose

Security is not a feature.

Security is a requirement.

Every new feature expands the browser's attack surface.

Claude should actively reduce risk while implementing functionality.

Never assume users, websites, extensions or external applications are trustworthy.

The browser should remain secure by default.

---

# Security Philosophy

Assume compromise.

Assume hostile input.

Assume unexpected behaviour.

Design systems that continue operating safely even when invalid data is received.

Never trust:

- websites
- renderer input
- IPC payloads
- local files
- extensions
- URLs
- downloaded content
- network responses
- user-generated content

Validate everything.

---

# Security Priorities

Optimise in this order:

1. User safety

2. Data protection

3. Privilege isolation

4. Secure defaults

5. Reliability

6. Performance

Convenience never outweighs security.

---

# Principle of Least Privilege

Every process, module and API should have only the permissions it requires.

Avoid broad permissions.

Expose the minimum possible capability.

Examples:

Renderer should not access filesystem.

Renderer should not spawn processes.

Renderer should not execute shell commands.

Renderer should not access unrestricted Electron APIs.

---

# Trust Boundaries

Treat each boundary as hostile.

Examples:

Internet

↓

Renderer

↓

Preload

↓

IPC

↓

Main Process

↓

Operating System

Every boundary requires validation.

---

# Input Validation

Validate:

types

length

ranges

allowed values

URLs

paths

identifiers

Never trust input simply because it originates from the UI.

---

# Output Encoding

Escape user-controlled data before rendering.

Prevent:

HTML injection

JavaScript injection

CSS injection

Template injection

Never concatenate raw HTML.

---

# URL Handling

Every URL should be treated as untrusted.

Validate:

protocol

hostname

origin

port

redirect chains

Reject unsupported protocols.

Never blindly navigate.

---

# External Links

External links should:

be validated

open safely

avoid privilege escalation

Prefer opening external websites in the system browser.

---

# Downloads

Treat every download as untrusted.

Never automatically execute downloads.

Validate:

destination

filename

path traversal

duplicate names

permissions

Provide clear user confirmation where appropriate.

---

# Filesystem

Filesystem access should be minimal.

Never expose unrestricted filesystem APIs.

Validate:

paths

permissions

ownership

existing files

Avoid path traversal vulnerabilities.

---

# IPC Security

Every IPC message should:

be typed

be validated

check permissions

return structured errors

Never expose generic execution channels.

Avoid:

execute()

eval()

run()

command()

style APIs.

---

# Authentication

Authentication should:

minimise stored secrets

expire sessions

support secure logout

avoid exposing tokens

Never hardcode credentials.

Never commit secrets.

---

# Session Security

Sessions should:

expire correctly

be isolated

clear sensitive data on logout

avoid leakage between profiles

Support private browsing.

---

# Secrets

Secrets belong:

environment variables

secure operating system storage

encrypted stores

Never:

hardcode secrets

commit API keys

embed credentials

log sensitive values

---

# Logging

Never log:

tokens

cookies

passwords

session identifiers

private user information

Logs should remain safe for diagnostics.

---

# Encryption

Use well-established cryptography.

Never invent custom encryption.

Never weaken algorithms for convenience.

Prefer platform-provided solutions.

---

# Passwords

Passwords should never be:

stored in plaintext

logged

transmitted insecurely

displayed accidentally

Always rely on established authentication libraries.

---

# Cookies

Respect browser cookie policies.

Protect:

HttpOnly

Secure

SameSite

Never expose cookies unnecessarily.

---

# Local Storage

Avoid storing sensitive information unnecessarily.

Sensitive data should expire.

Encrypt when appropriate.

---

# Clipboard

Clipboard contents may contain sensitive information.

Avoid unnecessary reads.

Never continuously monitor clipboard without explicit user intent.

---

# Permissions

Every permission request should:

explain why

occur only when needed

be revocable

avoid permanent assumptions

Support:

camera

microphone

notifications

location

clipboard

USB

Bluetooth

Serial

File access

---

# Renderer Security

Renderer should remain isolated.

Avoid:

Node APIs

filesystem

shell execution

native process creation

All privileged operations belong elsewhere.

---

# Content Security Policy

Prefer restrictive CSP.

Disallow unnecessary script execution.

Avoid unsafe-inline whenever practical.

Avoid unsafe-eval.

---

# Cross Site Scripting

Prevent XSS.

Avoid:

dangerouslySetInnerHTML

raw HTML rendering

template concatenation

unescaped user content

---

# Cross Site Request Forgery

Protect state-changing actions.

Validate origins.

Use secure authentication flows.

---

# Dependency Security

Every dependency increases attack surface.

Before installing:

Is it maintained?

Is it actively updated?

Does it have unnecessary permissions?

Can existing code replace it?

Remove unused dependencies promptly.

---

# Updates

Security updates should be prioritised.

Outdated dependencies should not remain indefinitely.

Review changelogs before upgrading.

---

# Extensions

Treat browser extensions as untrusted.

Limit capabilities.

Validate communication.

Isolate execution.

Never assume extensions behave correctly.

---

# Networking

Validate:

TLS

certificates

redirects

headers

timeouts

Avoid silent failures.

---

# Error Messages

Errors should not leak:

filesystem paths

stack traces

internal implementation

tokens

credentials

Display useful but safe messages.

---

# Rate Limiting

Protect expensive operations.

Examples:

login attempts

search APIs

downloads

network retries

Avoid resource exhaustion.

---

# Threat Modelling

Before implementing a feature ask:

What could be abused?

What could be exploited?

What data is exposed?

What privileges are granted?

How could an attacker misuse this?

Design against abuse.

---

# Privacy

Collect only necessary information.

Store only necessary information.

Retain only necessary information.

Delete information when no longer required.

Privacy should be the default.

---

# Secure Defaults

Every feature should begin in the safest configuration.

Users may choose to relax restrictions intentionally.

The browser should never default to insecure behaviour.

---

# Security Testing

Review:

malformed input

invalid IPC

unexpected navigation

large payloads

permission denial

network failures

filesystem abuse

session restoration

profile switching

private browsing

Attempt to break new features.

---

# Incident Readiness

Failures should produce:

safe recovery

useful diagnostics

minimal data exposure

graceful degradation

Avoid catastrophic failure.

---

# Anti Patterns

Never:

Trust renderer input

Disable security settings

Expose Node APIs

Hardcode credentials

Store plaintext secrets

Log authentication tokens

Execute user input

Build shell commands from strings

Bypass validation

Ignore permissions

Accept arbitrary URLs

Disable CSP

Expose unrestricted IPC

Ignore dependency vulnerabilities

Trade security for convenience

---

# Security Review Checklist

Before completing work ask:

Is every input validated?

Is IPC restricted?

Are permissions minimal?

Can user data leak?

Can this feature be abused?

Can an attacker escalate privileges?

Would I be comfortable exposing this to millions of users?

Have I introduced unnecessary attack surface?

If any answer is uncertain, revisit the implementation.

---

# Gold Standard

A secure browser assumes every external input is hostile.

Every privilege is intentional.

Every boundary is validated.

Every sensitive action is reviewed.

Security should be invisible to users—but evident in every architectural decision.

The safest implementation that still provides an excellent user experience is the preferred implementation.