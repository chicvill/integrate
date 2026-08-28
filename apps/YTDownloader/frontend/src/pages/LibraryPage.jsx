import React, { useState, useEffect } from 'react';
import { Film, Music, Download, Play, HardDrive } from 'lucide-react';

export default function LibraryPage() {
  const [files, setFiles] = useState([]);
  const [playingFile, setPlayingFile] = useState(null);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      const res = await fetch('/api/media/files');
      const data = await res.json();
      setFiles(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setFiles([]);
    }
  };

  return (
    <div>
      <div className="glass-card">
        <h2>미디어 보관함 & 플레이어 (Media Library)</h2>
        <p style={{ color: 'var(--text-muted)' }}>다운로드 완료된 비디오 및 오디오 파일 목록을 확인하고 바로 재생/다운로드합니다.</p>
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
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
              저장된 미디어 파일이 없습니다.
            </div>
          ) : (
            files.map((file, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--bg-secondary)',
                  padding: '1rem',
                  borderRadius: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {file.file_type === 'video' ? <Film color="#22d3ee" /> : <Music color="#c084fc" />}
                  <div>
                    <strong style={{ fontSize: '1rem' }}>{file.filename}</strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      용량: {file.size_mb} MB | 저장일시: {file.modified_at}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => setPlayingFile(file)}
                    className="btn-primary"
                    style={{ background: 'var(--accent-purple)', padding: '0.4rem 0.8rem', fontSize: '0.875rem' }}
                  >
                    <Play size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                    재생
                  </button>

                  <a
                    href={file.download_url}
                    download
                    className="btn-primary"
                    style={{ background: 'var(--bg-card)', padding: '0.4rem 0.8rem', fontSize: '0.875rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                  >
                    <Download size={14} style={{ marginRight: '4px' }} />
                    다운로드
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
