# Feature Specification: Gallery Code Block

**Feature Branch**: `001-gallery-code-block`  
**Created**: 2025-10-21  
**Status**: Draft  
**Input**: User description: "The users must be able to embed the gallery in their pages with ```obs-gallery. There should be params to specify gallery view like thumbnail, carousel etc. All the local and the url links should be displayed that are in the file OR folder (all files in that folder) dependinding upon the path provided by the user"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Basic Gallery Embedding (Priority: P1)

A user wants to display images from a specific folder in their vault as a visual gallery within their note. They type a code block with the gallery syntax and specify the folder path to see all images in that folder displayed in a thumbnail grid.

**Why this priority**: This is the core functionality that enables the basic use case. Without this, the plugin has no value. It provides immediate visual organization of images in notes.

**Independent Test**: Can be fully tested by creating a code block with ```obs-gallery and a folder path, then verifying that images from that folder appear as thumbnails in the note preview.

**Acceptance Scenarios**:

1. **Given** a note is open and a folder contains image files, **When** user types ```obs-gallery with YAML-style parameters (path: folder-name), **Then** all images from that folder are displayed as a thumbnail grid
2. **Given** a gallery is already displayed, **When** user modifies the folder path in the code block, **Then** the gallery updates to show images from the new folder
3. **Given** a folder contains no images, **When** user specifies that folder path, **Then** an empty state message is displayed

---

### User Story 2 - Gallery View Options (Priority: P2)

A user wants to control how their gallery appears by choosing different view modes like thumbnails, carousel, or grid layouts to best fit their content presentation needs.

**Why this priority**: This adds significant value by allowing users to customize the presentation style, making the gallery more versatile for different use cases.

**Independent Test**: Can be tested by adding view parameters to an existing gallery code block and verifying the display changes accordingly.

**Acceptance Scenarios**:

1. **Given** a basic gallery is displayed, **When** user adds view: carousel parameter, **Then** images are displayed in a carousel format with navigation controls
2. **Given** a gallery with default thumbnail view, **When** user changes to view: grid, **Then** images are displayed in a responsive grid layout
3. **Given** any gallery view type, **When** user removes the view parameter, **Then** gallery defaults to thumbnail view

---

### User Story 3 - File-Level Gallery Display (Priority: P3)

A user wants to display images from a specific file's content (images linked within that file) rather than an entire folder, allowing them to create curated galleries based on file contents.

**Why this priority**: This provides more granular control and allows users to create themed galleries based on note content rather than folder structure.

**Independent Test**: Can be tested by specifying a file path instead of folder path and verifying that only images linked in that file are displayed.

**Acceptance Scenarios**:

1. **Given** a note contains multiple image links, **When** user specifies path: note.md in gallery code block, **Then** all image links from that note are displayed in the gallery
2. **Given** a file with mixed content including image URLs, **When** gallery processes the file, **Then** both local and external image URLs are displayed
3. **Given** a file with no image content, **When** gallery processes the file, **Then** appropriate empty state is shown

---

### Edge Cases

- What happens when a specified folder or file doesn't exist?
- How does the system handle broken image links or inaccessible URLs?
- How does the system handle external URLs that timeout after 10 seconds?
- What occurs when a folder contains hundreds of images?
- How does the gallery behave with very large image files?
- How does the gallery handle image files exceeding 50MB limit?
- What happens when image formats are unsupported?
- How does the system handle permission issues with external URLs?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST recognize ```obs-gallery code blocks in markdown and render them as interactive galleries using YAML-style parameter syntax
- **FR-002**: System MUST support path parameter to specify target folder or file for image collection (format: path: folder-name)
- **FR-003**: System MUST support view parameter with options: thumbnail (default), carousel, grid (format: view: carousel)
- **FR-004**: System MUST display both local vault images and external URL images with 10-second timeout and retry mechanism
- **FR-005**: System MUST scan specified folders recursively including subdirectories for image files (JPG, PNG, GIF, WebP) up to 50MB file size limit
- **FR-006**: System MUST parse specified files to extract image links and references
- **FR-007**: System MUST provide visual feedback during image loading
- **FR-008**: System MUST handle missing or invalid paths with appropriate error messages
- **FR-009**: System MUST implement lazy loading for large galleries to maintain performance
- **FR-010**: System MUST provide empty state messaging when no images are found
- **FR-011**: System MUST validate and sanitize file paths for security
- **FR-012**: System MUST automatically refresh gallery content when source files or folders change

### Key Entities

- **Gallery Instance**: Represents a rendered gallery within a note, contains configuration parameters and display state
- **Image Source**: Represents an individual image (local file or URL) with metadata like path, dimensions, and loading state
- **Gallery Configuration**: Contains user-specified parameters like path, view type, and display options
- **Content Scanner**: Processes folders and files to identify and extract image references

## Clarifications

### Session 2025-10-21

- Q: Code Block Parameter Syntax → A: YAML-style (path: folder, view: carousel)
- Q: External URL Timeout Handling → A: 10 seconds timeout with retry, then error placeholder
- Q: Folder Scanning Behavior → A: Include subdirectories by default (recursive scanning)
- Q: Image File Size Limits → A: 50MB maximum file size limit
- Q: Gallery Update Behavior → A: Automatically refresh when source files/folders change

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create a functional gallery in under 30 seconds using the code block syntax
- **SC-002**: Gallery displays images from folders containing up to 100 images without noticeable performance degradation
- **SC-003**: Gallery loads and displays first images within 2 seconds for typical folder sizes (10-20 images)
- **SC-004**: 95% of common image formats (JPG, PNG, GIF, WebP) display correctly in all view modes
- **SC-005**: Gallery view switching (thumbnail to carousel) completes in under 1 second
- **SC-006**: System handles broken links gracefully with 100% fallback to error placeholders
- **SC-007**: Gallery remains responsive and functional with folders containing up to 500 images through lazy loading

