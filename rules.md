# rules.md – Replit Ghostwriter Governance Rules

This file defines mandatory rules for all Replit Ghostwriter-assisted development on this repository. These rules ensure that the application remains consistent with the Unified App Blueprint, that documentation is kept current, and that features and gaps are always tracked.

## 1. Scope
These rules apply to:
- Any new feature, update, or bug fix generated via Replit Ghostwriter.
- All frontend, backend, database, and infrastructure changes.

## 2. Documentation Updates
- **Always** update `BLUEPRINT.md` when adding new features, modifying existing features, or changing architecture.
- Add any new database tables, endpoints, or workflows to both the schema section and relevant API documentation in `BLUEPRINT.md`.
- Maintain a changelog section at the bottom of `BLUEPRINT.md` summarizing modifications.

## 3. Feature & Gap Tracking
- Maintain a `FEATURES.md` file with:
  - Implemented features (linked to commit/PR).
  - In-progress features.
  - Known gaps / missing features.
- When a feature is completed, move it from "In-progress" to "Implemented" with a note on testing/verification status.

## 4. Coding Standards
- Follow the structure in Section 3 of `BLUEPRINT.md`.
- Keep endpoints consistent with the API contracts defined in Section 6.
- Use consistent naming conventions for variables, files, and database entities.
- Maintain backward compatibility with v1 API unless explicitly approved to break.

## 5. Database Changes
- All schema changes must be implemented as migration files in `/infra`.
- Each migration must be sequentially numbered and documented in the migration header with purpose and author/date.
- Update `BLUEPRINT.md` to reflect schema changes.

## 6. Testing Requirements
- Implement or update unit, integration, and E2E tests for any new or changed functionality.
- Document new test coverage in `BLUEPRINT.md`.

## 7. Commit Message Format
- Prefix commit messages with:
  - `feat:` for new features.
  - `fix:` for bug fixes.
  - `docs:` for documentation updates.
  - `refactor:` for code restructuring.
  - `infra:` for infrastructure changes.
- Reference relevant section of `BLUEPRINT.md` or `FEATURES.md`.

## 8. Review Process
- Before merging any Ghostwriter-generated change, verify that:
  - The code follows the blueprint.
  - All related documentation files have been updated.
  - Tests pass locally and in CI.

## 9. Enforcement
- No change should be merged into main without compliance to these rules.
- Violations should be documented in an `ISSUES.md` file for tracking.

---
**Purpose:** These rules ensure the application remains aligned with its blueprint, that knowledge is preserved, and that future developers can easily understand the system.

