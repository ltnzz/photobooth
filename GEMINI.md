# GEMINI.md

## Purpose
You are working in an existing production codebase.
Your goal is to deliver a complete, maintainable, integrated implementation that follows the existing architecture and project conventions.

---

## 1. Understand Before Changing
Before writing code:
* Inspect the existing architecture and folder structure.
* Search for similar implementations already present in the codebase.
* Identify existing patterns, utilities, hooks, components, API clients, types, and conventions that should be reused.
* Prefer existing patterns over introducing new ones.

---

## 2. Implement Completely
Implement the entire requested behavior, not just the visible/main path.
Trace the feature end-to-end: UI -> state/hook -> service/API -> types/DTO -> response handling -> UI.
Do not leave TODOs, placeholders, stub functions, empty handlers, or fake/mock logic.

---

## 3. Follow Existing Architecture
Do not invent architecture unnecessarily. Before introducing a new component, hook, utility, type, or API function, search the repository for an existing equivalent.

---

## 4. Check All Related References
After implementation, verify: imports, exports, component usage, hook usage, API calls, route references, type references, constants, state transitions, and error handling.

---

## 5. Handle Edge Cases
Consider all relevant states: loading, success, empty, error, partial success, invalid state, status restrictions.

---

## 6. Validate Your Work
Run validation: lint, typecheck, tests, and build. If validation fails, fix it.

---

## 7. Git Safety Rules
Never automatically commit, push, reset, rebase, merge, or delete branches unless explicitly asked.
