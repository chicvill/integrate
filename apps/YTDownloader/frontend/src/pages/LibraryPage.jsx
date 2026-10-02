import React, { useState, useEffect } from 'react';
import { Film, Music, Download, Play, HardDrive, RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react';

export default function LibraryPage() {
  const [files, setFiles] = useState([]);
  const [playingFile, setPlayingFile] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchFiles();
    const interval = setInterval(fetchFiles, 4000);
    return () => clearInterval(interval);
  }, []);

  const fetchFiles = async () => {
    try {
      const res = await fetch('/api/media/files');
      if (!res.ok) {
        setFiles([]);
        return;
      }
      const data = await res.json();
      setFiles(Array.isArray(data) ? data : []);
    } catch (err) {
      setFiles([]);
    }
  };

  return (
    <div>
      <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>미디어 보관함 & 플레이어 (Media Library)</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
            다운로드 완료된 비디오 및 오디오 파일 목록을 확인하고 바로 재생/다운로드합니다.
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchFiles().finally(() => setLoading(false)); }}
          className="btn-primary"
          style={{ background: 'var(--bg-card)', padding: '0.5rem 0.9rem', fontSize: '0.85rem' }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} style={{ marginRight: '6px' }} />
          새로고침
        </button>
      </div>

      {playingFile && (
        <div className="glass-card" style={{ borderLeft: '4px solid var(--accent-purple)' }}>
          <h3 style={{ marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Play color="#c084fc" /> 재생 중: {playingFile.filename}
          </h3>
          {playingFile.file_type === 'video' ? (
            <video controls autoPlay src={playingFile.download_url} style={{ width: '100%', maxHeight: '420px', borderRadius: '8px' }} />
          ) : (
            <audio controls autoPlay src={playingFile.download_url} style={{ width: '100%', marginTop: '1rem' }} />
          )}
        </div>
      )}

      <div className="glass-card">
        <h3>다운로드 미디어 파일 목록 ({files.length}개)</h3>
        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {files.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2.5rem' }}>
              저장된 미디어 파일이 없습니다. [고속 다운로더] 탭에서 영상을 다운로드해보세요!
            </div>
          ) : (
            files.map((file, idx) => {
              const size = file.size_mb != null ? file.size_mb : (file.file_size_mb || 0);
              const dateStr = file.modified_at || file.created_at || '';
              const isCompleted = file.status === 'COMPLETED' || (!file.status && file.download_url && file.download_url !== '#');
              const isPending = file.status === 'DOWNLOADING' || file.status === 'PENDING';
              const isFailed = file.status === 'FAILED';

              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'var(--bg-secondary)',
                    padding: '1rem',
                    borderRadius: '8px',
                    borderLeft: isCompleted ? '4px solid #34d399' : isFailed ? '4px solid #f43f5e' : '4px solid #fbbf24'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                    {file.file_type === 'video' ? <Film color="#22d3ee" size={24} /> : <Music color="#c084fc" size={24} />}
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <strong style={{ fontSize: '0.95rem', display: 'block', wordBreak: 'break-all' }}>
                        {file.filename}
                      </strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                        {isCompleted && <span>용량: <b>{size} MB</b></span>}
                        {dateStr && <span>일시: {dateStr}</span>}
                        {isPending && <span style={{ color: '#fbbf24', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> 다운로드 진행 중...</span>}
                        {isFailed && <span style={{ color: '#f43f5e', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={12} /> 실패</span>}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
                    {isCompleted ? (
                      <>
                        <button
                          onClick={() => setPlayingFile(file)}
                          className="btn-primary"
                          style={{ background: 'var(--accent-purple)', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                        >
                          <Play size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                          재생
                        </button>

                        <a
                          href={file.download_url}
                          download={file.filename}
                          className="btn-primary"
                          style={{ background: 'var(--bg-card)', padding: '0.4rem 0.8rem', fontSize: '0.85rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                        >
                          <Download size={14} style={{ marginRight: '4px' }} />
                          다운로드
                        </a>
                      </>
                    ) : isPending ? (
                      <span style={{ fontSize: '0.8rem', color: '#fbbf24', padding: '0.4rem 0.8rem', background: 'rgba(251, 191, 36, 0.1)', borderRadius: '6px' }}>
                        변환 중...
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: '#f43f5e', padding: '0.4rem 0.8rem', background: 'rgba(244, 63, 94, 0.1)', borderRadius: '6px' }}>
                        다운로드 실패
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
