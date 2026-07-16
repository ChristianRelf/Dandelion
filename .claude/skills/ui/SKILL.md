---
name: Browser UI & Design System
description: Standards for building production-quality browser interfaces that feel polished, consistent, and maintainable.
---

# Purpose

This skill governs every visible part of the application.

The browser should never feel like a collection of random React components.
It should feel like a single cohesive product designed by one team.

Every component must be:

- Consistent
- Predictable
- Accessible
- Responsive
- Animated appropriately
- Production-ready

UI quality is judged by how refined it feels during everyday use, not by how many features it contains.

---

# Core Philosophy

The interface should disappear.

Users should never have to think about:

- where buttons are
- what is clickable
- whether something is loading
- why something moved
- whether something succeeded

Every interaction should communicate intent.

---

# Design Goals

Prioritise:

- clarity
- consistency
- hierarchy
- responsiveness
- subtlety
- simplicity

Avoid:

- visual clutter
- inconsistent spacing
- oversized controls
- unnecessary colours
- abrupt animations
- modal overload

---

# Design Language

Everything should feel like it belongs together.

Never mix multiple visual styles.

Choose one language and remain consistent.

Examples include:

- soft rounded corners
- minimal shadows
- subtle gradients
- muted colours
- consistent iconography
- restrained motion

Avoid sudden stylistic changes between pages.

---

# Visual Hierarchy

Every page should naturally answer:

1. Where am I?
2. What is most important?
3. What can I do?
4. What changed?

Hierarchy should come from:

- spacing
- typography
- weight
- alignment

Not excessive colour.

---

# Layout

Prefer large breathing room.

Never cram controls together.

Use logical grouping.

Sections should be visually separated using:

- spacing
- background elevation
- subtle borders

Avoid unnecessary dividers.

Whitespace is a design tool.

---

# Grid System

Use an 8px spacing system.

Valid spacing values:

4

8

12

16

20

24

32

40

48

64

Never invent random spacing like:

13px

27px

41px

Maintain rhythm across every screen.

---

# Alignment

Nothing should appear "almost aligned."

Edges should line up.

Text baselines should align.

Icons should align optically.

Controls inside cards should share common margins.

---

# Border Radius

Keep radius consistent.

Suggested:

Buttons

10px

Cards

14px

Inputs

10px

Menus

12px

Dialogs

16px

Avoid random radii.

---

# Typography

Typography creates hierarchy.

Limit the number of font sizes.

Example scale:

12

13

14

16

18

20

24

32

Headings should rely primarily on weight rather than excessive size.

Never mix many font weights.

---

# Colour

Use colour intentionally.

Primary purpose:

- emphasis
- state
- branding

Not decoration.

Avoid rainbow interfaces.

Muted palettes feel more premium.

---

# Elevation

Depth should communicate interaction.

Interactive layers:

base

↓

cards

↓

menus

↓

dialogs

↓

notifications

Each layer should have a consistent elevation.

---

# Buttons

Every button must have:

hover

focus

active

disabled

loading

Do not create "dead" buttons.

Buttons should provide immediate visual feedback.

---

# Button Hierarchy

Only one primary action per area.

Primary

Most important action.

Secondary

Common alternatives.

Ghost

Low emphasis.

Danger

Destructive actions only.

Never make every button primary.

---

# Hover States

Every interactive element should visibly react.

Examples:

background shift

subtle elevation

border colour

cursor

Never rely solely on colour.

Hover changes should feel immediate.

---

# Cursor Behaviour

Clickable

pointer

Text

text

Dragging

grab

Dragging active

grabbing

Disabled

default

---

# Focus States

Keyboard users must always know where they are.

Never remove focus outlines without replacement.

Focus should be:

visible

high contrast

consistent

---

# Loading States

Never leave users guessing.

Every async action requires feedback.

Prefer:

spinner

progress bar

skeleton

button loading

Never freeze the UI.

---

# Empty States

Avoid blank pages.

Explain:

why empty

how to populate

next action

Include illustration only if it adds value.

---

# Error States

Errors should:

explain

suggest recovery

avoid blame

Never display raw stack traces.

---

# Success States

Communicate completion.

Examples:

checkmark

toast

button state

subtle animation

Do not over-celebrate.

---

# Motion Principles

Animation should:

guide attention

reinforce state

smooth transitions

Never animate simply because it looks nice.

---

# Animation Durations

Micro interaction

100–140ms

Buttons

150–180ms

Panels

200–250ms

Major layout

250–350ms

Avoid animations over 400ms.

---

# Easing

Prefer natural easing.

Avoid:

linear

bounce

elastic

unless intentionally playful.

---

# Responsiveness

Support:

small laptops

standard desktops

ultrawide

high DPI

Never assume one window size.

---

# Window Resizing

Layouts should adapt continuously.

Avoid sudden jumps.

Avoid overflowing controls.

Avoid clipped text.

---

# Sidebars

Resizable if appropriate.

Remember previous size.

Collapse smoothly.

Never jitter while resizing.

---

# Tabs

Tabs should feel lightweight.

Requirements:

hover

close animation

loading state

favicon placeholder

drag support

pinned state

overflow handling

active indication

---

# Context Menus

Context menus should:

appear instantly

dismiss naturally

respect keyboard navigation

avoid unnecessary nesting

---

# Inputs

Every input requires:

label

placeholder where appropriate

validation

focus

disabled

error

Never rely solely on placeholder text.

---

# Search

Search should feel immediate.

Debounce expensive work.

Show empty results gracefully.

Highlight matches.

---

# Icons

Use one icon family.

Maintain consistent stroke width.

Avoid mixing outlined and filled icons randomly.

---

# Accessibility

Target WCAG AA minimum.

Support:

keyboard navigation

screen readers

high contrast

reduced motion

zoom

Do not make accessibility optional.

---

# Dark Theme

Dark interfaces should not use pure black.

Prefer layered surfaces.

Contrast should come from elevation, not brightness.

---

# Responsive Behaviour

Prefer adapting layouts rather than hiding functionality.

Important actions should remain visible.

---

# Scroll Behaviour

Scrolling should remain smooth.

Avoid nested scrolling unless necessary.

Restore previous scroll position where expected.

---

# Notifications

Toasts should:

appear consistently

dismiss automatically

never block interaction

Avoid stacking excessively.

---

# Dialogs

Dialogs interrupt workflow.

Only use when necessary.

Support:

Escape

Enter

Tab trapping

Background dismissal where appropriate

---

# Performance

Do not sacrifice responsiveness for visual effects.

Avoid:

heavy blur

large shadows

layout thrashing

expensive animations

---

# Visual Consistency Checklist

Before completion ask:

Do margins match?

Do paddings match?

Are icons aligned?

Are hover states consistent?

Are animations consistent?

Do colours match?

Do shadows match?

Does typography match?

---

# Browser Specific Expectations

A browser should feel fast.

Examples:

Tab opens instantly.

Hover feels immediate.

Panels animate smoothly.

Address bar gains focus instantly.

Downloads update in real time.

Bookmarks feel responsive.

Settings pages feel polished.

No screen should appear unfinished.

---

# Anti-Patterns

Never:

Mix spacing systems.

Mix border radii.

Mix animation timings.

Mix icon libraries.

Duplicate component styles.

Use arbitrary colours.

Create inconsistent padding.

Leave buttons without hover.

Forget loading states.

Forget keyboard navigation.

Use abrupt layout shifts.

---

# Self Review

Before marking work complete:

Would this look acceptable in:

- Arc
- Zen
- Chrome
- Edge
- VS Code

Does it feel intentional?

Would a designer immediately spot inconsistencies?

Can a first-time user understand it without explanation?

Does every interaction provide feedback?

Does anything feel unfinished?

If the answer is yes, continue refining until the UI feels cohesive, responsive, and complete.