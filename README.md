Spelling PowerPoint Generator
============================

Generate one PowerPoint per spelling word using AI. Upload a CSV of words or submit a single word; the backend creates PPTX files and the frontend shows live download links as each file is ready.

Project Structure
-----------------
- `backend/` – FastAPI service, AI lookup, batch job manager, PPT generation.
- `frontend/` – Vite + React UI for CSV upload, single-word form, live batch progress.
- `create_presentation.py` – PowerPoint slide builder used by the backend.
- `generated_presentations/` – Runtime output directory (created automatically).

Key Endpoints
-------------
- `POST /api/batch/upload` – Upload CSV (`file`), starts a job, returns `job_id`.
- `GET /api/batch/{job_id}/status` – Poll job status; includes per-word download URLs.
- `GET /api/download/{job_id}/{filename}` – Download a generated PPTX.
- `POST /generate-word` – Single-word PPTX generation (legacy/compat).
- `GET /models` – Lists available Ollama models (if running locally).

CSV Format
----------
The backend expects a column named `Word`. Example:
```
Word
Apple
Banana
```
You can use the sample CSV in `frontend/public/sample_spelling_data.csv`.

Prerequisites
-------------
- Python 3.10+ (for the backend)
- Node.js 18+ (for the frontend)
- (Optional) Running Ollama with at least one model, if you choose the Ollama provider
- OpenRouter API key, if you choose the OpenRouter provider

Backend Setup (no virtualenv required)
--------------------------------------
1) Install dependencies directly on your Python installation:
```
cd backend
pip install -r requirements.txt
```
2) Start the API:
```
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Frontend Setup
--------------
1) Install dependencies:
```
cd frontend
npm install
```
2) Run the dev server:
```
npm run dev
```
Vite will print the local URL (default `http://localhost:5173`). The frontend is already configured to call the backend at `http://localhost:8000`.

Usage Flow
----------
- Open the frontend in your browser.
- Choose a provider (OpenRouter with API key, or Ollama with a local model).
- For CSV mode: upload a CSV with a `Word` column. The UI starts a batch job, polls status, and shows download links as each PPTX finishes.
- For single-word mode: fill the word (and optional fields if not using AI) and download the generated PPTX.

Output Location and Cleanup
---------------------------
- Files are written to `generated_presentations/<job_id>/` on the backend.
- There is no automatic cleanup; periodically delete old job folders if needed.

Troubleshooting
---------------
- If Ollama models are not listed, ensure Ollama is running and has models pulled.
- If OpenRouter requests fail, verify the API key and network access.
- If CSV uploads fail, confirm the file has a `Word` header and at least one row.
