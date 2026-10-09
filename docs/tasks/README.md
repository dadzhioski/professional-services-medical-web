# Web task execution

Execute tasks in the order defined in `../backlog/milestone-0.md`.

An agent receives exactly one task file. It must read `AGENTS.md`, `build-plan.md`, the task, referenced ADRs, and relevant source before editing. Scope expansion requires a new or amended task. Missing API behavior is handed off as a linked API task, never replaced with copied DTOs or invented fields.

Completion reports must list changed files, commands and results, exact API-client version, SSR/accessibility impact, security/privacy impact, limitations, and every check not executed.
