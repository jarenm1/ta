# Canvas MCP Server

This server exposes Canvas LMS course data to an MCP client so an agent can build structured study guides from the full course context.

## What it exposes

- `list_courses`
- `get_course_snapshot`
- `get_course_knowledge_base`
- `get_file_text`
- `create_study_guide`
- `create_coding_problem`
- `create_quiz`
- `bulk_download_files`

It also exposes resource templates for:

- `canvas://course/{courseId}/snapshot`
- `canvas://course/{courseId}/knowledge-base`
- `canvas://course/{courseId}/study-guide`
- `canvas://course/{courseId}/coding-problem`
- `canvas://course/{courseId}/quiz`

Uploaded materials come from the desktop app’s per-course knowledge base. By default, both the app
and MCP server look in `~/.teaching-assistant/course-materials`. Set
`TA_COURSE_MATERIALS_DIR` to override that location.

Raw per-course data can also be merged into the MCP knowledge base. By default, the server scans
`~/.teaching-assistant/data/courses` and tries to match folders by course id, course code, or a
slugified course name such as `cs3358`. Set `TA_RAW_COURSE_DATA_DIR` to override that base path.

If your raw folder names do not match cleanly, set `TA_RAW_COURSE_ALIASES_PATH` to a JSON file that
maps course ids or aliases to folder names. Example:

```json
{
  "2622272": ["cs3358", "data-structures"],
  "cs3358": ["cs3358"]
}
```

Saved study guides live in `~/.teaching-assistant/study-guides` by default. Set
`TA_COURSE_STUDY_GUIDES_DIR` to override that location.

Saved coding problems live in `~/.teaching-assistant/coding-problems` by default. Set
`TA_COURSE_CODING_PROBLEMS_DIR` to override that location.

Canvas credentials can also be shared automatically from the desktop app. By default, the app writes
the current Canvas session to `~/.teaching-assistant/canvas-session.json`, and the MCP server reads
that file when a tool/resource call does not include an explicit `session`. Set
`TA_CANVAS_SESSION_PATH` to override the shared session file path.

## Session handling

Every tool accepts an optional `session` object:

```json
{
  "endpoint": "https://your-school.instructure.com",
  "token": "canvas-api-token"
}
```

If `session` is omitted, the server first tries the shared desktop-app session file and then falls
back to:

- `CANVAS_API_ENDPOINT`
- `CANVAS_API_TOKEN`

Canvas-backed resources can use the shared desktop-app session file because resource reads do not
carry tool arguments. The local `knowledge-base` resource reads directly from the shared upload
directory.

## Run it

For local desktop-app development, `npm start` now launches both Electron and this MCP server.

```bash
npm run mcp:canvas
```

Or directly:

```bash
CANVAS_API_ENDPOINT="https://your-school.instructure.com" \
CANVAS_API_TOKEN="your-token" \
node ./mcp-server/server.mjs
```

If you already signed into the desktop app, you usually do not need to provide the two Canvas env
vars above.

## Tool contract

### `create_study_guide`

Required input fields:

- `courseId`
- `objective`

Optional fields:

- `title`
- `guideMode` (`walkthrough` or `vocabulary`)
- `sourceScope` (`focused`, `uploaded_only`, or `all`)
- `examDate`
- `availableHours`
- `outputFormat`
- `includeCompletedAssignments`
- `includePlanningSections`
- `session`

Structured output includes:

- `course`
- `overview`
- `summary`
- `key_deadlines`
- `priority_items`
- `topic_clusters`
- `study_blocks`
- `walkthrough_topics`
- `vocabulary_terms`
- `authoring_prompt`
- `source_material`

Study guides automatically include uploaded course materials from the local knowledge base when
they exist.

Two modes are currently supported:

- `walkthrough`: teaching-style topic sections with explanation, worked examples, pitfalls, and
  self-check questions
- `vocabulary`: dense glossary-style exam prep grouped by topic, where each term includes a
  definition, why it matters, one example question, and a short answer outline

Source scoping is now explicit so the agent can stay token-efficient:

- `focused`: use a trimmed subset of the most relevant documents
- `uploaded_only`: prefer the shared local course knowledge base and ignore broad Canvas context
- `all`: use the full enriched snapshot

Planning sections are optional. By default, the guide omits study blocks and deadlines so the tool
can stay content-focused for agents and for the desktop app reader.

Each `create_study_guide` call also saves a Markdown copy into the shared study-guide storage so the
desktop app can list it for the course.

When a newly generated guide has the same title as an existing saved guide for that course, the MCP
save step replaces the older entry instead of keeping duplicate titles in the manifest.

### `get_course_knowledge_base`

Required input fields:

- `courseId`

Optional fields:

- `includeTextContent`
- `maxTextChars`
- `courseCode`
- `courseName`

Structured output includes:

- `summary`
- `materials`
- `storage_directory`
- `raw_storage_directory`
- extracted `text_content` for text-like uploads when available

The MCP server merges:

- uploaded files from the shared desktop-app knowledge base
- raw local course-data folders matched by course id/code/name or alias map

This is meant to give the agent a stable schema it can transform into final study guides, flashcards, checklists, or review plans.

### `create_coding_problem`

Required input fields:

- `courseId`
- `objective`

Optional fields:

- `title`
- `topicHint`
- `language`
- `difficulty`
- `includeWalkthrough`
- `sourceScope`
- `session`

Structured output includes:

- `generated_at`
- `request`
- `course`
- `problem`
- `source_summary`

Each generated problem includes:

- `title`
- `topic`
- `difficulty`
- `language`
- `description`
- `constraints`
- `examples`
- `starter_code`
- `test_cases`
- `runner_kind`
- `walkthrough`
- `source_refs`

This tool is designed for the app's LeetCode-style workspace. It returns a course-aware practice
problem with starter code, runnable test cases, and a concise explanation grounded in the course
snapshot and local knowledge base.

The `starter_code` field is intentionally a compileable scaffold, not a completed solution. It may
include signatures, class definitions, I/O harness code, and TODO comments, but it should leave the
core algorithm for the learner to implement.

Each `create_coding_problem` call also saves both the structured JSON payload and a Markdown copy
into the shared coding-problem storage so the desktop app workspace can load generated problems.

When a newly generated coding problem has the same title as an existing saved problem for that
course, the MCP save step replaces the older entry instead of keeping duplicate titles in the
manifest.

### `create_quiz`

Required input fields:

- `courseId`

Optional fields:

- `title`
- `objective`
- `questionCount`
- `answerCount`
- `questionTypes`
- `includeExplanations`
- `session`

Structured output includes:

- `course`
- `questions`
- `answer_key`
- `source_summary`

Each question includes:

- `prompt`
- `answer_options`
- `correct_answer`
- `explanation`
- `source_refs`

### `bulk_download_files`

Required input fields:

- `courseId`
- `fileIds` (array of Canvas file IDs)

Optional fields:

- `maxTextChars` (default 12000)
- `maxFileSize` (default 50MB)
- `concurrency` (1-5, default 3)
- `includeTextContent`
- `session`

Structured output includes:

- `courseId`
- `requested` (total files requested)
- `downloaded` (successfully downloaded)
- `saved` (saved to knowledge base)
- `failed` (failed count)
- `materials` (array of downloaded file metadata with extraction info)
- `errors` (array of error details)

This tool downloads multiple files from Canvas, automatically extracts text from binary files (PDFs, Office documents, images), and saves everything to the course knowledge base. The agent can then use `get_course_knowledge_base` to access the extracted content.

## File Extraction Support

The MCP server now extracts text from the following binary file types:

- **PDFs** - Full text extraction with page count metadata
- **Word Documents** (.docx) - Text extraction with formatting notes
- **Excel Spreadsheets** (.xlsx, .xls) - CSV-style text extraction with sheet metadata
- **PowerPoint** (.pptx, .ppt) - Slide-by-slide text extraction
- **Images** (.png, .jpg, .jpeg, .gif, .bmp, .webp, .tiff, .tif) - OCR text extraction with confidence scores

Extracted content is stored alongside metadata in the knowledge base and included in study guides, coding problems, and quizzes.

## Current limitations

- Very large files (configurable limit, default 50MB) are skipped to prevent memory issues
- OCR quality depends on image resolution and clarity
- Some complex PDF layouts may lose formatting during extraction
- Binary files in Canvas must be downloaded via `bulk_download_files` before extraction (raw course data files are auto-extracted)
