# Changelog

## In-progress
- Polished Insert Gallery builder UX for authenticated Immich (logical groups, searchable multi-selects, live YAML preview).
- Allow users to write human-readable tag and people names in Gallery View YAML instead of Immich internal UUIDs.
- Added authenticated Immich people filters to canonical schema
- Add authenticated Immich tag filters on canonical schema.
- Updated the Insert Gallery builder flow to emit canonical authenticated Immich source configurations (filters, limit, sort) across album, favorites, and recent modes.
- Added authenticated Immich asset-type filter on canonical schema.
- Added authenticated Immich date-range filters (`createdAfter`, `createdBefore`) on canonical schema.
- Refactored authenticated Immich source schema to the canonical filters, limit, and sort model.
- Normalized and clarified the authenticated Immich source contract and documentation.
- Added authenticated Immich `recent` source support.
- Added authenticated Immich `favorites` source support.
- Restructured Gallery View's settings UI into distinct General and Providers tabs.
- Verified and finalized the Gallery builder modal and Immich insertion UX epic (#77).
- Verified and finalized the authenticated Immich album source MVP (#75).
- Verified and finalized the authenticated image delivery pipeline for Gallery View (#74).
- Added Gallery builder modal command to compose multiple sources with interactive UIs, rather than writing YAML directly.

- Immich connection model cleanup: remove display name, keep stable key, add migration.
- Replaced oversized broken image placeholders with exact source failure reasons and compact inline error UI for Immich galleries.
- Fixed gallery rendering lifecycle to reliably preserve galleries across note transitions and markdown re-renders.

- Improved authenticated Immich image loading so Gallery View uses lightweight thumbnails/previews instead of original assets where appropriate.
- Added authenticated Immich `album` support under the new `immich` provider path.
- Extracted shared helper utilities for Immich sources into an internal `ImmichTypes` and `ImmichHelpers` layer to reduce duplication without merging setup requirements.
- Added a test/validation flow for authenticated Immich connections in the plugin settings.
- Added an internal API client/service layer for authenticated Immich connections.
- Added an authenticated connection model and settings UI to support the authenticated `immich` provider path.
- Added a command to generate Gallery View showcase notes and demo assets inside the vault.
* Reorganized and refreshed Gallery View documentation to match the current `sources + view` schema, supported sources, and official plugin naming.

## 2.1.0 - 2026-06-22

* Added support for Immich shared-link galleries as a new `immich-share` source in Gallery View.
* Refactored gallery source loading into an internal resolver architecture to prepare for future source providers.


## 2.0.0 - 2026-06-21

- Reworked Gallery View codeblock syntax to support a new `sources` + `view` schema while keeping existing gallery blocks backward compatible.


## 1.0.10 - 2026-06-21

- Removed Roadmap from README
- Added Support section to README
- Optimize gallery rendering performance and improve array deduplication.
- Fix syntax and indentation issues in the jules-dispatch GitHub Actions workflow.
- Added attestation for release assets


## 1.0.9 - 2026-06-20

## 1.0.8 - 2026-06-15

- Improve GridView responsiveness and container initialization.
- Implement automated GitHub Actions release pipeline.


