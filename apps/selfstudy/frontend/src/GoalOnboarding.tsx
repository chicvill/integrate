import { useState } from 'react';
import axios from 'axios';

import { API_URL } from './config';

export default function GoalOnboarding() {
  const [tags, setTags] = useState("");
  const [goalTitle, setGoalTitle] = useState("");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const tagsArray = tags.split(',').map(t => t.trim());
      const response = await axios.post(`${API_URL}/knowledge/goal`, {
        tags: tagsArray,
        goal_details: {
          title: goalTitle,
          description: details
        }
      });
      alert(response.data.message);
    } catch (err) {
      console.error(err);
      alert("Failed to save goal");
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '20px', background: '#fff', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
      <h2 style={{ color: '#1976d2' }}>🚀 새로운 목표 설정 (지식정보창고 저장)</h2>
      <p style={{ color: '#666' }}>정해진 카테고리가 없습니다. 자유롭게 목표를 입력하세요.</p>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
        <div>
          <label style={{ fontWeight: 'bold' }}>검색용 태그 (쉼표로 구분)</label>
          <input 
            type="text" 
            placeholder="예: 공인중개사, 직장인, 동차, 6개월" 
            value={tags}
            onChange={e => setTags(e.target.value)}
            style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
            required 
          />
        </div>
        
        <div>
          <label style={{ fontWeight: 'bold' }}>목표 제목</label>
          <input 
            type="text" 
            placeholder="예: 직장인 공인중개사 6개월 단기 합격" 
            value={goalTitle}
            onChange={e => setGoalTitle(e.target.value)}
            style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
            required 
          />
        </div>

        <div>
          <label style={{ fontWeight: 'bold' }}>상세 상황 및 가용 시간</label>
          <textarea 
            placeholder="예: 평일 3시간, 주말 8시간 가능. 민법이 가장 걱정됨." 
            value={details}
            onChange={e => setDetails(e.target.value)}
            style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '100px' }}
            required 
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          style={{ background: loading ? '#ccc' : '#1976d2', color: '#fff', padding: '12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}
        >
          {loading ? 'AI가 과거 지식을 검색하여 일정을 짜는 중...' : '목표 저장 및 AI 일정 생성'}
        </button>
      </form>
    </div>
  );
}
