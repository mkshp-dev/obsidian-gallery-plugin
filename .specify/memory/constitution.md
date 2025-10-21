<!--
Sync Impact Report:
- Version change: 0.0.0 → 1.0.0
- Initial constitution for Obsidian Gallery Plugin
- Added principles: Plugin Architecture, Code Block Integration, Gallery Rendering, Performance & UX, Extensibility
- Added sections: Technical Constraints, Development Standards
- Templates requiring updates: ✅ plan-template.md, spec-template.md, tasks-template.md
- Follow-up TODOs: None - all placeholders filled
-->

# Obsidian Gallery Plugin Constitution

## Core Principles

### I. Plugin Architecture
The plugin MUST follow Obsidian's plugin architecture patterns. All functionality must be encapsulated within the Plugin class extending Obsidian's Plugin base. Components must be modular and independently testable. The plugin must gracefully handle loading/unloading lifecycle events and maintain compatibility with Obsidian's API versioning.

### II. Code Block Integration
Gallery functionality MUST be accessible via markdown code blocks with the syntax ```obs-gallery```. Parameters must be clearly defined and validated. The plugin must parse code block content, validate parameters, and provide meaningful error messages for invalid configurations. All gallery rendering must occur within the code block container.

### III. Gallery Rendering
Gallery views (thumbnails, carousel, etc.) must render efficiently within Obsidian's markdown view. Image loading must be asynchronous and non-blocking. Gallery components must be responsive and accessible. Image sources must be validated and support both local vault files and external URLs. Focus initially on image rendering before expanding to other media types.

### IV. Performance & UX (NON-NEGOTIABLE)
Gallery rendering must not degrade Obsidian's performance. Large galleries must implement lazy loading and pagination. Image loading must include proper error handling and loading states. Memory usage must be optimized through image caching and cleanup. The plugin must provide immediate visual feedback and avoid blocking the UI thread.

### V. Extensibility
The plugin architecture must support adding new gallery view types without breaking existing functionality. Configuration schema must be versioned and backward compatible. The codebase must separate concerns: file scanning, image processing, view rendering, and configuration management as distinct modules.

## Technical Constraints

**Platform**: Obsidian Plugin (Electron-based, TypeScript/JavaScript)
**Target Compatibility**: Obsidian Desktop and Mobile
**Image Formats**: JPG, PNG, GIF, WebP (standard web formats)
**File Sources**: Local vault files, external URLs, embedded images
**Rendering**: Within markdown view containers, no external windows
**Configuration**: Via code block parameters, no separate settings panel required
**Dependencies**: Minimal external dependencies, leverage Obsidian's built-in capabilities

## Development Standards

**Language**: TypeScript with strict typing enabled
**Testing**: Unit tests for core logic, integration tests for Obsidian API interactions
**Code Organization**: Modular structure with clear separation of concerns
**Documentation**: JSDoc comments for all public APIs, README with usage examples
**Error Handling**: Graceful degradation with user-friendly error messages
**Accessibility**: Keyboard navigation support, screen reader compatibility

## Governance

Constitution supersedes all other development practices. All feature implementations must verify compliance with core principles. Any violation of Performance & UX principles must be explicitly justified with technical reasoning and approved alternatives. Plugin architecture changes require validation against Obsidian's plugin development guidelines.

**Version**: 1.0.0 | **Ratified**: 2025-10-21 | **Last Amended**: 2025-10-21
