import os
import time
import shutil
import logging
import yt_dlp
from apps.YTDownloader.backend.config import settings

logger = logging.getLogger("ytdlp_engine")

class YTDLPEngine:
    def __init__(self):
        self.downloads_dir = settings.DOWNLOADS_DIR
        self._setup_ffmpeg_path()

    def _setup_ffmpeg_path(self):
        if os.name == 'nt':
            winget_ffmpeg = os.path.join(os.environ.get('USERPROFILE', ''), 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages', 'Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe', 'ffmpeg-8.0.1-full_build', 'bin')
            current_path = os.environ.get('PATH', '')
            if os.path.exists(winget_ffmpeg) and winget_ffmpeg not in current_path:
                os.environ['PATH'] = winget_ffmpeg + os.pathsep + current_path

    def get_video_info(self, url: str) -> dict:
        """Fast metadata extraction (title, thumbnail, duration) without downloading."""
        ydl_opts = {
            'skip_download': True,
            'quiet': True,
            'extract_flat': False,
            'extractor_args': {
                'youtube': {
                    'player_client': ['android', 'ios', 'web_embedded'],
                    'player_skip': ['web'],
                }
            }
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            duration_sec = info.get('duration', 0)
            mins, secs = divmod(duration_sec, 60)
            return {
                "title": info.get('title', 'Unknown Title'),
                "thumbnail": info.get('thumbnail', ''),
                "uploader": info.get('uploader', 'Unknown Channel'),
                "duration": f"{mins}:{secs:02d}",
                "view_count": info.get('view_count', 0)
            }

    def download_media(self, url: str, mode: str = "video", quality: str = "720p") -> dict:
        unique_suffix = f"_{int(time.time())}"
        ydl_opts = {
            'outtmpl': os.path.join(self.downloads_dir, f'%(title)s{unique_suffix}.%(ext)s'),
            'noplaylist': True,
            'ignoreerrors': False,
            'extractor_args': {
                'youtube': {
                    'player_client': ['android', 'ios', 'web_embedded'],
                    'player_skip': ['web'],
                }
            }
        }

        # Check for cookies.txt
        root_cookies = os.path.join(os.path.dirname(__file__), "..", "..", "cookies.txt")
        if os.path.exists(root_cookies):
            ydl_opts['cookiefile'] = root_cookies

        if mode == 'audio':
            ydl_opts['format'] = 'bestaudio[ext=m4a]/bestaudio/best'
            ydl_opts['postprocessors'] = [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'm4a',
                'preferredquality': '192',
            }]
        else:
            if quality == '1080p':
                ydl_opts['format'] = 'bestvideo[height<=1080][vcodec^=avc1]+bestaudio[acodec^=mp4a]/best[height<=1080]/best'
            else:
                ydl_opts['format'] = 'bestvideo[height<=720][vcodec^=avc1]+bestaudio[acodec^=mp4a]/best[height<=720]/best'
            ydl_opts['merge_output_format'] = 'mp4'

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            if not info:
                raise Exception("유튜브 비디오 정보를 가져올 수 없습니다.")

            filename = ydl.prepare_filename(info)
            base_path = os.path.splitext(filename)[0]

            ext = '.m4a' if mode == 'audio' else '.mp4'
            final_filename = None
            for e in [ext, '.mp4', '.m4a', '.webm', '.mkv', '.mp3']:
                if os.path.exists(base_path + e):
                    final_filename = os.path.basename(base_path + e)
                    break
            if not final_filename:
                final_filename = os.path.basename(filename)

            full_path = os.path.join(self.downloads_dir, final_filename)
            size_mb = os.path.getsize(full_path) / (1024 * 1024) if os.path.exists(full_path) else 0.0

            return {
                "title": info.get('title', 'Downloaded Media'),
                "filename": final_filename,
                "size_mb": round(size_mb, 2)
            }

ytdlp_engine = YTDLPEngine()
