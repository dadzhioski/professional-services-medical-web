# WEB-ADR-0001: Use Next.js for the medical web product

- **Status:** Accepted
- **Date:** 2026-10-01
- **Related tasks:** WEB-M0-001, WEB-M0-002

## Context

Public doctor pages are the first product value and require SSR, metadata, structured data, responsive design, and a future authenticated dashboard. Multiple coding agents will implement the frontend.

## Decision

Use Next.js, React, strict TypeScript, App Router, and Tailwind CSS. Public routes are server-rendered. Business rules and authorization remain in the API. Use a small source-owned component set and do not add a second UI system in Milestone 0.

## Consequences

- strong SEO and metadata primitives;
- broad agent familiarity;
- adds a Node runtime;
- requires explicit server/client and caching boundaries;
- framework upgrades remain repository-local.
