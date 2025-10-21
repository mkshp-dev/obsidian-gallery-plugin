# Research: Gallery Code Block Implementation

**Created**: 2025-10-21  
**Purpose**: Resolve technical unknowns and establish implementation patterns for Obsidian gallery plugin

## YAML Parameter Parsing

**Decision**: Use js-yaml library for robust YAML parsing within code blocks

**Rationale**: 
- Standard library with TypeScript support
- Handles complex YAML structures for future extensibility
- Better error handling than custom parsing
- Widely used in Obsidian plugin ecosystem

**Alternatives considered**: 
- Custom parameter parsing (rejected - error prone, limited extensibility)
- JSON format (rejected - less readable for users)
- Simple key=value pairs (rejected - not extensible)

## Obsidian Code Block Processing

**Decision**: Use MarkdownCodeBlockProcessor API with custom renderer

**Rationale**:
- Native Obsidian API for code block processing
- Provides container element for custom rendering
- Handles re-rendering on content changes
- Integrates with Obsidian's markdown processing pipeline

**Alternatives considered**:
- Post-processing DOM manipulation (rejected - unreliable, conflicts with other plugins)
- Custom markdown extension (rejected - too complex, compatibility issues)

## Image Loading and Caching Strategy

**Decision**: Implement lazy loading with Intersection Observer API and memory-based caching

**Rationale**:
- Performance requirement for 500+ images
- Browser-native lazy loading support
- Memory caching reduces repeated network requests
- Intersection Observer efficiently handles viewport detection

**Alternatives considered**:
- Aggressive pre-loading (rejected - memory consumption, slow initial load)
- No caching (rejected - poor performance for repeated views)
- Disk-based caching (rejected - complexity, storage management)

## File System Access Patterns

**Decision**: Use Obsidian Vault API with recursive folder traversal

**Rationale**:
- Vault API provides secure, permission-managed file access
- Built-in support for file watching and change detection
- Handles both desktop and mobile platforms
- Respects Obsidian's file system abstractions

**Alternatives considered**:
- Direct Node.js fs access (rejected - security concerns, mobile incompatibility)
- Manual file walking (rejected - reinventing vault API capabilities)

## External URL Handling

**Decision**: Fetch API with AbortController for timeout management

**Rationale**:
- Modern browser API with good TypeScript support
- AbortController provides clean timeout and cancellation
- Works across desktop and mobile platforms
- Integrates well with retry logic

**Alternatives considered**:
- XMLHttpRequest (rejected - legacy API, more complex)
- Image element loading (rejected - limited error handling, no timeout control)

## View Rendering Architecture

**Decision**: Component-based rendering with factory pattern for view types

**Rationale**:
- Supports extensibility requirement for new view types
- Clear separation of concerns between views
- Enables independent testing of view components
- Facilitates future view customization options

**Alternatives considered**:
- Monolithic renderer (rejected - violates extensibility principle)
- Template-based rendering (rejected - limited dynamic behavior)

## Performance Monitoring

**Decision**: Implement performance tracking with metrics collection

**Rationale**:
- Success criteria include specific performance targets
- Helps identify performance regressions
- Enables optimization of critical paths
- Supports troubleshooting user performance issues

**Alternatives considered**:
- No performance monitoring (rejected - cannot validate success criteria)
- External analytics (rejected - privacy concerns, plugin complexity)

## Error Handling Strategy

**Decision**: Graceful degradation with user-friendly error states

**Rationale**:
- Constitution requires graceful error handling
- Maintains gallery functionality even with partial failures
- Clear user feedback for configuration errors
- Preserves document readability when gallery fails

**Alternatives considered**:
- Silent failure (rejected - poor user experience)
- Exception throwing (rejected - breaks document rendering)
- Console-only errors (rejected - users cannot debug issues)

## Mobile Compatibility Approach

**Decision**: Responsive design with touch-friendly interactions

**Rationale**:
- Technical constraints require mobile compatibility
- Touch interactions essential for carousel navigation
- Responsive grid layouts adapt to screen sizes
- Maintains functionality across all supported platforms

**Alternatives considered**:
- Desktop-only features (rejected - violates technical constraints)
- Separate mobile implementation (rejected - maintenance overhead)

## Development Dependencies

**Decision**: Minimal external dependencies, leverage Obsidian ecosystem

**Rationale**:
- Constitution emphasizes minimal dependencies
- Reduces bundle size and compatibility issues
- Leverages Obsidian's built-in capabilities
- Simplifies maintenance and updates

**Key Dependencies**:
- js-yaml: YAML parameter parsing
- Obsidian Plugin API: Core functionality
- TypeScript: Development and type safety

**Rejected Dependencies**:
- Heavy UI frameworks (React, Vue) - unnecessary for simple gallery views
- Image processing libraries - browser handles formats natively
- External storage APIs - Vault API sufficient