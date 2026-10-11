import { useEffect, useState, useRef } from 'react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import PortalHeader from './PortalHeader';

// 재미로 한 번 보고 넘어가는 서비스: 로그인/회원가입 없이 바로 분석
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

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const analyze = async () => {
    if (!imageBase64) {
      alert('먼저 얼굴 사진을 업로드하거나 촬영해주세요!');
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
    setImageBase64('');
    setCropSrc('');
    setResult(null);
    setStatus('idle');
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
            로그인 없이 사진 한 장으로 재미로 보는 관상! 사진은 저장하지 않고 분석에만 사용됩니다.
          </p>

          <div style={{ background: '#111827', borderRadius: 16, padding: isMobile ? 16 : 24, border: '1px solid #334155', marginTop: 24, display: 'grid', gap: 12 }}>
            <label>
              이름 (선택)
              <input
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="결과에 표시할 이름"
                style={inputStyle}
              />
            </label>

            <label style={{ display: 'block' }}>
              <div style={{ marginBottom: 4 }}>사진 촬영 및 업로드 📸</div>
              <input
                type="file"
                accept="image/*"
                style={inputStyle}
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  setImageBase64('');
                  setResult(null);
                  setStatus('idle');
                  const reader = new FileReader();
                  reader.onload = (event) => setCropSrc(event.target.result);
                  reader.readAsDataURL(file);
                }}
              />
            </label>

            {cropSrc && !imageBase64 && (
              <div style={{ textAlign: 'center', background: '#0f172a', padding: 12, borderRadius: 12 }}>
                <div style={{ color: '#fbbf24', marginBottom: 12, fontWeight: 'bold' }}>네모 박스를 드래그하여 분석할 얼굴을 선택하세요!</div>
                <ReactCrop
                  crop={crop}
                  onChange={(c) => setCrop(c)}
                  onComplete={(c) => setCompletedCrop(c)}
                  aspect={1}
                >
                  <img ref={imgRef} src={cropSrc} alt="Crop preview" style={{ maxWidth: '100%', maxHeight: '50vh' }} />
                </ReactCrop>
                <button onClick={handleCropComplete} style={{ ...primaryButton, marginTop: 12, width: '100%' }}>
                  ✅ 얼굴 선택 완료
                </button>
              </div>
            )}

            {imageBase64 && !cropSrc && (
              <div style={{ textAlign: 'center' }}>
                <img src={imageBase64} alt="미리보기" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 12, border: '2px solid #334155' }} />
                <div style={{ color: '#10b981', fontSize: '0.85rem', marginTop: 4 }}>✅ 선택된 얼굴이 준비되었습니다!</div>
                <button onClick={reset} style={{ ...secondaryButton, marginTop: 8, fontSize: '0.8rem' }}>다시 선택</button>
              </div>
            )}

            <button
              onClick={analyze}
              disabled={status === 'analyzing'}
              style={{ ...primaryButton, opacity: status !== 'analyzing' ? 1 : 0.5 }}
            >
              {status === 'analyzing' ? '분석 중입니다... 잠시만 기다려주세요⏳' : '🔮 관상 보기'}
            </button>
          </div>

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
  marginTop: 8,
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #475569',
  background: '#0f172a',
  color: '#f8fafc',
  boxSizing: 'border-box',
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
