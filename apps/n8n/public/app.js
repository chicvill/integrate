// Nonghyup Bank Deposit Real-time Screen Monitor App

let deposits = [];

// Sample Nonghyup Email Templates
const SAMPLE_EMAILS = {
  sample1: `[NH농협 이메일 통지 서비스]
농협 계좌 입출금 내역을 안내해 드립니다.

- 계좌번호: 130027-52-081538
- 거래일시: 2026-08-12 10:15:30
- 구분: 입금
- 입금금액: 150,000 원
- 보내신분(적요): 홍길동
- 거래후잔액: 1,550,000 원
- 수신이메일: himin50@gmail.com
- 처리점: 농협은행`,

  sample2: `[NH농협] 계좌 입금 통지 안내

농협 계좌(130027-52-081538)에 입금 거래가 발생했습니다.

■ 거래일시: 2026-08-12 11:42:10
■ 거래구분: 입금
■ 입금액: 3,200,000원
■ 입금자(보낸이): (주)한국기업
■ 잔액: 4,750,000원
■ 수신함: himin50@gmail.com`,

  sample3: `[NH농협] 스마트알림 입금안내
130027-52-081538 계좌 입금 50,000원
일시: 2026-08-12 14:05:00
보내신분: 이농협
잔액: 4,800,000원`
};

document.addEventListener('DOMContentLoaded', () => {
  initDOM();
  connectSSE();
  setupSimulator();
});

// DOM Elements
let statusDot, statusText, depositTableBody, emptyState;
let totalAmountEl, totalCountEl, lastDepositTimeEl, lastDepositorEl;
let alertModal, modalDate, modalDepositor, modalAmount, modalBalance;
let closeModalBtn, confirmAlertBtn;
let rawEmailInput, emailSimForm;

function initDOM() {
  statusDot = document.getElementById('statusDot');
  statusText = document.getElementById('statusText');
  depositTableBody = document.getElementById('depositTableBody');
  emptyState = document.getElementById('emptyState');

  totalAmountEl = document.getElementById('totalAmount');
  totalCountEl = document.getElementById('totalCount');
  lastDepositTimeEl = document.getElementById('lastDepositTime');
  lastDepositorEl = document.getElementById('lastDepositor');

  alertModal = document.getElementById('alertModal');
  modalDate = document.getElementById('modalDate');
  modalDepositor = document.getElementById('modalDepositor');
  modalAmount = document.getElementById('modalAmount');
  modalBalance = document.getElementById('modalBalance');

  closeModalBtn = document.getElementById('closeModalBtn');
  confirmAlertBtn = document.getElementById('confirmAlertBtn');

  rawEmailInput = document.getElementById('rawEmailInput');
  emailSimForm = document.getElementById('emailSimForm');

  const downloadExcelBtn = document.getElementById('downloadExcelBtn');
  if (downloadExcelBtn) {
    downloadExcelBtn.addEventListener('click', () => {
      window.location.href = '/api/export/excel';
    });
  }

  // Modal events
  closeModalBtn.addEventListener('click', closeModal);
  confirmAlertBtn.addEventListener('click', closeModal);
  alertModal.addEventListener('click', (e) => {
    if (e.target === alertModal) closeModal();
  });

  // Preset button listeners
  document.getElementById('btnSample1').addEventListener('click', () => {
    rawEmailInput.value = SAMPLE_EMAILS.sample1;
  });
  document.getElementById('btnSample2').addEventListener('click', () => {
    rawEmailInput.value = SAMPLE_EMAILS.sample2;
  });
  document.getElementById('btnSample3').addEventListener('click', () => {
    rawEmailInput.value = SAMPLE_EMAILS.sample3;
  });

  // Default value for simulator
  rawEmailInput.value = SAMPLE_EMAILS.sample1;
}

// Connect to Server-Sent Events (SSE) Stream
function connectSSE() {
  const evtSource = new EventSource('/api/stream');

  evtSource.onopen = () => {
    statusDot.style.backgroundColor = '#00b050';
    statusText.textContent = '실시간 연결 됨 (감지 중)';
  };

  evtSource.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.type === 'CONNECTED') {
        if (data.history && data.history.length > 0) {
          deposits = data.history;
          renderTable();
          updateStats();
        }
      } else if (data.type === 'NEW_DEPOSIT') {
        handleNewDeposit(data.deposit);
      }
    } catch (err) {
      console.error('SSE JSON Error:', err);
    }
  };

  evtSource.onerror = (err) => {
    statusDot.style.backgroundColor = '#ef4444';
    statusText.textContent = '연결 재시도 중...';
  };
}

// Handle New Deposit Event
function handleNewDeposit(deposit) {
  deposits.unshift(deposit);
  renderTable(true); // highlight first row
  updateStats();
  triggerScreenAlert(deposit);
  playNotificationSound();
}

// Render Table
function renderTable(highlightFirst = false) {
  if (deposits.length === 0) {
    emptyState.style.display = 'flex';
    depositTableBody.innerHTML = '';
    return;
  }

  emptyState.style.display = 'none';
  depositTableBody.innerHTML = deposits.map((d, index) => {
    const isNew = highlightFirst && index === 0 ? 'new-row' : '';
    return `
      <tr class="${isNew}">
        <td class="cell-time">${escapeHtml(d.depositDate)}</td>
        <td><span class="cell-depositor">${escapeHtml(d.depositor)}</span></td>
        <td class="cell-amount">+${d.amount.toLocaleString()} 원</td>
        <td class="cell-balance">${d.balance ? d.balance.toLocaleString() + ' 원' : '-'}</td>
        <td><span class="badge live-badge">입금완료</span></td>
      </tr>
    `;
  }).join('');
}

// Update Stats
function updateStats() {
  if (deposits.length === 0) return;

  const totalSum = deposits.reduce((acc, cur) => acc + (cur.amount || 0), 0);
  totalAmountEl.textContent = `${totalSum.toLocaleString()} 원`;
  totalCountEl.textContent = `${deposits.length} 건`;

  const latest = deposits[0];
  lastDepositTimeEl.textContent = latest.depositDate || '-';
  lastDepositorEl.textContent = `${latest.depositor} 님`;
}

// Trigger Large On-Screen Alert Modal
function triggerScreenAlert(deposit) {
  modalDate.textContent = deposit.depositDate || '지금';
  modalDepositor.textContent = `${deposit.depositor} 님`;
  modalAmount.textContent = `+${(deposit.amount || 0).toLocaleString()} 원`;
  modalBalance.textContent = deposit.balance ? `거래 후 잔액: ${deposit.balance.toLocaleString()} 원` : '';

  alertModal.classList.remove('hidden');
}

function closeModal() {
  alertModal.classList.add('hidden');
}

// Web Audio API Synthesized Chime Sound (No external asset dependency)
function playNotificationSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const now = ctx.currentTime;
    
    // Note 1 (E5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.5);

    // Note 2 (B5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(987.77, now + 0.15);
    gain2.gain.setValueAtTime(0.4, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.8);
  } catch (e) {
    console.log('Audio playback prevented by browser policy until user click');
  }
}

// Simulator Setup
function setupSimulator() {
  emailSimForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = rawEmailInput.value.trim();
    if (!text) return alert('이메일 텍스트를 입력해주세요.');

    try {
      const res = await fetch('/api/simulate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawEmailText: text })
      });
      const json = await res.json();
      if (!json.success) {
        alert('시뮬레이션 오류: ' + (json.error || '알 수 없는 오류'));
      }
    } catch (err) {
      alert('서버 통신 실패: ' + err.message);
    }
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
