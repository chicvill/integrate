import os
import sys
import shutil
import yt_dlp
from flask import Flask, render_template, request, jsonify, send_from_directory

# 1. 경로 설정 (로컬 v2 전용)
base_dir = os.path.dirname(os.path.abspath(__file__))
downloads_folder = os.path.join(base_dir, 'downloads')

if not os.path.exists(downloads_folder):
    os.makedirs(downloads_folder)

app = Flask(__name__)

# 2. 환경 설정: FFmpeg 및 Node.js 경로 확인
def setup_environment():
    if os.name == 'nt':
        # 윈도우 로컬 검색을 통해 알아낸 실제 경로들
        winget_ffmpeg = os.path.join(os.environ.get('USERPROFILE', ''), 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages', 'Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe', 'ffmpeg-8.0.1-full_build', 'bin')
        node_standard = r"C:\Program Files\nodejs"
        
        current_path = os.environ.get('PATH', '')
        for p in [winget_ffmpeg, node_standard]:
            if os.path.exists(p) and p not in current_path:
                current_path = p + os.pathsep + current_path
        
        os.environ['PATH'] = current_path
        print("--- Windows Environment Setup Complete ---")
    else:
        print("--- Linux/Docker Environment Detected ---")
        # Render/Docker 환경: 환경 변수에서 쿠키를 읽어와 파일로 저장
        cookies_content = os.environ.get('COOKIES_CONTENT')
        if cookies_content:
            try:
                cookies_path = os.path.join(base_dir, 'cookies.txt')
                with open(cookies_path, 'w', encoding='utf-8') as f:
                    f.write(cookies_content)
                print("--- Cookies written from environment variable ---")
            except Exception as e:
                print(f"Failed to write cookies from env: {str(e)}")

    print(f"FFmpeg found: {shutil.which('ffmpeg')}")
    print(f"Node found: {shutil.which('node')}")

setup_environment()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/download', methods=['POST'])
def download():
    data = request.json
    url = data.get('url')
    mode = data.get('mode')

    if not url:
        return jsonify({'error': 'URL을 입력해주세요.'}), 400

    try:
        # v2.0 초강력 안정화 옵션 (유연한 클라이언트 설정)
        # 윈도우 파일 잠금(WinError 32) 방지를 위해 고유한 타임스탬프 접미사 추가
        import time
        unique_suffix = f"_{int(time.time())}"
        
        ydl_opts = {
            'outtmpl': os.path.join(downloads_folder, f'%(title)s{unique_suffix}.%(ext)s'),
            'noplaylist': True,
            'ignoreerrors': False, # 에러 발생 시 즉시 catch하여 fallback 시도
            # 클라우드 환경(Render) 봇 탐지 우회: 모바일 클라이언트 우선순위 상향
            'extractor_args': {
                'youtube': {
                    'player_client': ['android', 'ios', 'web_embedded'],
                    'player_skip': ['web'], # 일반 웹 클라이언트는 봇 탐지가 심해 스킵
                }
            }
        }

        # 쿠키 파일 경로
        cookies_file = os.path.join(base_dir, 'cookies.txt')
        has_cookies = os.path.exists(cookies_file)

        if mode == 'audio':
            # 고호환성 오디오: m4a (aac) 우선
            ydl_opts['format'] = 'bestaudio[ext=m4a]/bestaudio/best'
            ydl_opts['postprocessors'] = [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'm4a',
                'preferredquality': '192',
            }]
        else:
            # 고호환성 비디오: H.264(avc1) + AAC(mp4a) 우선 선택 (720p 이하)
            ydl_opts['format'] = 'bestvideo[height<=720][vcodec^=avc1]+bestaudio[acodec^=mp4a]/best[height<=720][vcodec^=avc1]/best[height<=720]/best'
            ydl_opts['merge_output_format'] = 'mp4'

        info = None
        
        # 1차 시도: 쿠키 포함 (있을 경우)
        if has_cookies:
            try:
                print("--- Attempt 1: Using cookies.txt ---")
                opts_with_cookies = ydl_opts.copy()
                opts_with_cookies['cookiefile'] = cookies_file
                with yt_dlp.YoutubeDL(opts_with_cookies) as ydl:
                    info = ydl.extract_info(url, download=True)
            except Exception as e:
                print(f"Attempt 1 failed: {str(e)}")
        
        # 2차 시도: 쿠키 없이 (1차가 실패했거나 쿠키가 없는 경우)
        if not info:
            print("--- Attempt 2: Without cookies (Fallback) ---")
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)

        if not info:
            raise Exception("유튜브 정보를 가져오지 못했습니다. URL이 올바른지 확인해 보세요.")
            
        filename = ydl.prepare_filename(info)
        base_path = os.path.splitext(filename)[0]
        
        # 실제 생성된 파일 확인 로직
        ext = '.m4a' if mode == 'audio' else '.mp4'
        final_filename = None
        for e in [ext, '.mp4', '.m4a', '.webm', '.mkv', '.mp3']:
            if os.path.exists(base_path + e):
                final_filename = os.path.basename(base_path + e)
                break
        
        if not final_filename:
            final_filename = os.path.basename(filename)

        return jsonify({
            'success': True,
            'title': info.get('title', 'Video'),
            'filename': final_filename
        })

    except Exception as e:
        print(f"Download Error: {str(e)}")
        # 사용자에게 더 상세한 가이드 제공
        error_msg = str(e)
        if "Sign in to confirm your age" in error_msg:
            error_msg = "연령 제한 영상입니다. 쿠키를 최신으로 갱신해야 합니다."
        elif "Incomplete data received" in error_msg:
            error_msg = "네트워크 불안정으로 정보를 가져오지 못했습니다. 잠시 후 다시 시도해 보세요."
            
        return jsonify({'error': error_msg}), 500

@app.route('/get_file/<filename>')
def get_file(filename):
    return send_from_directory(downloads_folder, filename, as_attachment=True)

if __name__ == '__main__':
    print("YTDownloader v2.0 starting...")
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
