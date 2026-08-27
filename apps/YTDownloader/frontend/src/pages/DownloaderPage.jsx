import React, { useState, useEffect } from 'react';
import { Download, Youtube, Music, Video, Sparkles, CheckCircle2, Clock, Clipboard, FileText, ExternalLink } from 'lucide-react';

export default function DownloaderPage() {
  const [url, setUrl] = useState('');
  const [mode, setMode] = useState('video'); // video | audio
  const [quality, setQuality] = useState('720p');
  const [preview, setPreview] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/download/jobs');
      const data = await res.json();
      setJobs(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.includes('http')) {
        setUrl(text);
        fetchPreview(text);
      } else {
        setMsg("클립보드에 유효한 URL이 없습니다.");
      }
    } catch (err) {
      setMsg("클립보드 접근 권한을 허용해주세요.");
    }
  };

  const fetchPreview = async (targetUrl) => {
    const inputUrl = targetUrl || url;
    if (!inputUrl) return;
    setPreviewLoading(true);
    setPreview(null);
    try {
      const res = await fetch('/api/download/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: inputUrl })
      });
      if (res.ok) {
        const data = await res.json();
        setPreview(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleStartDownload = async () => {
    if (!url) {
      setMsg("유튜브 URL을 입력해주세요.");
      return;
    }
    setLoading(true);
    setMsg("다운로드 요청을 전송하고 있습니다...");
    try {
      const res = await fetch('/api/download/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, mode, quality })
      });
      const data = await res.json();
      if (res.ok) {
        setMsg(`[성공] 다운로드 큐 등록 완료! (Job ID: ${data.id})`);
        setUrl('');
        setPreview(null);
        fetchJobs();
      } else {
        setMsg(`[오류] ${data.detail || '다운로드 요청 실패'}`);
      }
    } catch (err) {
      setMsg("서버 통신 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="glass-card" style={{ background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(192, 132, 252, 0.2))' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Youtube color="#f43f5e" /> 고속 비디오 & AI 요약 다운로더 (SaaS Engine)
        </h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
          클립보드 원클릭 붙여넣기 + AI 3줄 요약 리포트 자동 생성을 지원합니다.
        </p>
      </div>

      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3>URL 및 옵션 입력</h3>
          <button onClick={handlePasteClipboard} className="btn-primary" style={{ background: 'var(--bg-card)', padding: '0.4rem 0.8rem', fontSize: '0.875rem' }}>
            <Clipboard size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            📋 클립보드 자동 붙여넣기
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            className="input-field"
            style={{ margin: 0 }}
            placeholder="https://www.youtube.com/watch?v=..."
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (e.target.value.length > 20) fetchPreview(e.target.value);
            }}
          />
          <button onClick={() => fetchPreview()} className="btn-primary" style={{ background: 'var(--bg-card)', whiteSpace: 'nowrap' }}>
            미리보기
          </button>
        </div>

        {previewLoading && <div style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>영상 정보를 불러오는 중...</div>}

        {preview && (
          <div style={{ display: 'flex', gap: '1rem', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
            {preview.thumbnail && <img src={preview.thumbnail} alt="thumbnail" style={{ width: '120px', borderRadius: '6px', objectFit: 'cover' }} />}
            <div>
              <strong style={{ fontSize: '1.05rem', color: '#22d3ee' }}>{preview.title}</strong>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                채널: {preview.uploader} | 재생시간: {preview.duration}
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <div style={{ flex: 1, minWidth: '160px' }}>
            <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)' }}>다운로드 포맷</label>
            <select className="input-field" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="video">MP4 고화질 비디오 (Video + Audio)</option>
              <option value="audio">M4A/MP3 오디오 음원 (Audio Only)</option>
            </select>
          </div>

          <div style={{ flex: 1, minWidth: '160px' }}>
            <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)' }}>화질 / 해상도</label>
            <select className="input-field" value={quality} onChange={(e) => setQuality(e.target.value)}>
              <option value="720p">720p HD (빠른 변환 추천)</option>
              <option value="1080p">1080p Full HD</option>
              <option value="audio_m4a">오디오 최고 품질 (192kbps)</option>
            </select>
          </div>
        </div>

        <button onClick={handleStartDownload} className="btn-primary" disabled={loading} style={{ width: '100%' }}>
          <Download size={18} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          {loading ? "다운로드 요청 중..." : "다운로드 & AI 요약 생성 시작"}
        </button>

        {msg && (
          <div style={{ marginTop: '1rem', padding: '0.8rem', background: 'var(--bg-secondary)', borderRadius: '8px', color: '#22d3ee' }}>
            {msg}
          </div>
        )}
      </div>

      <div className="glass-card">
        <h3>다운로드 & AI 요약 작업 큐 (Active Download Queue)</h3>
        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {jobs.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
              진행 중이거나 완료된 다운로드 내역이 없습니다.
            </div>
          ) : (
            jobs.map((job) => (
              <div
                key={job.id}
                style={{
                  background: 'var(--bg-secondary)',
                  padding: '1rem',
                  borderRadius: '8px',
                  borderLeft: job.status === 'COMPLETED' ? '4px solid #34d399' : job.status === 'FAILED' ? '4px solid #f43f5e' : '4px solid #fbbf24'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{job.title || job.url}</strong>
                  <span style={{
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    color: job.status === 'COMPLETED' ? '#34d399' : job.status === 'FAILED' ? '#f43f5e' : '#fbbf24'
                  }}>
                    {job.status === 'COMPLETED' && <CheckCircle2 size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />}
                    {job.status === 'DOWNLOADING' && <Clock size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />}
                    {job.status}
                  </span>
                </div>

                {job.filename && (
                  <div style={{ marginTop: '6px', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>파일: {job.filename} ({job.file_size_mb} MB)</span>

                    {job.status === 'COMPLETED' && (
                      <a
                        href={`/api/download/summary-file/${job.id}`}
                        download
                        className="btn-primary"
                        style={{ background: 'rgba(192, 132, 252, 0.2)', border: '1px solid #c084fc', color: '#c084fc', padding: '0.3rem 0.6rem', fontSize: '0.75rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                      >
                        <FileText size={12} style={{ marginRight: '4px' }} />
                        📄 AI 요약 노트 (.md) 다운로드
                      </a>
                    )}
                  </div>
                )}

                {job.ai_summary && (
                  <div style={{ marginTop: '8px', padding: '0.8rem', background: 'var(--bg-card)', borderRadius: '6px', fontSize: '0.85rem', color: '#f8fafc', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                    <Sparkles size={14} color="#c084fc" style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                    {job.ai_summary}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
