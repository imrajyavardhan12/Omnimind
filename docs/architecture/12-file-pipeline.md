# 12 — File and Multimodal Pipeline

## Problem

The current app stores file data as base64 in browser state/localStorage and mostly only sends image attachments to providers.

This does not scale for production.

## Goals

File support should be:

- Durable.
- Storage-efficient.
- Provider-aware.
- Secure.
- Extractable.
- Auditable.

## Supported File Categories

Initial v2:

```txt
Images:    jpeg, png, gif, webp
Text:      txt, md, csv, json
PDF:       pdf
Documents: docx
Audio:     mp3, wav, m4a
```

Future:

```txt
Video: mp4, mov
Archives: zip
Spreadsheets: xlsx
```

## Storage Strategy

Do not store file payloads in Postgres or localStorage.

Use Cloudflare R2:

```txt
Cloudflare R2
```

Postgres stores metadata and R2 object keys.

## Upload Flow

```txt
1. User selects file.
2. Client requests upload URL from API.
3. API validates filename, MIME type, size, workspace quota.
4. API creates `files` row with status uploaded/pending.
5. Client uploads directly to Cloudflare R2 using the signed URL.
6. Client notifies API upload completed.
7. Worker starts extraction if needed.
```

## File Table

See [Data Model](./10-data-model.md).

Important fields:

```txt
storage_bucket
storage_key
mime_type
size_bytes
sha256
status
metadata_json
```

## Extraction Pipeline

```txt
file uploaded
  → extraction job queued
  → extractor chooses strategy by MIME type
  → extracted text/metadata stored
  → file status updated to ready
```

## Extraction Strategies

### Images

- Store original image.
- Generate thumbnail if needed.
- For vision-capable models, pass image reference or provider-compatible payload.
- Optional OCR for non-vision models.

### PDF

- Extract text using a PDF parser.
- If scanned PDF, use OCR.
- Store extracted text separately.

### DOCX

- Extract text.
- Preserve basic document metadata.

### Text/Markdown/CSV/JSON

- Validate encoding.
- Store extracted text directly.

### Audio

- Transcribe with Whisper or equivalent.
- Store transcript.

### Video

Future:

- Extract audio.
- Transcribe.
- Optional keyframes.

## Attachment to Chat Runs

Chat run input should include file IDs, not raw file data.

```json
{
  "input": {
    "text": "Summarize this.",
    "attachmentIds": ["file_123"]
  }
}
```

The backend prepares provider-specific inputs.

## Provider Preparation

For each model, the LLM Gateway determines what to do:

```txt
vision model + image       → send image
non-vision model + image   → send OCR/caption if available
PDF/doc model unsupported  → send extracted text
text file                  → include text with truncation/chunking
large file                 → use retrieval/chunk selection
```

## Context Management

Never blindly insert entire large files into context.

Use:

- Token estimation.
- Chunking.
- Summaries.
- Top-k retrieval later.
- User-visible warning if file is too large.

## Security

File service must enforce:

- Authenticated access.
- Workspace ownership.
- MIME allowlist.
- File size limits.
- Virus/malware scanning when needed.
- No public Cloudflare R2 buckets by default.
- Signed URLs with short expiry.

## File Size Defaults

Suggested initial limits:

```txt
Max single file: 25 MB
Max files per message: 10
Max total per message: 50 MB
Workspace storage quota: plan-based
```

## Retention

Default behavior:

- Files remain until conversation or file is deleted.
- Deleted files are soft-deleted first.
- Storage cleanup job removes objects after retention window.

## Future RAG Path

For large documents:

```txt
extracted text → chunking → embeddings → pgvector → retrieval during chat
```

Start with Postgres + pgvector before introducing a dedicated vector database.
