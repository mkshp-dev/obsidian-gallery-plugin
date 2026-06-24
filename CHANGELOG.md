# Changelog

## In-progress

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


