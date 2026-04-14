FROM python:3.11-slim

# Set environment variables to prevent Python from writing .pyc files
# and to ensure stdout and stderr are unbuffered.
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install dependencies first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire project
COPY . .

# Expose port 8000
EXPOSE 8000

# Start unified FastAPI + Static Frontend layer
CMD ["uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8000"]
