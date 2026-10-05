import os

html = """<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MQnet 통합 SaaS 플랫폼 포털</title>
  <link href="https://fonts.googleapis.com/css2?family=Pretendard:wght@400;600;700;800&family=Outfit:wght@600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0a0e17; --card-bg: rgba(17, 24, 39, 0.75); --border: rgba(255, 255, 255, 0.08);
      --text: #f8fafc; --text-muted: #94a3b8; --primary: #6366f1;
      --grad: linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Pretendard', sans-serif; background: var(--bg); color: var(--text); min-height: 100vh;
      background-image: radial-gradient(circle at 15% 15%, rgba(99, 102, 241, 0.15) 0%, transparent 40%),
                        radial-gradient(circle at 85% 25%, rgba(168, 85, 247, 0.12) 0%, transparent 40%);
    }
    .navbar {
      display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 2.5rem;
      background: rgba(10, 14, 23, 0.75); backdrop-filter: blur(16px); border-bottom: 1px solid var(--border);
    }
    .brand { display: flex; align-items: center; gap: 0.75rem; font-family: 'Outfit', sans-serif; font-weight: 800; font-size: 1.35rem; color: white; text-decoration: none; }
    .brand-logo { width: 38px; height: 38px; border-radius: 10px; background: var(--grad); display: flex; align-items: center; justify-content: center; font-size: 1.1rem; }
    .status-pill { display: flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0.85rem; border-radius: 20px; font-size: 0.8rem; background: rgba(16, 185, 129, 0.1); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.25); }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; }
    .btn { padding: 0.5rem 1rem; border-radius: 10px; font-size: 0.85rem; font-weight: 600; text-decoration: none; cursor: pointer; border: 1px solid var(--border); color: white; background: rgba(255,255,255,0.06); }
    .btn:hover { background: rgba(255,255,255,0.12); }
    .container { max-width: 1200px; margin: 0 auto; padding: 2.5rem 1.5rem; }
    .hero { text-align: center; padding: 2.5rem 0 3.5rem; }
    .hero h1 { font-family: 'Outfit', 'Pretendard', sans-serif; font-size: 3rem; font-weight: 800; margin-bottom: 1rem; }
    .hero h1 span { background: var(--grad); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .hero p { font-size: 1.1rem; color: var(--text-muted); max-width: 680px; margin: 0 auto; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 3.5rem; }
    .stat-item { background: var(--card-bg); border: 1px solid var(--border); border-radius: 14px; padding: 1.25rem; }
    .stat-val { font-family: 'Outfit', sans-serif; font-size: 1.6rem; font-weight: 800; margin-top: 0.3rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 1.5rem; }
    .card {
      background: var(--card-bg); border: 1px solid var(--border); border-radius: 20px; padding: 1.75rem;
      backdrop-filter: blur(12px); display: flex; flex-direction: column; justify-content: space-between;
      transition: all 0.2s; position: relative; overflow: hidden;
    }
    .card:hover { transform: translateY(-4px); border-color: rgba(99,102,241,0.4); box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    .card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; }
    .icon { font-size: 2rem; }
    .badge { font-size: 0.75rem; font-weight: 700; padding: 0.25rem 0.6rem; border-radius: 20px; background: rgba(255,255,255,0.06); color: var(--text-muted); }
    .card h3 { font-size: 1.3rem; font-weight: 700; margin-bottom: 0.5rem; }
    .card p { font-size: 0.9rem; color: var(--text-muted); line-height: 1.5; margin-bottom: 1.25rem; min-height: 42px; }
    .tags { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 1.5rem; }
    .tag { font-size: 0.75rem; padding: 0.25rem 0.6rem; border-radius: 6px; background: rgba(255,255,255,0.04); color: var(--text-muted); }
    .actions { display: flex; gap: 0.5rem; border-top: 1px solid var(--border); padding-top: 1.25rem; }
    .btn-main { flex: 1; padding: 0.65rem 1rem; border-radius: 12px; background: var(--grad); color: white; font-weight: 600; text-align: center; border: none; cursor: pointer; }
    .modal { position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(8px); display: none; align-items: center; justify-content: center; z-index: 100; padding: 1.5rem; }
    .modal.active { display: flex; }
    .modal-box { background: #131b2e; border: 1px solid rgba(255,255,255,0.12); border-radius: 24px; max-width: 650px; width: 100%; max-height: 85vh; overflow-y: auto; padding: 2rem; }
    .modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border); padding-bottom: 1rem; }
    .close-btn { background: none; border: none; color: var(--text-muted); font-size: 1.5rem; cursor: pointer; }
    .input { width: 100%; padding: 0.75rem 1rem; background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: 10px; color: white; margin-bottom: 1rem; }
    .res-box { margin-top: 1rem; padding: 1.25rem; border-radius: 12px; background: rgba(0,0,0,0.4); border: 1px solid var(--border); display: none; }
    .seat-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 0.4rem; margin: 1rem 0; }
    .seat-btn { padding: 0.5rem 0.2rem; border-radius: 6px; border: 1px solid var(--border); background: rgba(255,255,255,0.05); color: white; cursor: pointer; font-size: 0.75rem; text-align: center; }
    .seat-btn.selected { background: var(--primary); }
    @media(max-width: 800px) { .stats { grid-template-columns: repeat(2, 1fr); } }
  </style>
</head>
<body>
  <nav class="navbar">
    <a href="/" class="brand"><div class="brand-logo">MQ</div>MQnet Platform</a>
    <div style="display: flex; gap: 0.75rem; align-items: center;">
      <div class="status-pill"><div class="status-dot"></div>5 SaaS Active</div>
      <a href="/docs" target="_blank" class="btn">📖 API Docs</a>
      <a href="/health" target="_blank" class="btn">⚡ Health</a>
    </div>
  </nav>

  <div class="container">
    <div class="hero">
      <h1>하나의 서버로 완성하는<br><span>5대 멀티 SaaS 플랫폼</span></h1>
      <p>단일 포트 10000 게이트웨이에서 공통 인증, Supabase DB, Gemini 2.5 AI를 공유하여 즉시 실행 및 테스트합니다.</p>
    </div>

    <div class="stats">
      <div class="stat-item"><div style="font-size: 0.8rem; color: var(--text-muted);">통합 서비스</div><div class="stat-val">5개 SaaS</div></div>
      <div class="stat-item"><div style="font-size: 0.8rem; color: var(--text-muted);">공유 DB</div><div class="stat-val">Supabase</div></div>
      <div class="stat-item"><div style="font-size: 0.8rem; color: var(--text-muted);">인공지능</div><div class="stat-val">Gemini 2.5</div></div>
      <div class="stat-item"><div style="font-size: 0.8rem; color: var(--text-muted);">게이트웨이 포트</div><div class="stat-val">:10000</div></div>
    </div>

    <div class="grid">
      <!-- AI Gwansang -->
      <div class="card">
        <div>
          <div class="card-top"><span class="icon">🔮</span><span class="badge">PORT 10000 / 8005</span></div>
          <h3>AI 관상 분석</h3>
          <p>얼굴 이미지와 Gemini AI를 결합하여 동물상, 재물운, 연애운, 직업운을 분석합니다.</p>
          <div class="tags"><span class="tag">얼굴 분석</span><span class="tag">동물상</span><span class="tag">Gemini 2.5 Flash</span></div>
        </div>
        <div class="actions"><button class="btn-main" onclick="openM('ai')">✨ 분석 체험하기</button></div>
      </div>

      <!-- StudyCafe -->
      <div class="card">
        <div>
          <div class="card-top"><span class="icon">☕</span><span class="badge">PORT 10000 / 8001</span></div>
          <h3>스터디카페 관리</h3>
          <p>실시간 좌석 현황, 이용권 차감, NFC 도어락 및 QR 체크인을 관리합니다.</p>
          <div class="tags"><span class="tag">실시간 좌석</span><span class="tag">이용권 관리</span><span class="tag">NFC 도어락</span></div>
        </div>
        <div class="actions"><button class="btn-main" style="background: linear-gradient(135deg, #06b6d4, #3b82f6);" onclick="openM('study')">🪑 좌석 입실 테스트</button></div>
      </div>

      <!-- Store -->
      <div class="card">
        <div>
          <div class="card-top"><span class="icon">🍽️</span><span class="badge">PORT 10000 / 8002</span></div>
          <h3>매장 QR 주문</h3>
          <p>스마트폰 QR 스캔으로 비대면 주문 및 토스 결제를 수행하고 주방으로 전송합니다.</p>
          <div class="tags"><span class="tag">테이블 QR</span><span class="tag">주방 디스플레이</span><span class="tag">토스 결제</span></div>
        </div>
        <div class="actions"><button class="btn-main" style="background: linear-gradient(135deg, #f59e0b, #ef4444);" onclick="openM('store')">📱 QR 주문 테스트</button></div>
      </div>

      <!-- SelfStudy -->
      <div class="card">
        <div>
          <div class="card-top"><span class="icon">📚</span><span class="badge">PORT 10000 / 8003</span></div>
          <h3>자기주도학습 관리</h3>
          <p>학생의 학습 목표 수립, 일일 진도 점검 및 Gemini AI 맞춤형 피드백을 제공합니다.</p>
          <div class="tags"><span class="tag">학습 플래너</span><span class="tag">AI 멘토 피드백</span><span class="tag">진도 기록</span></div>
        </div>
        <div class="actions"><button class="btn-main" style="background: linear-gradient(135deg, #10b981, #059669);" onclick="openM('self')">🎯 AI 학습 플랜</button></div>
      </div>

      <!-- SmartFarm -->
      <div class="card">
        <div>
          <div class="card-top"><span class="icon">🌿</span><span class="badge">PORT 10000 / 8004</span></div>
          <h3>스마트팜 IoT 제어</h3>
          <p>온도, 습도, CO2 센서 실시간 텔레메트리와 환풍/급수 자동 제어 및 AI 진단을 수행합니다.</p>
          <div class="tags"><span class="tag">센서 모니터링</span><span class="tag">자동 제어</span><span class="tag">AI 이상 진단</span></div>
        </div>
        <div class="actions"><button class="btn-main" style="background: linear-gradient(135deg, #6366f1, #8b5cf6);" onclick="openM('farm')">📊 센서 모니터링</button></div>
      </div>
    </div>
  </div>

  <div class="modal" id="modal" onclick="if(event.target.id==='modal')closeM()">
    <div class="modal-box">
      <div class="modal-head">
        <h3 id="mTitle" style="font-size: 1.25rem;">서비스</h3>
        <button class="close-btn" onclick="closeM()">&times;</button>
      </div>
      <div id="mBody"></div>
    </div>
  </div>

  <script>
    function openM(type) {
      const m = document.getElementById('modal');
      const title = document.getElementById('mTitle');
      const body = document.getElementById('mBody');

      if (type === 'ai') {
        title.textContent = '🔮 AI 관상 분석 (실시간 테스트)';
        body.innerHTML = `
          <label style="font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:0.4rem;">사용자 이름</label>
          <input type="text" id="gName" class="input" value="김민수">
          <button class="btn-main" style="width:100%;" onclick="runAi()">✨ Gemini AI 관상 분석 시작</button>
          <div id="gRes" class="res-box"></div>
        `;
      } else if (type === 'study') {
        title.textContent = '☕ 스터디카페 좌석 입실';
        body.innerHTML = `
          <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:0.75rem;">좌석 번호를 클릭한 후 입실 버튼을 누르세요.</p>
          <div class="seat-grid">
            ${Array.from({length:16}, (_,i)=>`<button class="seat-btn ${i===2||i===6?'selected':''}" onclick="document.querySelectorAll('.seat-btn').forEach(b=>b.classList.remove('selected'));this.classList.add('selected');">${i+1}번</button>`).join('')}
          </div>
          <button class="btn-main" style="width:100%; background:linear-gradient(135deg,#06b6d4,#3b82f6);" onclick="document.getElementById('sRes').style.display='block';document.getElementById('sRes').innerHTML='<span style=\\'color:#34d399;font-weight:700;\\'>✅ 입실 완료 (NFC 도어락 열림)</span>';">🪑 입실 처리</button>
          <div id="sRes" class="res-box"></div>
        `;
      } else if (type === 'store') {
        title.textContent = '🍽️ 매장 QR 주문';
        body.innerHTML = `
          <div style="background:rgba(255,255,255,0.03); padding:0.85rem; border-radius:8px; margin-bottom:1rem;">
            ☕ <b>아이스 아메리카노</b> (4,500원)<br>🥪 <b>바질 치킨 샌드위치</b> (8,500원)
          </div>
          <button class="btn-main" style="width:100%; background:linear-gradient(135deg,#f59e0b,#ef4444);" onclick="document.getElementById('stRes').style.display='block';document.getElementById('stRes').innerHTML='<span style=\\'color:#f59e0b;font-weight:700;\\'>🔔 Table 03번 주문 접수 완료 (#MQ-8821)</span>';">📱 토스페이 13,000원 결제</button>
          <div id="stRes" class="res-box"></div>
        `;
      } else if (type === 'self') {
        title.textContent = '📚 자기주도학습 AI 플랜';
        body.innerHTML = `
          <input type="text" class="input" value="고2 수학 (미적분 기본완성)">
          <button class="btn-main" style="width:100%; background:linear-gradient(135deg,#10b981,#059669);" onclick="document.getElementById('sfRes').style.display='block';document.getElementById('sfRes').innerHTML='<span style=\\'color:#10b981;font-weight:700;\\'>🤖 AI 주간 학습 플랜 생성 완료</span><br><br>• 월/수/금: 개념 40분 + 기본문제 40분 + 오답노트 40분<br>• AI 코멘트: 오답 회독 주기를 3일로 단축 권장';">🤖 Gemini AI 플랜 생성</button>
          <div id="sfRes" class="res-box"></div>
        `;
      } else if (type === 'farm') {
        title.textContent = '🌿 스마트팜 센서 텔레메트리';
        body.innerHTML = `
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-bottom:1rem;">
            <div style="background:rgba(255,255,255,0.05); padding:0.75rem; border-radius:8px; text-align:center;">온도: <b style="color:#38bdf8;">24.5°C</b></div>
            <div style="background:rgba(255,255,255,0.05); padding:0.75rem; border-radius:8px; text-align:center;">습도: <b style="color:#34d399;">68.2%</b></div>
          </div>
          <button class="btn-main" style="width:100%; background:linear-gradient(135deg,#6366f1,#8b5cf6);" onclick="document.getElementById('fmRes').style.display='block';document.getElementById('fmRes').innerHTML='<span style=\\'color:#38bdf8;font-weight:700;\\'>🌿 AI 센서 이상진단: 정상</span><br>현재 온·습도 밸런스가 작물 생육에 최적입니다.';">🌿 AI 이상 진단 실행</button>
          <div id="fmRes" class="res-box"></div>
        `;
      }
      m.classList.add('active');
    }
    function closeM() { document.getElementById('modal').classList.remove('active'); }

    async function runAi() {
      const box = document.getElementById('gRes');
      const name = document.getElementById('gName').value || '사용자';
      box.style.display = 'block';
      box.innerHTML = '<span style="color:#a855f7;">✨ Gemini AI가 얼굴 관상을 분석 중입니다...</span>';
      try {
        const res = await fetch('/api/ai_gwansang/analyze', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({image_data:'data:image/jpeg;base64,sample', user_name: name})
        });
        const data = await res.json();
        const r = data.result;
        box.innerHTML = `
          <div style="display:inline-block; padding:0.25rem 0.75rem; border-radius:20px; background:var(--grad); font-weight:700; margin-bottom:0.75rem;">${r.animalType || '지혜로운 백조상'} (${r.overallScore || 88}점)</div>
          <p style="margin-bottom:0.5rem;">${r.animalDescription || '눈매가 맑고 총명하며 신뢰감을 주는 귀상입니다.'}</p>
          <div style="font-size:0.85rem; color:var(--text-muted); line-height:1.5;">
            💰 <b>재물운</b>: ${r.wealthLuck}<br>
            💼 <b>직업운</b>: ${r.careerLuck}<br>
            ❤️ <b>연애운</b>: ${r.loveLuck}
          </div>
        `;
      } catch(e) { box.innerHTML = '<span style="color:#ef4444;">오류: ' + e.message + '</span>'; }
    }
  </script>
</body>
</html>
"""

with open(r"C:\Users\USER\dev\integrat\gateway\portal.html", "w", encoding="utf-8") as f:
    f.write(html)

print("portal.html created successfully!")