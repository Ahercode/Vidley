import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import localforage from 'localforage';

// API URL - change this for production
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Quality options
const QUALITY_OPTIONS = [
  { value: 'best', label: 'Best Quality' },
  { value: 'high', label: 'High (1080p)' },
  { value: 'medium', label: 'Medium (720p)' },
  { value: 'low', label: 'Low (360p)' },
];

// Initialize localforage
localforage.config({
  name: 'vidley',
  storeName: 'downloads',
});

function App() {
  // State
  const [url, setUrl] = useState('');
  const [quality, setQuality] = useState('best');
  const [loading, setLoading] = useState(false);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [videoInfo, setVideoInfo] = useState(null);
  const [downloadHistory, setDownloadHistory] = useState([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Load download history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const history = await localforage.getItem('downloadHistory');
        if (history) {
          setDownloadHistory(history);
        }
      } catch (error) {
        console.error('Failed to load history:', error);
      }
    };
    loadHistory();
  }, []);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Save to history
  const saveToHistory = async (item) => {
    try {
      const newHistory = [
        {
          ...item,
          downloadedAt: new Date().toISOString(),
        },
        ...downloadHistory,
      ].slice(0, 20); // Keep only last 20 items

      await localforage.setItem('downloadHistory', newHistory);
      setDownloadHistory(newHistory);
    } catch (error) {
      console.error('Failed to save history:', error);
    }
  };

  // Clear history
  const clearHistory = async () => {
    try {
      await localforage.removeItem('downloadHistory');
      setDownloadHistory([]);
      setMessage({ type: 'success', text: 'History cleared' });
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  };

  // Get video info
  const getVideoInfo = useCallback(async () => {
    if (!url.trim()) return;

    setLoadingInfo(true);
    setMessage({ type: '', text: '' });
    setVideoInfo(null);

    try {
      const response = await axios.post(`${API_URL}/api/video-info`, {
        url: url.trim(),
      });

      if (response.data.success) {
        setVideoInfo(response.data.data);
      } else {
        setMessage({ type: 'error', text: response.data.error || 'Failed to get video info' });
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to connect to server';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setLoadingInfo(false);
    }
  }, [url]);

  // Auto-fetch video info when URL changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (url.trim() && url.includes('http')) {
        getVideoInfo();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [url, getVideoInfo]);

  // Handle download
  const handleDownload = async () => {
    if (!url.trim()) {
      setMessage({ type: 'error', text: 'Please enter a video URL' });
      return;
    }

    if (!isOnline) {
      setMessage({ type: 'error', text: 'You are offline. Please connect to the internet to download.' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await axios.post(`${API_URL}/api/download`, {
        url: url.trim(),
        quality,
      });

      if (response.data.success) {
        // Open download URL
        window.open(`${API_URL}${response.data.download_url}`, '_blank');

        // Save to history
        await saveToHistory({
          url: url.trim(),
          title: response.data.title,
          filename: response.data.filename,
          duration: response.data.duration,
          quality,
          thumbnail: videoInfo?.thumbnail,
        });

        setMessage({ type: 'success', text: 'Download started! Check your downloads folder.' });
        setUrl('');
        setVideoInfo(null);
      } else {
        setMessage({ type: 'error', text: response.data.error || 'Download failed' });
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to download video';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  // Format duration
  const formatDuration = (seconds) => {
    if (!seconds) return 'Unknown';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-yellow-500 text-white text-center py-2 px-4">
          <span className="inline-flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
            </svg>
            You're offline. Download history is still available.
          </span>
        </div>
      )}

      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Vidley</h1>
                <p className="text-xs sm:text-sm text-gray-500">Download from 1000+ platforms</p>
              </div>
            </div>
            {isOnline && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Online
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        {/* URL Input Card */}
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Paste Video URL
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base"
              disabled={loading}
            />
            <button
              onClick={getVideoInfo}
              disabled={!url.trim() || loadingInfo || !isOnline}
              className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingInfo ? 'Loading...' : 'Preview'}
            </button>
          </div>

          {/* Quality Selector */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quality
            </label>
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
              className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              disabled={loading}
            >
              {QUALITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Message */}
        {message.text && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === 'error'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-green-50 text-green-700 border border-green-200'
            }`}
          >
            <div className="flex items-center">
              {message.type === 'error' ? (
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {message.text}
            </div>
          </div>
        )}

        {/* Video Preview Card */}
        {videoInfo && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
            <div className="flex flex-col sm:flex-row">
              {/* Thumbnail */}
              {videoInfo.thumbnail && (
                <div className="sm:w-64 flex-shrink-0">
                  <img
                    src={videoInfo.thumbnail}
                    alt={videoInfo.title}
                    className="w-full h-48 sm:h-full object-cover"
                  />
                </div>
              )}

              {/* Info */}
              <div className="flex-1 p-4 sm:p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                  {videoInfo.title}
                </h3>

                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  {videoInfo.uploader && (
                    <p className="flex items-center">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {videoInfo.uploader}
                    </p>
                  )}
                  {videoInfo.duration && (
                    <p className="flex items-center">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {formatDuration(videoInfo.duration)}
                    </p>
                  )}
                  {videoInfo.extractor && (
                    <p className="flex items-center">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                      {videoInfo.extractor}
                    </p>
                  )}
                </div>

                <button
                  onClick={handleDownload}
                  disabled={loading || !isOnline}
                  className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Downloading...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download Video
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Download History */}
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Download History</h2>
            {downloadHistory.length > 0 && (
              <button
                onClick={clearHistory}
                className="text-sm text-red-600 hover:text-red-700 transition-colors"
              >
                Clear All
              </button>
            )}
          </div>

          {downloadHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p>No downloads yet</p>
              <p className="text-sm mt-1">Your download history will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {downloadHistory.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  {/* Thumbnail */}
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-16 h-12 object-cover rounded flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-12 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  )}

                  {/* Info */}
                  <div className="ml-3 flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.title || 'Unknown Title'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(item.downloadedAt)} • {item.quality?.toUpperCase() || 'BEST'}
                      {item.duration && ` • ${formatDuration(item.duration)}`}
                    </p>
                  </div>

                  {/* Status Icon */}
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Disclaimer */}
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-xs text-yellow-800">
            <strong>Disclaimer:</strong> This tool is provided for downloading videos you own or have permission to download.
            Users are solely responsible for complying with copyright laws and platform Terms of Service.
            We do not condone piracy or copyright infringement.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-8">
        <div className="max-w-4xl mx-auto px-4 py-4 text-center text-sm text-gray-500">
          <p>Vidley - Video Downloader PWA</p>
          <p className="mt-1">Supports YouTube, TikTok, Instagram, Vimeo, and 1000+ more platforms</p>
        </div>
      </footer>
    </div>
  );
}

export default App;

