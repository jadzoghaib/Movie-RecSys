# Hugging Face Space (Docker SDK) — CineMatch FastAPI backend.
# Builds by cloning the public GitHub repo, so the Space itself only needs this
# Dockerfile + README.md (no data files to copy, no Git-LFS).
FROM python:3.12-slim

# git: clone the repo at build time.  libgomp1: OpenMP runtime required by lightgbm.
RUN apt-get update \
 && apt-get install -y --no-install-recommends git libgomp1 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN git clone --depth 1 https://github.com/jadzoghaib/Movie-RecSys.git .

WORKDIR /app/backend
RUN pip install --no-cache-dir -r requirements.txt

# Hugging Face Spaces route HTTP traffic to port 7860.
EXPOSE 7860
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "7860"]
