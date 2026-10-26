import { useState } from 'react';
import axios from 'axios';

import { API_URL } from './config';

export default function KnowledgeBrowser() {
  const [searchTags, setSearchTags] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/knowledge/search`, {
        params: { tags: searchTags }
      });
      setResults(response.data.data);
    } catch (err) {
      console.error(err);
      alert("Search failed");
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '20px', background: '#f8f9fa', borderRadius: '8px' }}>
      <h2 style={{ color: '#2e7d32' }}>📖 지식창고 탐색</h2>
      <p style={{ color: '#666' }}>유사한 태그를 검색하여 과거 수험생들의 목표, 일정, 진도결과를 확인합니다.</p>
      
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
        <input 
          type="text" 
          placeholder="검색할 태그 (예: 공인중개사, 직장인)" 
          value={searchTags}
          onChange={e => setSearchTags(e.target.value)}
          style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <button 
          type="submit" 
          disabled={loading}
          style={{ background: '#2e7d32', color: '#fff', padding: '10px 20px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          {loading ? '검색 중...' : '검색'}
        </button>
      </form>

      <div style={{ marginTop: '30px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {results.length === 0 && !loading && <p>검색 결과가 없습니다.</p>}
        {results.map((item, idx) => (
          <div key={idx} style={{ background: '#fff', padding: '15px', borderRadius: '8px', borderLeft: '5px solid #2e7d32', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <strong>Type: {item.domain_type}</strong>
              <span style={{ fontSize: '12px', color: '#888' }}>{new Date(item.created_at).toLocaleString()}</span>
            </div>
            <div style={{ marginBottom: '10px' }}>
              {item.tags.map((t: string) => (
                <span key={t} style={{ display: 'inline-block', background: '#e8f5e9', color: '#2e7d32', padding: '3px 8px', borderRadius: '12px', fontSize: '12px', marginRight: '5px' }}>
                  #{t}
                </span>
              ))}
            </div>
            <pre style={{ background: '#f1f1f1', padding: '10px', borderRadius: '4px', overflowX: 'auto', fontSize: '13px' }}>
              {JSON.stringify(item.payload, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
