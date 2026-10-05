import subprocess
import sys
import os
import time
import shutil
import threading

base_dir = os.path.dirname(os.path.abspath(__file__))

def find_cloudflared():
    """cloudflared.exe 경로 탐색"""
    # 1) PATH에서 찾기
    found = shutil.which('cloudflared')
    if found:
        return found
    # 2) winget 설치 경로에서 찾기
    local_app = os.environ.get('LOCALAPPDATA', '')
    winget_path = os.path.join(local_app, 'Microsoft', 'WinGet', 'Packages', 
                               'Cloudflare.cloudflared_Microsoft.Winget.Source_8wekyb3d8bbwe',
                               'cloudflared.exe')
    if os.path.exists(winget_path):
        return winget_path
    return None

def start_tunnel(cloudflared_path):
    """Cloudflare Tunnel을 백그라운드로 시작하고 URL을 표시"""
    log_path = os.path.join(base_dir, 'tunnel.log')
    with open(log_path, 'w') as log_file:
        proc = subprocess.Popen(
            [cloudflared_path, 'tunnel', '--url', 'http://localhost:5000'],
            stdout=log_file, stderr=subprocess.STDOUT
        )
    
    # URL이 나올 때까지 최대 15초 대기
    print("[2/3] Cloudflare Tunnel 연결 중...")
    for i in range(15):
        time.sleep(1)
        try:
            with open(log_path, 'r') as f:
                content = f.read()
            if 'trycloudflare.com' in content:
                for line in content.split('\n'):
                    if 'trycloudflare.com' in line:
                        # URL 추출
                        for word in line.split():
                            if 'trycloudflare.com' in word:
                                url = word.strip()
                                if not url.startswith('http'):
                                    url = 'https://' + url
                                print()
                                print("=" * 50)
                                print(f"  외부 접속 주소: {url}")
                                print("=" * 50)
                                print()
                                return proc
        except:
            pass
    
    print("[!] 터널 URL을 자동으로 가져오지 못했습니다.")
    print("    tunnel.log 파일을 확인해 보세요.")
    return proc

def main():
    print()
    print("=" * 50)
    print("  YouTube Downloader v2.0")
    print("  Server + Cloudflare Tunnel")
    print("=" * 50)
    print()

    # 1. yt-dlp 업데이트
    print("[1/3] yt-dlp 업데이트 확인 중...")
    subprocess.run([sys.executable, '-m', 'pip', 'install', '-U', 'yt-dlp'],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # 2. Cloudflare Tunnel 시작
    tunnel_proc = None
    cf_path = find_cloudflared()
    if cf_path:
        tunnel_proc = start_tunnel(cf_path)
    else:
        print("[!] cloudflared를 찾을 수 없습니다. 로컬 전용 모드로 실행합니다.")
        print("    설치: winget install cloudflare.cloudflared")
        print()

    # 3. Flask 서버 시작
    print("[3/3] 서버를 시작합니다...")
    print(f"  로컬 주소: http://localhost:5000")
    print()
    
    try:
        subprocess.run([sys.executable, 'app.py'], cwd=base_dir)
    except KeyboardInterrupt:
        print("\n서버를 종료합니다...")
    finally:
        if tunnel_proc:
            tunnel_proc.terminate()
            print("Cloudflare Tunnel 종료됨.")

if __name__ == '__main__':
    main()
