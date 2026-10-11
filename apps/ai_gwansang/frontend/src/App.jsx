import { useEffect, useState, useRef } from 'react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import PortalHeader from './PortalHeader';

export default function App() {
  const [userName, setUserName] = useState('');
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState('idle');
  const [imageBase64, setImageBase64] = useState('');
  const [cropSrc, setCropSrc] = useState('');
  const [crop, setCrop] = useState({ unit: '%', width: 50, height: 50, x: 25, y: 25 });
  const [completedCrop, setCompletedCrop] = useState(null);
  const imgRef = useRef(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // 실시간 웹캠 상태
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 카메라 정리
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // 실시간 웹캠 켜기
  const startCamera = async () => {
    setCameraError('');
    setImageBase64('');
    setCropSrc('');
    setResult(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('이 브라우저 환경에서는 직접 카메라 접근을 지원하지 않습니다. 아래 [사진 파일 업로드] 버튼을 이용해주세요.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      setIsCameraActive(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    } catch (err) {
      console.warn('카메라 접근 에러:', err);
      let msg = '카메라를 열 수 없습니다. 카메라 접근 권한을 확인해주세요.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = '카메라 권한이 차단되었습니다. 브라우저 주소창 좌측 자물쇠 아이콘에서 카메라 권한을 허용해주세요.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = '사용 가능한 카메라/웹캠 장치를 찾을 수 없습니다.';
      }
      setCameraError(msg);
      setIsCameraActive(false);
    }
  };

  // 실시간 웹캠에서 한 컷 캡처
  const captureFromCamera = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    stopCamera();
    setCropSrc(dataUrl);
  };

  const analyze = async () => {
    if (!imageBase64) {
      alert('먼저 얼굴 사진을 촬영하거나 업로드해주세요!');
      return;
    }
    setStatus('analyzing');
    try {
      const res = await fetch('/api/ai_gwansang/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_data: imageBase64, user_name: userName.trim() || '사용자' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus('error');
        alert(data.detail || data.message || '분석에 실패했습니다.');
        return;
      }
      setResult(data.result);
      setStatus('done');
    } catch (err) {
      setStatus('error');
      alert('분석 요청 중 오류가 발생했습니다.');
    }
  };

  const handleCropComplete = () => {
    if (!completedCrop || !imgRef.current) return;
    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const MAX_WIDTH = 800;
    let targetWidth = completedCrop.width * scaleX;
    let targetHeight = completedCrop.height * scaleY;
    if (targetWidth > MAX_WIDTH) {
      targetHeight = Math.round(targetHeight * (MAX_WIDTH / targetWidth));
      targetWidth = MAX_WIDTH;
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      targetWidth,
      targetHeight
    );

    setImageBase64(canvas.toDataURL('image/jpeg', 0.8));
    setCropSrc('');
  };

  const reset = () => {
    stopCamera();
    setImageBase64('');
    setCropSrc('');
    setResult(null);
    setStatus('idle');
    setCameraError('');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a, #1f2937)',
      color: '#f8fafc',
      fontFamily: 'sans-serif',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <PortalHeader appName="AI 관상 분석" appIcon="🔮" category="AI Vision" />
      <div style={{ flex: 1, padding: isMobile ? '20px 10px' : '40px 20px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <h1 style={{ fontSize: isMobile ? '1.8rem' : '2.5rem', margin: 0 }}>🔮 AI 관상</h1>
          <p style={{ color: '#cbd5e1', marginTop: 8, fontSize: isMobile ? '0.9rem' : '1rem' }}>
            로그인 없이 사진 한 장으로 재미로 보는 관상! 실시간 웹캠 촬영 또는 갤러리 사진을 지원합니다.
          </p>

          <div style={{ background: '#111827', borderRadius: 16, padding: isMobile ? 16 : 24, border: '1px solid #334155', marginTop: 24, display: 'grid', gap: 14 }}>
            <label>
              이름 (선택)
              <input
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="결과에 표시할 이름"
                style={inputStyle}
              />
            </label>

            {/* 촬영 및 업로드 버튼 영역 */}
            {!isCameraActive && !cropSrc && !imageBase64 && (
              <div>
                <div style={{ marginBottom: 8, fontWeight: 'bold', color: '#e2e8f0' }}>사진 등록 방법 선택 📸</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <button
                    onClick={startCamera}
                    style={{ ...actionButton, background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}
                  >
                    📷 실시간 카메라 촬영
                  </button>
                  <button
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                    style={{ ...actionButton, background: 'linear-gradient(135deg, #475569, #334155)' }}
                  >
                    📁 사진 파일 업로드
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    reset();
                    const reader = new FileReader();
                    reader.onload = (event) => setCropSrc(event.target.result);
                    reader.readAsDataURL(file);
                  }}
                />
              </div>
            )}

            {/* 카메라 에러 알림 */}
            {cameraError && (
              <div style={{ background: '#7f1d1d', color: '#fecaca', padding: 12, borderRadius: 10, fontSize: '0.9rem', lineHeight: 1.5 }}>
                ⚠️ {cameraError}
              </div>
            )}

            {/* 1. 실시간 웹캠 뷰파인더 화면 */}
            {isCameraActive && (
              <div style={{ textAlign: 'center', background: '#0f172a', padding: 12, borderRadius: 14, border: '1px solid #334155' }}>
                <div style={{ color: '#38bdf8', marginBottom: 10, fontWeight: 'bold' }}>
                  정면을 바라보고 아래 촬영 버튼을 눌러주세요 📸
                </div>
                <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', borderRadius: 12, overflow: 'hidden' }}>
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    autoPlay
                    style={{ width: '100%', maxHeight: '55vh', transform: 'scaleX(-1)', background: '#000', display: 'block', borderRadius: 12 }}
                  />
                  {/* 가이드 타원형 테두리 */}
                  <div style={{
                    position: 'absolute',
                    top: '15%',
                    left: '25%',
                    width: '50%',
                    height: '70%',
                    border: '2px dashed rgba(56, 189, 248, 0.7)',
                    borderRadius: '50%',
                    pointerEvents: 'none'
                  }} />
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 14 }}>
                  <button onClick={captureFromCamera} style={{ ...primaryButton, flex: 1, padding: '14px' }}>
                    📸 찰칵! 촬영하기
                  </button>
                  <button onClick={stopCamera} style={{ ...secondaryButton, minWidth: 90 }}>
                    취소
                  </button>
                </div>
              </div>
            )}

            {/* 2. 크롭 선택 화면 */}
            {cropSrc && !imageBase64 && (
              <div style={{ textAlign: 'center', background: '#0f172a', padding: 12, borderRadius: 12, border: '1px solid #334155' }}>
                <div style={{ color: '#fbbf24', marginBottom: 12, fontWeight: 'bold' }}>
                  네모 박스를 조절하여 얼굴 중심을 맞춰주세요!
                </div>
                <ReactCrop
                  crop={crop}
                  onChange={(c) => setCrop(c)}
                  onComplete={(c) => setCompletedCrop(c)}
                  aspect={1}
                >
                  <img ref={imgRef} src={cropSrc} alt="Crop preview" style={{ maxWidth: '100%', maxHeight: '50vh' }} />
                </ReactCrop>
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button onClick={handleCropComplete} style={{ ...primaryButton, flex: 1 }}>
                    ✅ 얼굴 선택 완료
                  </button>
                  <button onClick={reset} style={{ ...secondaryButton, minWidth: 90 }}>
                    다시 찍기
                  </button>
                </div>
              </div>
            )}

            {/* 3. 선택 완료 미리보기 */}
            {imageBase64 && !cropSrc && (
              <div style={{ textAlign: 'center', background: '#0f172a', padding: 14, borderRadius: 12, border: '1px solid #334155' }}>
                <img src={imageBase64} alt="미리보기" style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 12, border: '2px solid #10b981' }} />
                <div style={{ color: '#10b981', fontSize: '0.9rem', marginTop: 6, fontWeight: 'bold' }}>✅ 준비 완료!</div>
                <button onClick={reset} style={{ ...secondaryButton, marginTop: 10, fontSize: '0.85rem' }}>🔄 다른 사진 찍기/선택</button>
              </div>
            )}

            {/* 분석 버튼 */}
            {imageBase64 && (
              <button
                onClick={analyze}
                disabled={status === 'analyzing'}
                style={{ ...primaryButton, opacity: status !== 'analyzing' ? 1 : 0.5, fontSize: '1.1rem', padding: '14px' }}
              >
                {status === 'analyzing' ? 'AI가 관상을 분석 중입니다... 잠시만 기다려주세요⏳' : '🔮 관상 보기'}
              </button>
            )}
          </div>

          {/* 결과 화면 */}
          {result && (
            <div style={{ marginTop: 30, background: '#111827', border: '1px solid #334155', borderRadius: 16, padding: 20 }}>
              <h3 style={{ borderBottom: '1px solid #334155', paddingBottom: 10, marginTop: 0 }}>✨ AI 관상 분석 결과 ✨</h3>
              <div style={{ marginTop: 16, display: 'grid', gap: 12, lineHeight: 1.6 }}>
                <div><strong style={{ color: '#f59e0b' }}>동물상:</strong> {result.animalType} ({result.overallScore}점)</div>
                <div><strong style={{ color: '#f59e0b' }}>인상 요약:</strong> {result.animalDescription}</div>
                <div><strong style={{ color: '#f59e0b' }}>성향:</strong> {result.personality}</div>
                <hr style={{ borderColor: '#334155', margin: '8px 0' }} />
                <div><strong style={{ color: '#10b981' }}>💰 재물운:</strong> {result.wealthLuck}</div>
                <div><strong style={{ color: '#3b82f6' }}>🏢 직업운:</strong> {result.careerLuck}</div>
                <div><strong style={{ color: '#ec4899' }}>💖 연애운:</strong> {result.loveLuck}</div>
                <div style={{ marginTop: 8, padding: 12, background: '#1e293b', borderRadius: 8 }}>
                  <strong>💡 조언:</strong> {result.advice}
                </div>
              </div>
              <button onClick={reset} style={{ ...secondaryButton, marginTop: 16, width: '100%' }}>🔄 다른 사진으로 다시 보기</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  marginTop: 6,
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #475569',
  background: '#0f172a',
  color: '#f8fafc',
  boxSizing: 'border-box',
};

const actionButton = {
  color: '#ffffff',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  padding: '14px 12px',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: '0.95rem',
};

const primaryButton = {
  background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
  color: '#111827',
  border: 'none',
  borderRadius: 12,
  padding: '12px 16px',
  fontWeight: 700,
  cursor: 'pointer',
};

const secondaryButton = {
  background: '#0f172a',
  color: '#f8fafc',
  border: '1px solid #334155',
  borderRadius: 12,
  padding: '10px 16px',
  fontWeight: 700,
  cursor: 'pointer',
};
