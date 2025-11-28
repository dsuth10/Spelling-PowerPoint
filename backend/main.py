from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Form
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import shutil
import os
import sys
import csv
from datetime import datetime
import tempfile

# Add parent directory to path to import create_presentation
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from create_presentation import create_presentation, create_presentation_from_data
from backend.llm_service import get_word_data, get_ollama_models
import backend.job_manager as job_manager

app = FastAPI()

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure generated directory exists
GENERATED_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "generated_presentations")
os.makedirs(GENERATED_DIR, exist_ok=True)

class WordRequest(BaseModel):
    word: str
    definition: Optional[str] = ""
    sentence: Optional[str] = ""
    etymology: Optional[str] = ""
    morphology: Optional[str] = ""
    synonyms: Optional[str] = ""
    api_key: Optional[str] = ""
    provider: Optional[str] = "openrouter" # openrouter or ollama
    model: Optional[str] = ""

@app.get("/")
async def root():
    return {"message": "Spelling PowerPoint API is running"}

@app.get("/models")
async def get_models():
    """Returns list of available Ollama models."""
    return get_ollama_models()

def process_batch_job(job_id: str, temp_csv_path: str, provider: str, api_key: str, model: str):
    """Background task to process the CSV and generate files."""
    try:
        # Create a job-specific directory
        job_dir = os.path.join(GENERATED_DIR, job_id)
        os.makedirs(job_dir, exist_ok=True)
        
        words = []
        with open(temp_csv_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            if not reader.fieldnames or 'Word' not in reader.fieldnames:
                job_manager.fail_job(job_id, "CSV must contain a 'Word' column.")
                return
            for row in reader:
                if 'Word' in row and row['Word'].strip():
                    words.append(row['Word'].strip())
        
        if not words:
            job_manager.fail_job(job_id, "No words found in CSV.")
            return

        # Update job with total count
        job_manager.set_total_items(job_id, len(words))
        
        for word in words:
            print(f"Job {job_id}: Processing {word}...")
            try:
                # 1. Get AI Data
                ai_data = get_word_data(
                    word=word, 
                    api_key=api_key, 
                    provider=provider, 
                    model=model
                )
                word_info = {"word": word}
                word_info.update(ai_data)
                
                # 2. Generate PPTX
                safe_word = "".join([c for c in word if c.isalpha() or c.isdigit() or c==' ']).rstrip()
                filename = f"{safe_word}.pptx"
                output_path = os.path.join(job_dir, filename)
                
                create_presentation_from_data(word_info, output_path)
                
                # 3. Update Job Status
                job_manager.update_job_progress(job_id, word, filename)
                
            except Exception as e:
                print(f"Job {job_id}: Failed for {word}: {e}")
                job_manager.update_job_progress(job_id, word, error=str(e))
                
    except Exception as e:
        print(f"Job {job_id} failed completely: {e}")
        job_manager.fail_job(job_id, str(e))
    finally:
        # Cleanup temp CSV
        if os.path.exists(temp_csv_path):
            os.remove(temp_csv_path)
        # Remove temp directory if it exists
        temp_dir = os.path.dirname(temp_csv_path)
        if os.path.isdir(temp_dir):
            try:
                os.rmdir(temp_dir)
            except OSError:
                # Directory not empty or cannot remove; ignore
                pass

@app.post("/api/batch/upload")
async def upload_batch(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    provider: str = Form("openrouter"),
    api_key: Optional[str] = Form(None),
    model: Optional[str] = Form(None)
):
    # Create Job early so we can scope temp storage
    job_id = job_manager.create_job()

    # Save uploaded file temporarily in an isolated temp dir
    temp_dir = tempfile.mkdtemp(prefix=f"batch_{job_id}_")
    temp_csv = os.path.join(temp_dir, file.filename)
    with open(temp_csv, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Start Background Task
    background_tasks.add_task(process_batch_job, job_id, temp_csv, provider, api_key, model)
    
    return {"job_id": job_id}

@app.get("/api/batch/{job_id}/status")
async def get_job_status(job_id: str):
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@app.get("/api/download/{job_id}/{filename}")
async def download_file(job_id: str, filename: str):
    file_path = os.path.join(GENERATED_DIR, job_id, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(file_path, filename=filename)

# Keep the old single-word endpoint for compatibility/testing
@app.post("/generate-word")
async def generate_word(request: WordRequest):
    output_pptx = f"Generated_{request.word}.pptx"
    
    try:
        word_data = request.dict()
        
        use_ai = False
        if request.provider == "ollama":
            use_ai = True
        elif request.provider == "openrouter" and request.api_key:
            use_ai = True
            
        if use_ai and not request.definition:
            print(f"Generating content for {request.word} using {request.provider}...")
            ai_data = get_word_data(
                word=request.word, 
                api_key=request.api_key, 
                provider=request.provider, 
                model=request.model
            )
            word_data.update(ai_data)
            
        create_presentation_from_data(word_data, output_pptx)
        return FileResponse(output_pptx, media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation", filename=output_pptx)
    
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
