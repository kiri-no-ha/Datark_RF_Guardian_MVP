Set-Location "$PSScriptRoot\rf-engine"
if (-not (Test-Path .venv)) { py -m venv .venv }
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt
& .\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
