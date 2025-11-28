import uuid
from datetime import datetime
from typing import Dict, List, Any

# In-memory job store
# Structure:
# {
#     "job_id": {
#         "status": "processing" | "completed" | "failed",
#         "created_at": datetime,
#         "total_items": int,
#         "processed_items": int,
#         "files": [
#             {
#                 "word": str,
#                 "filename": str,
#                 "download_url": str,
#                 "status": "success" | "error",
#                 "error_message": str (optional)
#             }
#         ],
#         "error": str (optional top-level error)
#     }
# }
jobs: Dict[str, Any] = {}

def create_job(total_items: int = 0) -> str:
    """Creates a new job and returns its ID."""
    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "status": "processing",
        "created_at": datetime.now(),
        "total_items": total_items,
        "processed_items": 0,
        "files": [],
        "errors": []
    }
    return job_id

def set_total_items(job_id: str, total_items: int):
    """Sets the total number of items to process for a job."""
    if job_id not in jobs:
        return
    jobs[job_id]["total_items"] = total_items

def get_job(job_id: str) -> Dict[str, Any]:
    """Retrieves job details."""
    return jobs.get(job_id)

def update_job_progress(job_id: str, word: str, filename: str = None, error: str = None):
    """Updates the progress of a job with a new result."""
    if job_id not in jobs:
        return
    
    job = jobs[job_id]
    
    result = {
        "word": word,
        "status": "success" if not error else "error"
    }
    
    if filename:
        result["filename"] = filename
        result["download_url"] = f"/api/download/{job_id}/{filename}"
        
    if error:
        result["error_message"] = error
        job["errors"].append(error)
        
    job["files"].append(result)
    job["processed_items"] += 1
    
    if job["total_items"] and job["processed_items"] >= job["total_items"]:
        job["status"] = "completed"

def fail_job(job_id: str, error_message: str):
    """Marks a job as failed."""
    if job_id in jobs:
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = error_message
