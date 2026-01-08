# Vidley - Video Downloader PWA

A Progressive Web App that allows users to download videos from 1000+ platforms including YouTube, TikTok, Instagram, Vimeo, and more.

## Features

- ✅ Paste any video URL and download
- ✅ Support 1000+ platforms
- ✅ Video preview before downloading
- ✅ Quality selection (Best, 1080p, 720p, 360p)
- ✅ Download history (stored locally, works offline)
- ✅ Installable as app on any device
- ✅ Offline support
- ✅ Auto-cleanup old files (after 1 hour)
- ✅ Mobile-responsive design

## Tech Stack

- **Backend**: FastAPI (Python) with yt-dlp
- **Frontend**: React PWA with Tailwind CSS
- **Storage**: IndexedDB (localforage) for offline history

## Quick Start

### 🐳 Using Docker (Recommended)

The easiest way to run Vidley:

```bash
# Start both backend and frontend
docker-compose up --build

# Or run in background
docker-compose up -d --build
```

The app will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

To stop:
```bash
docker-compose down
```

#### Development Mode (with hot reload)

```bash
docker-compose -f docker-compose.dev.yml up --build
```

---

### Manual Setup (without Docker)

#### Prerequisites

- Python 3.9+
- Node.js 18+
- yarn

#### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. 
API documentation is at `http://localhost:8000/docs`.

#### Frontend Setup

```bash
cd frontend

# Install dependencies
yarn install

# Start development server
yarn start
```

The app will be available at `http://localhost:3000`.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/video-info` | POST | Get video metadata (title, thumbnail, duration) |
| `/api/download` | POST | Download video and get download URL |
| `/api/files/{filename}` | GET | Serve downloaded file |

### Example Request

```bash
# Get video info
curl -X POST http://localhost:8000/api/video-info \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'

# Download video
curl -X POST http://localhost:8000/api/download \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "quality": "high"}'
```

## PWA Installation

The app can be installed as a Progressive Web App:

1. Open the app in Chrome/Safari
2. Look for the "Install" prompt or use the browser menu
3. The app will appear on your home screen

## Environment Variables

### Backend (.env)

```
PORT=8000
DOWNLOAD_DIR=./downloads
MAX_FILE_SIZE=500
FILE_CLEANUP_HOURS=1
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
```

### Frontend (.env)

```
REACT_APP_API_URL=http://localhost:8000
REACT_APP_APP_NAME=Vidley
```

## Deployment

### Backend (Railway/Render)

1. Create a `Procfile`:
   ```
   web: uvicorn main:app --host 0.0.0.0 --port $PORT
   ```

2. Deploy to Railway/Render with the GitHub repo

### Frontend (Vercel)

1. Build: `yarn build`
2. Deploy: `vercel --prod`
3. Update `REACT_APP_API_URL` to production backend URL

## Legal Disclaimer

This tool is provided for downloading videos you own or have permission to download. Users are solely responsible for complying with copyright laws and platform Terms of Service. We do not condone piracy or copyright infringement.

## License

MIT

