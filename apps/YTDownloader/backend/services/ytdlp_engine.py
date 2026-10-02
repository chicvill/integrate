import os
import re
import time
import shutil
import logging
import yt_dlp
from apps.YTDownloader.backend.config import settings

logger = logging.getLogger("ytdlp_engine")


def normalize_youtube_url(url: str) -> str:
    """쇼츠(Shorts) 및 단축 URL을 표준 watch?v= URL로 변환"""
    if not url:
        return url
    url = url.strip()
    shorts_match = re.search(r'youtube\.com/shorts/([a-zA-Z0-9_-]+)', url)
    if shorts_match:
        return f"https://www.youtube.com/watch?v={shorts_match.group(1)}"
    short_url_match = re.search(r'youtu\.be/([a-zA-Z0-9_-]+)', url)
    if short_url_match:
        return f"https://www.youtube.com/watch?v={short_url_match.group(1)}"
    return url


class YTDLPEngine:
    def __init__(self):
        self._setup_ffmpeg_path()

    @property
    def downloads_dir(self):
        return settings.DOWNLOADS_DIR

    def _setup_ffmpeg_path(self):
        if os.name == 'nt':
            winget_ffmpeg = os.path.join(os.environ.get('USERPROFILE', ''), 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages', 'Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe', 'ffmpeg-8.0.1-full_build', 'bin')
            current_path = os.environ.get('PATH', '')
            if os.path.exists(winget_ffmpeg) and winget_ffmpeg not in current_path:
                os.environ['PATH'] = winget_ffmpeg + os.pathsep + current_path

    def _build_base_ydl_opts(self) -> dict:
        pot_url = os.environ.get("POT_PROVIDER_URL", "http://bgutil-provider:4416")
        opts = {
            'noplaylist': True,
            'ignoreerrors': False,
            'socket_timeout': 30,
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
            },
            'extractor_args': {
                'youtubepot-bgutilhttp': {
                    'base_url': [pot_url]
                }
            }
        }

        # JS 런타임 바인딩 (Deno & Node.js)
        js_runtimes = {}
        for deno_cmd in ["deno", "/usr/local/bin/deno"]:
            if shutil.which(deno_cmd) or os.path.exists(deno_cmd):
                js_runtimes['deno'] = {'path': deno_cmd}
                break
        for node_cmd in ["node", "/usr/bin/node", "/usr/local/bin/node"]:
            if shutil.which(node_cmd) or os.path.exists(node_cmd):
                js_runtimes['node'] = {'path': node_cmd}
                break
        if js_runtimes:
            opts['js_runtimes'] = js_runtimes

        # 영구 볼륨 쿠키 파일 탐색 (/media/cookies.txt)
        candidate_cookies = [
            "/media/cookies.txt",
            "/media/ytdownloader/cookies.txt",
            os.path.join(settings.MEDIA_PATH, "cookies.txt"),
            os.path.join(os.path.dirname(__file__), "..", "..", "cookies.txt")
        ]
        for cpath in candidate_cookies:
            if os.path.exists(cpath):
                opts['cookiefile'] = cpath
                logger.info(f"Loaded YouTube cookies from {cpath}")
                break

        return opts

    def get_video_info(self, url: str) -> dict:
        """Fast metadata extraction (title, thumbnail, duration) without downloading."""
        target_url = normalize_youtube_url(url)
        ydl_opts = self._build_base_ydl_opts()
        ydl_opts.update({
            'skip_download': True,
            'quiet': True,
            'extract_flat': False,
            'socket_timeout': 15,
        })
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(target_url, download=False)
            duration_sec = info.get('duration', 0)
            mins, secs = divmod(duration_sec, 60)
            return {
                "title": info.get('title', 'Unknown Title'),
                "thumbnail": info.get('thumbnail', ''),
                "uploader": info.get('uploader', 'Unknown Channel'),
                "duration": f"{mins}:{secs:02d}",
                "view_count": info.get('view_count', 0)
            }

    def download_media(self, url: str, mode: str = "video", quality: str = "720p", progress_callback=None) -> dict:
        target_url = normalize_youtube_url(url)
        unique_suffix = f"_{int(time.time())}"
        
        ydl_opts = self._build_base_ydl_opts()
        ydl_opts.update({
            'outtmpl': os.path.join(self.downloads_dir, f'%(title).100s{unique_suffix}.%(ext)s'),
            'retries': 3,
            'fragment_retries': 3,
        })

        if progress_callback:
            def _yt_progress_hook(d):
                try:
                    status = d.get('status')
                    if status == 'downloading':
                        total = d.get('total_bytes') or d.get('total_bytes_estimate') or 0
                        downloaded = d.get('downloaded_bytes', 0)
                        percent = 0.0
                        if total > 0:
                            percent = round((downloaded / total) * 100, 1)
                        else:
                            p_str = d.get('_percent_str', '').strip().replace('%', '')
                            try:
                                percent = float(p_str)
                            except Exception:
                                percent = 0.0
                        speed = d.get('_speed_str', '').strip()
                        eta = d.get('_eta_str', '').strip()
                        info_dict = d.get('info_dict', {})
                        title = info_dict.get('title')
                        progress_callback(percent, speed, eta, title)
                    elif status == 'finished':
                        progress_callback(100.0, "", "", None)
                except Exception:
                    pass

            ydl_opts['progress_hooks'] = [_yt_progress_hook]

        if mode == 'audio':
            ydl_opts['format'] = 'bestaudio/best'
            ydl_opts['postprocessors'] = [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'm4a',
                'preferredquality': '192',
            }]
        else:
            # 숏폼 및 일반 비디오 코덱 제한 해제 (VP9, AV01, AVC1 모두 수용)
            if quality == '1080p':
                ydl_opts['format'] = 'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best'
            else:
                ydl_opts['format'] = 'bestvideo[height<=720]+bestaudio/best[height<=720]/best'
            ydl_opts['merge_output_format'] = 'mp4'

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(target_url, download=True)
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
