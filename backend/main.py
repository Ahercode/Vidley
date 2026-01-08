import os
import uuid
import asyncio
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, HttpUrl
from dotenv import load_dotenv
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import yt_dlp

# Load environment variables
load_dotenv()

# Configuration
PORT = int(os.getenv("PORT", 8000))
DOWNLOAD_DIR = Path(os.getenv("DOWNLOAD_DIR", "./downloads"))
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE", 500))  # MB
FILE_CLEANUP_HOURS = int(os.getenv("FILE_CLEANUP_HOURS", 1))
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

# Ensure download directory exists
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Rate limiter setup
limiter = Limiter(key_func=get_remote_address)


# Background task for file cleanup
async def cleanup_old_files():
    """Delete files older than FILE_CLEANUP_HOURS"""
    while True:
        try:
            cutoff_time = datetime.now() - timedelta(hours=FILE_CLEANUP_HOURS)
            for file_path in DOWNLOAD_DIR.glob("*"):
                if file_path.is_file():
                    file_mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
                    if file_mtime < cutoff_time:
                        file_path.unlink()
                        print(f"Cleaned up: {file_path.name}")
        except Exception as e:
            print(f"Cleanup error: {e}")
        await asyncio.sleep(300)  # Check every 5 minutes


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown events"""
    # Start cleanup task
    cleanup_task = asyncio.create_task(cleanup_old_files())
    yield
    # Cancel cleanup task on shutdown
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass


# FastAPI app
app = FastAPI(
    title="Video Downloader API",
    description="Download videos from 1000+ platforms",
    version="1.0.0",
    lifespan=lifespan
)

# Add rate limit exception handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic models
class DownloadRequest(BaseModel):
    url: HttpUrl
    quality: Optional[str] = "best"


class VideoInfoResponse(BaseModel):
    success: bool
    data: Optional[dict] = None
    error: Optional[str] = None


class DownloadResponse(BaseModel):
    success: bool
    download_url: Optional[str] = None
    filename: Optional[str] = None
    title: Optional[str] = None
    duration: Optional[float] = None
    filesize: Optional[int] = None
    error: Optional[str] = None


# Quality format mapping
QUALITY_FORMATS = {
    "best": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
    "high": "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best[height<=1080]",
    "medium": "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]",
    "low": "bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360][ext=mp4]/best[height<=360]",
}


def get_yt_dlp_options(quality: str = "best", download: bool = False, output_path: str = None):
    """Get yt-dlp options based on quality and download mode"""
    options = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": False,
    }

    if download:
        options.update({
            "format": QUALITY_FORMATS.get(quality, QUALITY_FORMATS["best"]),
            "outtmpl": output_path,
            "merge_output_format": "mp4",
        })

    return options


@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "ok", "message": "Video Downloader API is running"}


@app.post("/api/video-info", response_model=VideoInfoResponse)
@limiter.limit("10/minute")
async def get_video_info(request: Request, download_request: DownloadRequest):
    """Get video metadata without downloading"""
    try:
        url = str(download_request.url)

        # Simple options - matching working Django implementation
        ydl_opts = {
            "format": "best",
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)

            # Extract relevant info
            video_data = {
                "title": info.get("title", "Unknown Title"),
                "thumbnail": info.get("thumbnail"),
                "duration": info.get("duration"),
                "uploader": info.get("uploader", info.get("channel")),
                "view_count": info.get("view_count"),
                "description": info.get("description", "")[:500] if info.get("description") else None,
                "webpage_url": info.get("webpage_url"),
                "extractor": info.get("extractor"),
                "formats_available": bool(info.get("formats")),
            }

            return VideoInfoResponse(success=True, data=video_data)

    except yt_dlp.utils.DownloadError as e:
        error_msg = str(e)
        if "Private video" in error_msg:
            error_msg = "This video is private and cannot be accessed."
        elif "Video unavailable" in error_msg:
            error_msg = "This video is unavailable or has been removed."
        elif "age" in error_msg.lower():
            error_msg = "This video is age-restricted and cannot be downloaded."
        elif "No video formats found" in error_msg:
            error_msg = "No downloadable video found. This may be due to: 1) The video requires login/authentication, 2) Geographic restrictions, 3) The platform has blocked access. Try a different video or platform."
        elif "login" in error_msg.lower() or "sign in" in error_msg.lower():
            error_msg = "This video requires authentication to access. Public videos only."
        return VideoInfoResponse(success=False, error=error_msg)
    except Exception as e:
        return VideoInfoResponse(success=False, error=f"Failed to get video info: {str(e)}")


@app.post("/api/download", response_model=DownloadResponse)
@limiter.limit("5/minute")
async def download_video(request: Request, download_request: DownloadRequest):
    """Download video and return download URL"""
    try:
        url = str(download_request.url)
        quality = download_request.quality or "best"

        # Generate unique filename
        file_id = str(uuid.uuid4())[:8]
        output_template = str(DOWNLOAD_DIR / f"{file_id}_%(title)s.%(ext)s")

        # Simple options matching the working Django implementation
        ydl_opts = {
            "format": "best",
            "outtmpl": output_template,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            file_name = ydl.prepare_filename(info)

            # Check if file exists
            downloaded_file = Path(file_name)
            if not downloaded_file.exists():
                # Try to find the file with the file_id prefix
                for file_path in DOWNLOAD_DIR.glob(f"{file_id}_*"):
                    downloaded_file = file_path
                    break

            if not downloaded_file.exists():
                return DownloadResponse(success=False, error="Download completed but file not found")

            filename = downloaded_file.name
            filesize = downloaded_file.stat().st_size

            return DownloadResponse(
                success=True,
                download_url=f"/api/files/{filename}",
                filename=filename,
                title=info.get("title", "Unknown"),
                duration=info.get("duration"),
                filesize=filesize,
            )

    except yt_dlp.utils.DownloadError as e:
        error_msg = str(e)
        if "Private video" in error_msg:
            error_msg = "This video is private and cannot be downloaded."
        elif "Video unavailable" in error_msg:
            error_msg = "This video is unavailable or has been removed."
        elif "age" in error_msg.lower():
            error_msg = "This video is age-restricted and cannot be downloaded."
        elif "file is larger" in error_msg.lower():
            error_msg = f"Video exceeds maximum file size of {MAX_FILE_SIZE}MB."
        elif "No video formats found" in error_msg:
            error_msg = "No downloadable video found. This may be due to: 1) The video requires login/authentication, 2) Geographic restrictions, 3) The platform has blocked access. Try a different video or platform."
        elif "login" in error_msg.lower() or "sign in" in error_msg.lower():
            error_msg = "This video requires authentication to access. Public videos only."
        return DownloadResponse(success=False, error=error_msg)
    except Exception as e:
        return DownloadResponse(success=False, error=f"Download failed: {str(e)}")


@app.get("/api/files/{filename}")
async def get_file(filename: str):
    """Serve downloaded file"""
    # Sanitize filename to prevent directory traversal
    safe_filename = Path(filename).name
    file_path = DOWNLOAD_DIR / safe_filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    if not file_path.is_file():
        raise HTTPException(status_code=400, detail="Invalid file")

    # Get content type based on extension
    content_type = "video/mp4"
    if safe_filename.endswith(".webm"):
        content_type = "video/webm"
    elif safe_filename.endswith(".mkv"):
        content_type = "video/x-matroska"

    return FileResponse(
        path=file_path,
        filename=safe_filename,
        media_type=content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{safe_filename}"'
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)

