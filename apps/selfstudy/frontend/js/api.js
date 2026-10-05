// apps/selfstudy/frontend/js/api.js
// 자기주도학습 API 통신 모듈 (SaaS 템플릿 표준: getApiBase 준수)

export function getApiBase() {
  const p = window.location.pathname;
  if (p.startsWith('/selfstudy')) {
    return '/api/selfstudy';
  }
  return '/api';
}

function getHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    'X-App-ID': 'selfstudy'
  };
  const token = localStorage.getItem('mqnet_auth_token') || sessionStorage.getItem('mqnet_auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// 1. 학습 계획 목록 조회
export async function fetchStudyPlans(studentId = 'demo-student') {
  const base = getApiBase();
  const res = await fetch(`${base}/plans/?student_id=${encodeURIComponent(studentId)}&t=${Date.now()}`, {
    headers: getHeaders(),
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(`학습 계획 조회 실패 (HTTP ${res.status})`);
  return await res.json();
}

// 2. 학습 진도 / 순공 시간 기록
export async function recordStudyProgress(studiedMinutes, completedTasks = [], note = '') {
  const base = getApiBase();
  const res = await fetch(`${base}/progress/`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      studied_minutes: studiedMinutes,
      completed_tasks: completedTasks,
      note: note || undefined
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || '학습 기록 저장에 실패했습니다.');
  return data;
}

// 3. 일일/주간 학습 기록 이력 조회
export async function fetchProgressLogs(studentId = 'demo-student') {
  const base = getApiBase();
  try {
    const res = await fetch(`${base}/progress/logs?student_id=${encodeURIComponent(studentId)}&limit=14&t=${Date.now()}`, {
      headers: getHeaders(),
      cache: 'no-store'
    });
    if (!res.ok) return { logs: [] };
    return await res.json();
  } catch (e) {
    return { logs: [] };
  }
}

// 4. Gemini AI 스터디 멘토 질문
export async function askAiMentor(question, subject = '전과목') {
  const base = getApiBase();
  const payload = { question, subject, student_id: 'demo-student' };
  let res = await fetch(`${base}/ai/ask-mentor`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload)
  });
  if (res.status === 404) {
    res = await fetch(`${base}/ai/ask`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || data.message || 'AI 멘토 응답에 실패했습니다.');
  return data;
}

// 5. Gemini AI 맞춤 플랜 생성
export async function generateAiPlan(subject, target, dailyMinutes = 60) {
  const base = getApiBase();
  const res = await fetch(`${base}/ai/generate-plan`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      subject,
      target,
      daily_minutes: dailyMinutes
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'AI 플랜 생성에 실패했습니다.');
  return data;
}

// 6. 스터디카페 연동 좌석 현황 조회 (StudyCafe API 호출)
export async function fetchStudyCafeSeat(userId, phone, name) {
  const params = new URLSearchParams();
  if (userId) params.set('user_id', userId);
  if (phone) params.set('phone', phone);
  if (name) params.set('name', name);

  try {
    const res = await fetch(`/api/studycafe/seats/my-seat?${params.toString()}&t=${Date.now()}`, {
      headers: getHeaders(),
      cache: 'no-store'
    });
    if (!res.ok) return { has_seat: false, seat: null };
    return await res.json();
  } catch (e) {
    return { has_seat: false, seat: null };
  }
}
