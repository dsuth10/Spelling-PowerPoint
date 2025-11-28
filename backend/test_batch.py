import os
import time
import requests

# Create a dummy CSV
csv_content = "Word\nApple\nBanana"
with open("test_batch.csv", "w") as f:
    f.write(csv_content)

upload_url = "http://localhost:8000/api/batch/upload"
status_url = "http://localhost:8000/api/batch/{job_id}/status"
files = {'file': ('test_batch.csv', open('test_batch.csv', 'rb'), 'text/csv')}
data = {
    'provider': 'ollama',
    'model': 'llama3' # Assuming llama3 exists
}

print("Sending batch request...")
try:
    response = requests.post(upload_url, files=files, data=data)
    if response.status_code != 200:
        print(f"Failed to start batch: {response.status_code}")
        print(response.text)
        raise SystemExit

    job_id = response.json().get("job_id")
    print(f"Job started: {job_id}")

    # Poll for status
    for _ in range(30):
        status_resp = requests.get(status_url.format(job_id=job_id))
        if status_resp.status_code != 200:
            print(f"Failed to fetch status: {status_resp.status_code}")
            print(status_resp.text)
            break
        status_data = status_resp.json()
        print(f"Status: {status_data['status']} ({status_data['processed_items']}/{status_data['total_items']})")
        if status_data["status"] != "processing":
            # Download files
            for file_info in status_data.get("files", []):
                if file_info.get("status") == "success" and file_info.get("download_url"):
                    download_url = f"http://localhost:8000{file_info['download_url']}"
                    file_resp = requests.get(download_url)
                    out_name = file_info.get("filename", "output.pptx")
                    if file_resp.status_code == 200:
                        with open(out_name, "wb") as out_f:
                            out_f.write(file_resp.content)
                        print(f"Saved {out_name}")
                    else:
                        print(f"Failed to download {download_url}")
            break
        time.sleep(1)
except Exception as e:
    print(f"Error: {e}")
finally:
    # Cleanup
    files['file'][1].close()
    if os.path.exists("test_batch.csv"):
        os.remove("test_batch.csv")
