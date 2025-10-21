---
description: "Task list for Gallery Code Block implementation"
---

# Tasks: Gallery Code Block

**Input**: Design documents from `/specs/001-gallery-code-block/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: The examples below include test tasks. Tests are OPTIONAL - only include them if explicitly requested in the feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Single project**: `src/`, `tests/` at repository root
- Paths shown below assume single project - adjust based on plan.md structure

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create Obsidian plugin project structure per implementation plan
- [x] T002 [P] Initialize TypeScript configuration with strict mode in tsconfig.json
- [x] T003 [P] Setup package.json with Obsidian plugin dependencies and js-yaml
- [x] T004 [P] Create Obsidian plugin manifest.json with metadata and permissions
- [x] T005 [P] Setup Jest testing configuration in jest.config.js
- [x] T006 [P] Create main plugin entry point in main.ts extending Obsidian Plugin class
- [x] T007 [P] Setup CSS styling foundation in styles.css for gallery components

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T008 Create core data models in src/models/GalleryConfig.ts
- [x] T009 [P] Create ImageSource model in src/models/ImageSource.ts with state management
- [x] T010 [P] Create GalleryInstance model in src/models/GalleryInstance.ts
- [x] T011 Create base GalleryView interface in src/views/GalleryView.ts
- [x] T012 [P] Implement YAML parameter parser in src/processors/ParameterParser.ts using js-yaml
- [x] T013 [P] Create configuration validator in src/utils/ConfigValidator.ts with path sanitization
- [x] T014 [P] Setup error handling infrastructure in src/utils/ErrorHandler.ts
- [x] T015 Register obs-gallery code block processor in main.ts using MarkdownCodeBlockProcessor API
- [x] T016 [P] Create ContentScanner base class in src/services/ContentScanner.ts with Vault API integration
- [x] T017 [P] Implement ViewFactory in src/views/ViewFactory.ts for creating view renderers

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Basic Gallery Embedding (Priority: P1) 🎯 MVP

**Goal**: Enable users to create thumbnail galleries from folder paths using ```obs-gallery code blocks

**Independent Test**: Create code block with folder path and verify thumbnail grid displays with lazy loading

### Implementation for User Story 1

- [ ] T018 [P] [US1] Implement folder scanning logic in src/services/FolderScanner.ts with recursive support
- [ ] T019 [P] [US1] Create image file validation in src/utils/ImageValidator.ts supporting JPG/PNG/GIF/WebP
- [ ] T020 [P] [US1] Implement file size checker in src/utils/FileSizeValidator.ts with 50MB limit
- [ ] T021 [US1] Integrate folder scanning with ContentScanner in src/services/ContentScanner.ts
- [ ] T022 [P] [US1] Create ThumbnailView renderer in src/views/ThumbnailView.ts with responsive grid
- [ ] T023 [P] [US1] Implement lazy loading with Intersection Observer in src/utils/LazyLoader.ts
- [ ] T024 [US1] Add image loading logic with timeout handling in src/services/ImageLoader.ts
- [ ] T025 [P] [US1] Create loading state components in src/views/components/LoadingSpinner.ts
- [ ] T026 [P] [US1] Create error placeholder components in src/views/components/ErrorPlaceholder.ts
- [ ] T027 [US1] Implement gallery rendering pipeline in src/processors/GalleryProcessor.ts
- [ ] T028 [P] [US1] Add empty state handling in src/views/components/EmptyState.ts
- [ ] T029 [US1] Integrate thumbnail view with code block processor
- [ ] T030 [P] [US1] Add CSS styling for thumbnail grid layout in styles.css
- [ ] T031 [P] [US1] Implement automatic gallery refresh on vault changes in src/services/VaultWatcher.ts

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Gallery View Options (Priority: P2)

**Goal**: Add carousel and grid view options to provide users with different presentation styles

**Independent Test**: Switch between view types in existing gallery and verify different layouts work

### Implementation for User Story 2

- [ ] T032 [P] [US2] Create CarouselView renderer in src/views/CarouselView.ts with horizontal scrolling
- [ ] T033 [P] [US2] Create GridView renderer in src/views/GridView.ts with masonry layout
- [ ] T034 [P] [US2] Add carousel navigation controls in src/views/components/CarouselControls.ts
- [ ] T035 [P] [US2] Implement touch gesture support in src/utils/TouchHandler.ts for carousel
- [ ] T036 [P] [US2] Add keyboard navigation support in src/utils/KeyboardHandler.ts
- [ ] T037 [US2] Update ViewFactory to support carousel and grid view creation
- [ ] T038 [P] [US2] Add view switching logic in src/services/ViewSwitcher.ts
- [ ] T039 [P] [US2] Create CSS styling for carousel view in styles.css
- [ ] T040 [P] [US2] Create CSS styling for grid view with responsive breakpoints in styles.css
- [ ] T041 [US2] Integrate new view types with GalleryProcessor
- [ ] T042 [P] [US2] Add view parameter validation in ConfigValidator
- [ ] T043 [US2] Update gallery rendering to support view switching with state preservation

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - File-Level Gallery Display (Priority: P3)

**Goal**: Enable galleries based on image links within specific markdown files rather than folder contents

**Independent Test**: Create gallery from file path and verify only images linked in that file appear

### Implementation for User Story 3

- [ ] T044 [P] [US3] Create markdown parser in src/services/MarkdownParser.ts for image link extraction
- [ ] T045 [P] [US3] Implement file content scanner in src/services/FileContentScanner.ts
- [ ] T046 [P] [US3] Add support for various image link formats (![](path), [[image.jpg]], URLs)
- [ ] T047 [P] [US3] Create external URL validator in src/utils/UrlValidator.ts
- [ ] T048 [US3] Integrate file scanning with ContentScanner.ts
- [ ] T049 [P] [US3] Add file vs folder path detection in src/utils/PathDetector.ts
- [ ] T050 [US3] Update GalleryProcessor to handle file-based galleries
- [ ] T051 [P] [US3] Add file change monitoring for automatic refresh
- [ ] T052 [US3] Update configuration validation to support file paths
- [ ] T053 [P] [US3] Handle mixed local and external image sources in views

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T054 [P] Add comprehensive error handling across all gallery components
- [ ] T055 [P] Implement performance monitoring in src/utils/PerformanceMonitor.ts
- [ ] T056 [P] Add accessibility attributes (ARIA labels, keyboard navigation)
- [ ] T057 [P] Optimize memory usage with cache management in src/utils/CacheManager.ts
- [ ] T058 [P] Add mobile-specific optimizations and touch improvements
- [ ] T059 [P] Create comprehensive CSS for responsive design across all breakpoints
- [ ] T060 [P] Add logging for debugging and troubleshooting
- [ ] T061 [P] Implement virtual scrolling for large galleries (500+ images)
- [ ] T062 [P] Add plugin settings for global configuration options
- [ ] T063 [P] Create user documentation and usage examples
- [ ] T064 [P] Performance optimization for initial load times
- [ ] T065 [P] Add retry logic for failed external URL loads

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Builds on US1 view infrastructure but independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Uses same view components as US1/US2 but independently testable

### Within Each User Story

- Models and utilities before services
- Services before views
- Views before integration
- Core implementation before polish features
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- Models within a story marked [P] can run in parallel
- CSS styling and utility functions can run in parallel with core logic

---

## Parallel Example: User Story 1

```bash
# Launch all models for User Story 1 together:
Task: "Create image file validation in src/utils/ImageValidator.ts"
Task: "Create file size checker in src/utils/FileSizeValidator.ts"
Task: "Create ThumbnailView renderer in src/views/ThumbnailView.ts"
Task: "Implement lazy loading with Intersection Observer in src/utils/LazyLoader.ts"
Task: "Create loading state components in src/views/components/LoadingSpinner.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: User Story 2
   - Developer C: User Story 3
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence