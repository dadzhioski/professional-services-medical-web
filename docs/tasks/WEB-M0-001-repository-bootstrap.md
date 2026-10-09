# WEB-M0-001: Initialize the medical-web repository and Node toolchain

- **Status:** IMPLEMENTED (pending owner review)
- **Target repository:** `professional-services-medical-web`
- **Depends on:** None
- **Related ADRs:** WEB-ADR-0001, WEB-ADR-0003
- **Risk:** Low

## Goal

Create an independent medical-web repository with pinned Node 24 and npm toolchains plus frontend-specific agent instructions.

## Allowed scope

- initialize Git and approved web directory structure;
- pin an exact Node 24 LTS patch and npm version;
- install WEB agent instructions, ADRs, and task files;
- add `.editorconfig`, `.gitattributes`, `.gitignore`, `.env.example`, and initial README;
- define placeholder scripts for later frontend checks.

## Non-goals

- no Next.js application yet;
- no Java, Maven, database, Next.js implementation, or active deployment;
- no API client copied from another repository;
- no registry token.

## Requirements

1. Repository installs and bootstrap checks run independently. Application tests are introduced in WEB-M0-002; placeholder checks must not report success.
2. `packageManager` and lock-file policy are documented.
3. Ignore environment files, build output, Playwright artifacts, and IDE state.
4. Documentation identifies the medical-web repository boundary.

## Acceptance criteria

- [x] Exact Node and npm versions are pinned.
- [x] Agent and ADR files exist.
- [x] No backend source or database migration exists.
- [x] Local secret files remain ignored.
- [x] Repository README links its local build plan and backend contract boundary.

## Verification

```bash
node --version
npm --version
npm ci
git symbolic-ref --short HEAD
git status --short
```

Verified with Node 24.19.0 and npm 11.17.0: installation preserves the lock file,
Git starts on `main` without a remote, and ignore rules protect local environment,
dependency, build, test, IDE, TypeScript metadata, and package archive files while
keeping example environment files trackable.

`npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` each exit 1
with `not implemented until WEB-M0-002`. Their placeholder behavior was checked;
actual lint, type checking, unit tests, production build, and Playwright checks
are not implemented or executed. No SSR or accessibility behavior is introduced,
and no personal data is collected. No API client is installed in this task.

## Security and privacy

No personal data. `.env.example` contains safe names and synthetic values only.

## Handoff

Report exact Node/npm versions and repository-root files.
