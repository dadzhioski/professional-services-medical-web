# Web task execution

Execute tasks according to their milestone backlog and actual dependencies. The owner authorized Milestone 1 on 2026-10-16 despite deferred Milestone 0 acceptance; read `../backlog/milestone-1.md` when planning or executing its tasks. Do not require completion of WEB-M0-007, remaining WEB-M0-008 proof, or other deferred Milestone 0 acceptance as a blanket prerequisite for frontend work.

An agent receives exactly one task file. It must read `AGENTS.md`, `build-plan.md`, the task, referenced ADRs, and relevant source before editing. Scope expansion requires a new or amended task. Missing API behavior is handed off as a linked API task, never replaced with copied DTOs or invented fields.

Completion reports must list changed files, commands and results, exact API-client version, SSR/accessibility impact, security/privacy impact, limitations, and every check not executed.
