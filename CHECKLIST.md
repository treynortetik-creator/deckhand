# Deckhand Development Checklist

## User Stories

### US-001: Upload and Extract Brand Guidelines
**Dependencies:** None (foundational)

- [ ] Upload brand guide PDF via admin panel
- [ ] AI extracts primary/secondary colors with hex codes
- [ ] AI extracts font families and usage rules
- [ ] AI extracts logo usage guidelines
- [ ] Extracted brand data stored in database with proper schema
- [ ] View/edit extracted brand guidelines in admin panel
- [ ] Typecheck/lint passes

---

### US-002: Manage Content Asset Library
**Dependencies:** None (foundational)

- [ ] Upload images (PNG, JPG, SVG) with drag-and-drop or file picker
- [ ] Upload documents (PDF, DOCX) for text extraction
- [ ] Preview uploaded assets in library view
- [ ] Delete assets from library
- [ ] Tag assets with categories/keywords
- [ ] Assets stored in database with metadata (filename, type, upload date, size)
- [ ] Typecheck/lint passes

---

### US-003: Create and Manage Deck Templates
**Dependencies:** US-001 (brand guidelines for template styling)

- [ ] Create template with name, description, and slide structure
- [ ] Define slide placeholders (title, content, image positions)
- [ ] Save template to database
- [ ] Edit existing templates
- [ ] Delete templates
- [ ] Preview template structure
- [ ] MVP: Start with 1-2 core templates (pitch deck, event recap)
- [ ] Typecheck/lint passes

---

### US-004: Manage System Prompts and Model Selection
**Dependencies:** None (foundational for AI features)

- [ ] Edit system prompt for deck generation in admin panel
- [ ] Edit system prompt for content generation agents
- [ ] Select AI model from OpenRouter options (dropdown with model names, pricing)
- [ ] Select image generation model (Nana Banana variants via OpenRouter)
- [ ] Save prompt/model changes to database
- [ ] Changes apply to next generation (no restart required)
- [ ] Display current model pricing in UI
- [ ] Typecheck/lint passes

---

### US-005: Create Deck with Simple Form
**Dependencies:** US-001, US-002, US-003, US-004, US-007, US-009

- [ ] Text area for deck description/prompt
- [ ] Optional: Template selector dropdown
- [ ] Optional: Upload additional files for this deck only
- [ ] "Generate Deck" button
- [ ] Show loading state with progress updates
- [ ] Display link to generated Google Slides
- [ ] Provide PPTX download link
- [ ] Typecheck/lint passes

---

### US-006: Create Deck with Advanced Wizard
**Dependencies:** US-001, US-002, US-003, US-004, US-007, US-009

- [ ] Step 1: Choose template or start from scratch
- [ ] Step 2: Describe deck purpose and key messages
- [ ] Step 3: Select specific assets from library to prioritize
- [ ] Step 4: Configure slide count, tone, visual style
- [ ] Step 5: Review and generate
- [ ] Back/forward navigation between steps
- [ ] Progress indicator showing current step
- [ ] Generate deck from wizard parameters
- [ ] Typecheck/lint passes

---

### US-007: Parallel Content Generation Architecture
**Dependencies:** US-004 (AI models/prompts)

- [ ] Orchestration agent creates deck outline (slide titles, structure, flow)
- [ ] Content agents generate slide content in parallel (title, body, image selections, image prompts)
- [ ] Each content agent handles 1-2 slides
- [ ] Assembly agent receives all content and creates slides sequentially via Google Slides API
- [ ] Error handling: If content agent fails, retry or skip that slide
- [ ] Progress updates show which slides are being processed
- [ ] Total generation time < 60 seconds for 10-slide deck
- [ ] Typecheck/lint passes

---

### US-008: Generate Images with Nana Banana
**Dependencies:** US-004 (image generation model config), US-007 (content agents create prompts)

- [ ] Content agents create image prompts based on slide content
- [ ] Call Nana Banana API via OpenRouter with prompts
- [ ] Generate backgrounds, hero images, icons, and illustrations
- [ ] Generated images embedded in slides at appropriate positions
- [ ] Handle API failures gracefully (use placeholder or skip image)
- [ ] Store generated images in asset library for reuse
- [ ] Typecheck/lint passes

---

### US-009: Export to Google Slides
**Dependencies:** US-001 (brand), US-007 (parallel generation)

- [ ] Create new Google Slides presentation via API
- [ ] Set presentation title from user input or AI suggestion
- [ ] Create slides sequentially via batchUpdate requests
- [ ] Insert text with proper formatting (bold, bullets, alignment)
- [ ] Insert images from URLs (asset library or generated)
- [ ] Apply SafelyYou brand colors and fonts
- [ ] Return shareable Google Slides URL
- [ ] Slides are editable by user's Google account
- [ ] Typecheck/lint passes

---

### US-010: Export to PowerPoint (PPTX)
**Dependencies:** US-001 (brand), US-007 (parallel generation)

- [ ] Use `/mnt/skills/public/pptx/SKILL.md` for PPTX generation
- [ ] Generate PPTX file with same content as Google Slides version
- [ ] Preserve formatting, fonts, colors, images
- [ ] Provide download link for PPTX file
- [ ] File opens correctly in PowerPoint and Google Slides
- [ ] Brand colors and fonts applied correctly
- [ ] Typecheck/lint passes

---

### US-011: Prompt Library (CRUD)
**Dependencies:** US-014 (auth for user association)

- [ ] Save prompt with name and description
- [ ] View list of saved prompts
- [ ] Edit saved prompts
- [ ] Delete prompts
- [ ] Use saved prompt by clicking "Use This Prompt"
- [ ] Prompts stored in database
- [ ] Typecheck/lint passes

---

### US-012: Prompt History and Learning
**Dependencies:** US-005/US-006 (deck generation to log)

- [ ] Log every deck generation: prompt, template, assets used, model, timestamp
- [ ] Store association to generated deck (Google Slides URL, PPTX path)
- [ ] View history of generated decks with prompts
- [ ] Filter history by date, template, model
- [ ] Copy prompt from history to create similar deck
- [ ] History stored in database
- [ ] Typecheck/lint passes

---

### US-013: Deck Versioning
**Dependencies:** US-005/US-006 (deck generation), US-012 (history)

- [ ] Auto-save each deck generation as a version
- [ ] Version includes: timestamp, prompt, model, assets used
- [ ] View list of versions for a deck concept
- [ ] Compare two versions side-by-side (links to both)
- [ ] Rollback: Regenerate from previous version's parameters
- [ ] Versions stored in database with foreign key to original deck
- [ ] Typecheck/lint passes

---

### US-014: Authentication and User Management
**Dependencies:** None (foundational)

- [ ] Basic authentication (username/password or Google OAuth)
- [ ] All users have same permissions (no role differentiation for MVP)
- [ ] Admin panel accessible to all authenticated users
- [ ] Session management (stay logged in)
- [ ] Logout functionality
- [ ] Typecheck/lint passes

---

## Functional Requirements

### Content Management
| # | Requirement | MVP | Status |
|---|-------------|-----|--------|
| FR-1 | Store brand guidelines (colors, fonts, logos, usage rules) extracted from PDF uploads | ✅ Critical | ☐ |
| FR-2 | Support uploading images (PNG, JPG, SVG) up to 10MB each | ✅ Critical | ☐ |
| FR-3 | Support uploading documents (PDF, DOCX) for text extraction | ✅ Critical | ☐ |
| FR-4 | Allow users to delete assets from the library | ✅ Critical | ☐ |
| FR-5 | Tag assets with metadata (filename, type, upload date, size, user-defined tags) | ✅ Critical | ☐ |

### Template Management
| # | Requirement | MVP | Status |
|---|-------------|-----|--------|
| FR-6 | Store deck templates with slide structure and placeholder definitions | ✅ Critical | ☐ |
| FR-7 | Allow CRUD operations on templates (create, read, update, delete) | ✅ Critical | ☐ |
| FR-8 | Templates must define slide types (title slide, content slide, image slide, etc.) | ✅ Critical | ☐ |
| FR-9 | Ship with 1-2 starter templates (pitch deck, event recap) | ✅ Critical | ☐ |

### AI Generation
| # | Requirement | MVP | Status |
|---|-------------|-----|--------|
| FR-10 | Use OpenRouter API for AI model access (Claude, GPT, etc.) | ✅ Critical | ☐ |
| FR-11 | Support configurable system prompts for deck and content generation | ✅ Critical | ☐ |
| FR-12 | Implement parallel content generation architecture (orchestration → parallel content → assembly) | ✅ Critical | ☐ |
| FR-13 | Generate images via Nana Banana API for backgrounds, icons, illustrations, data viz | ⚠️ Nice-to-have | ☐ |
| FR-14 | Handle API failures gracefully (retry, fallback, skip) | ✅ Critical | ☐ |

### Deck Generation Workflows
| # | Requirement | MVP | Status |
|---|-------------|-----|--------|
| FR-15 | Provide simple form interface (prompt + optional template selection) | ✅ Critical | ☐ |
| FR-16 | Provide advanced wizard interface (multi-step configuration) | ⚠️ Nice-to-have | ☐ |
| FR-17 | Show real-time progress updates during generation | ✅ Critical | ☐ |
| FR-18 | Complete generation in under 60 seconds for 10-slide deck | ✅ Critical | ☐ |

### Output Formats
| # | Requirement | MVP | Status |
|---|-------------|-----|--------|
| FR-19 | Export to Google Slides via Google Slides API | ✅ Critical | ☐ |
| FR-20 | Export to PPTX format using `/mnt/skills/public/pptx/SKILL.md` | ✅ Critical | ☐ |
| FR-21 | Both formats must preserve formatting, brand colors, fonts, and images | ✅ Critical | ☐ |
| FR-22 | Return shareable links for Google Slides | ✅ Critical | ☐ |
| FR-23 | Provide download links for PPTX files | ✅ Critical | ☐ |

### Prompt Management
| # | Requirement | MVP | Status |
|---|-------------|-----|--------|
| FR-24 | Allow users to save prompts with name and description | ⚠️ Nice-to-have | ☐ |
| FR-25 | Support CRUD operations on saved prompts | ⚠️ Nice-to-have | ☐ |
| FR-26 | Log all prompts and generation parameters for history | ✅ Critical | ☐ |
| FR-27 | Users must be able to reuse prompts from library or history | ⚠️ Nice-to-have | ☐ |

### Versioning
| # | Requirement | MVP | Status |
|---|-------------|-----|--------|
| FR-28 | Auto-save each deck generation as a version | ⚠️ Nice-to-have | ☐ |
| FR-29 | View all versions of a deck concept | ⚠️ Nice-to-have | ☐ |
| FR-30 | Compare two versions side-by-side | ⚠️ Nice-to-have | ☐ |
| FR-31 | Regenerate from previous version parameters | ⚠️ Nice-to-have | ☐ |

### Admin Panel
| # | Requirement | MVP | Status |
|---|-------------|-----|--------|
| FR-32 | Allow editing system prompts (deck generation, content generation) | ✅ Critical | ☐ |
| FR-33 | Allow selecting AI models from OpenRouter options | ✅ Critical | ☐ |
| FR-34 | Display current model pricing | ⚠️ Nice-to-have | ☐ |
| FR-35 | Show/edit extracted brand guidelines | ✅ Critical | ☐ |
| FR-36 | All authenticated users have access to admin panel | ✅ Critical | ☐ |

### Authentication
| # | Requirement | MVP | Status |
|---|-------------|-----|--------|
| FR-37 | Require authentication (username/password or Google OAuth) | ✅ Critical | ☐ |
| FR-38 | All authenticated users have identical permissions | ✅ Critical | ☐ |
| FR-39 | Maintain user sessions | ✅ Critical | ☐ |

---

## Summary

### User Stories: 14 total
- **Foundational (no deps):** US-001, US-002, US-004, US-014
- **Core Generation:** US-003, US-005, US-006, US-007, US-008, US-009, US-010
- **Enhancement:** US-011, US-012, US-013

### Functional Requirements: 39 total
- **MVP-Critical:** 27
- **Nice-to-have:** 12

### Recommended Build Order
1. **Phase 1 - Foundation:** US-014 (Auth), US-001 (Brand), US-002 (Assets), US-004 (AI Config)
2. **Phase 2 - Templates:** US-003 (Templates)
3. **Phase 3 - Core Generation:** US-007 (Parallel Gen), US-009 (Google Slides), US-010 (PPTX)
4. **Phase 4 - User Flows:** US-005 (Simple Form), US-008 (Image Gen)
5. **Phase 5 - Advanced:** US-006 (Wizard), US-012 (History)
6. **Phase 6 - Polish:** US-011 (Prompt Library), US-013 (Versioning)
