/**
 * apps/rent/frontend/js/voice.js
 * 원룸 임차료 관리 시스템 음성인식(STT) 및 말로 입력 컨트롤러.
 * Web Speech API 기반 한국어 음성 명령 파싱 및 입금 2단계 대화형 승인 처리.
 */

import { state, currentYear, currentMonth } from './state.js?v=2.0';
import { handleProcessPayment, selectRoom, renderAll } from './ui.js?v=2.0';
import { apiProcessPayment } from './api.js?v=2.0';
import {
  openContractEditModal,
  openExcelImportModal,
  openExpiryNoticeModal,
  openExpenseModal,
  exportFullSystemBackupJSON,
  triggerFullSystemRestoreFile,
  exportAllRoomsCSV,
  exportCurrentRoomCSV,
  openVatModal
} from './modals.js?v=2.0';

// 2단계 승인 대기 상태 저장 객체
let pendingVoicePayment = null;

// 음성 합성(TTS) 지원 (콜백 지원)
export function speakText(text, onEndCallback = null) {
  if (!('speechSynthesis' in window)) {
    if (onEndCallback) onEndCallback();
    return;
  }
  try {
    window.speechSynthesis.cancel(); // 이전 재생 취소
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    
    if (onEndCallback) {
      utterance.onend = () => { onEndCallback(); };
      utterance.onerror = () => { onEndCallback(); };
    }
    
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn("TTS 실행 실패:", e);
    if (onEndCallback) onEndCallback();
  }
}

// 한글 말소리 숫자를 아라비아 숫자로 변환
export function parseKoreanNumber(str) {
  if (!str) return null;
  const clean = str.replace(/\s+/g, '');
  
  // 이미 아라비아 숫자가 포함된 경우 (예: "203", "203호")
  const numMatch = clean.match(/(\d{3})/);
  if (numMatch) {
    return parseInt(numMatch[1], 10);
  }

  // 한글 숫자 매핑 (예: "이백삼", "칠백일", "백일")
  const digitMap = { '영': 0, '공': 0, '일': 1, '이': 2, '삼': 3, '사': 4, '오': 5, '육': 6, '칠': 7, '팔': 8, '구': 9 };
  
  // 백단위 패턴: (일|이|삼|사|오|육|칠)?백 (영|공|일|이|삼|사|오|육|칠|팔|구)? (일|이|삼|사|오)?
  const baekMatch = clean.match(/(일|이|삼|사|오|육|칠)?백(.*)/);
  if (baekMatch) {
    const hDigit = baekMatch[1] ? digitMap[baekMatch[1]] : 1;
    let rest = baekMatch[2] || '';
    rest = rest.replace(/호.*/, ''); // "호" 이후 제거
    
    let tDigit = 0;
    let uDigit = 0;
    
    if (rest.includes('십')) {
      const parts = rest.split('십');
      tDigit = parts[0] ? (digitMap[parts[0]] || 1) : 1;
      uDigit = parts[1] ? (digitMap[parts[1]] || 0) : 0;
    } else if (rest.length === 2) {
      tDigit = digitMap[rest[0]] || 0;
      uDigit = digitMap[rest[1]] || 0;
    } else if (rest.length === 1) {
      uDigit = digitMap[rest[0]] || 0;
    }
    
    const val = (hDigit * 100) + (tDigit * 10) + uDigit;
    if (val >= 101 && val <= 705) return val;
  }
  
  return null;
}

/**
 * 특정 호실의 전입 이후 가장 오래된 미납 회차 탐색
 */
export function findOldestUnpaidPeriod(roomNumber) {
  const room = state.rooms[roomNumber];
  if (!room) {
    return { error: `${roomNumber}호 정보를 찾을 수 없습니다.` };
  }
  if (!room.name) {
    return { error: `${roomNumber}호는 현재 세입자가 없는 공실입니다.` };
  }

  // 1. 전입일 파싱 (YYYY-MM-DD 등)
  let moveInYear = 0;
  let moveInMonth = 0;
  if (room.move_in) {
    const m = String(room.move_in).match(/(\d{4})[-./년\s]*(\d{1,2})/);
    if (m) {
      moveInYear = parseInt(m[1], 10);
      moveInMonth = parseInt(m[2], 10);
    }
  }

  // 2. 납부 내역 정규화 및 수집 (복합키/단순키 중복 제거)
  const paymentsList = [];
  const seen = new Set();
  if (room.payments) {
    for (const p of Object.values(room.payments)) {
      if (!p || typeof p !== 'object' || !p.year || !p.month) continue;
      const key = `${p.year}-${p.month}`;
      if (!seen.has(key)) {
        seen.add(key);
        paymentsList.push(p);
      }
    }
  }

  // 과거부터 최신순으로 정렬 (오름차순)
  paymentsList.sort((a, b) => (a.year - b.year) || (a.month - b.month));

  // 3. 전입일 이후 & 미납 회차 필터링
  const unpaidList = paymentsList.filter(p => {
    // 전입일 이전 회차는 전 세입자 영역이므로 제외
    if (moveInYear > 0) {
      if (p.year < moveInYear || (p.year === moveInYear && p.month < moveInMonth)) {
        return false;
      }
    }
    // 미납 상태인 것만
    return !p.paid;
  });

  if (unpaidList.length === 0) {
    return {
      allPaid: true,
      room: room,
      message: `${roomNumber}호 (${room.name})는 이미 전액 완납되어 미납 내역이 없습니다.`
    };
  }

  const oldest = unpaidList[0];
  const isMoveInMonth = (moveInYear > 0 && oldest.year === moveInYear && oldest.month === moveInMonth);
  const isPostpaid = (room.pay_timing === "후불" || !room.pay_timing);
  const totalRent = (room.lease_type === "전세" ? 0 : (room.rent || 0)) + (room.maintenance || 0);

  return {
    success: true,
    target: oldest,
    room: room,
    isMoveInMonth: isMoveInMonth,
    isPostpaid: isPostpaid,
    unpaidCount: unpaidList.length,
    totalRent: totalRent
  };
}

// 음성인식 인스턴스 싱글톤
let recognition = null;
let isListening = false;
let isProcessingVoice = false;

export function initVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn("이 브라우저는 Web Speech API를 지원하지 않습니다.");
    return null;
  }

  const rec = new SpeechRecognition();
  rec.lang = 'ko-KR';
  rec.continuous = false; // 단발 명령 위주
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  rec.onstart = () => {
    isListening = true;
    updateVoiceUIState('listening');
  };

  rec.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    const displayText = finalTranscript || interimTranscript;
    updateVoiceTranscript(displayText);

    if (finalTranscript) {
      handleVoiceCommand(finalTranscript.trim());
    }
  };

  rec.onerror = (event) => {
    console.warn("음성 인식 오류:", event.error);
    isListening = false;
    if (event.error === 'not-allowed') {
      updateVoiceUIState('error', '🎙️ 마이크 권한 차단됨 (not-allowed)');
      const helpHtml = `
        <div class="text-[11px] text-rose-300 font-bold mb-1">⚠️ 브라우저 마이크 권한이 차단되었습니다</div>
        <div class="text-[10px] text-slate-300 leading-relaxed text-left bg-slate-900/90 p-2.5 rounded-lg border border-rose-800/40 space-y-1">
          <div>• <b>원인:</b> 스마트폰/크롬 보안 정책상 HTTP(IP 접속) 사이트에서는 마이크가 자동 차단됩니다.</div>
          <div class="pt-1">• <b>해결 (1):</b> 주소창 왼쪽 <b>설정/자물쇠 아이콘 탭 ➡️ 마이크 '허용'</b></div>
          <div>• <b>해결 (2) 크롬 모바일:</b> 주소창에 <code class="text-cyan-300">chrome://flags</code> 접속 ➡️ <code class="text-amber-300">unsafely-treat-insecure-origin-as-secure</code> 검색 후 <b>Enabled</b> 및 <code class="text-cyan-300">http://34.31.10.12</code> 입력 후 Relaunch</div>
        </div>
      `;
      updateVoiceStatus('error', helpHtml);
    } else if (event.error !== 'no-speech') {
      updateVoiceUIState('error', `음성 인식 오류 (${event.error})`);
    } else {
      updateVoiceUIState('idle');
    }
  };

  rec.onend = () => {
    isListening = false;
    if (!isProcessingVoice) {
      updateVoiceUIState('idle');
    }
  };

  return rec;
}

export async function startVoiceRecognition() {
  openVoiceModal();

  const isPermissionGranted = localStorage.getItem('RENT_MIC_PERMISSION_GRANTED') === 'true';

  // 처음 실행하거나 권한 확인이 필요한 경우: 명시적 승인 안내 화면 표시
  if (!isPermissionGranted) {
    showMicrophonePermissionPrompt();
    return;
  }

  // 이미 승인 이력이 있는 경우 바로 음성 수신 세션 시작
  await startListeningSession();
}

/**
 * 최초 사용자 마이크 사용 승인 요청 화면 표시
 */
function showMicrophonePermissionPrompt() {
  updateVoiceUIState('idle');
  updateVoiceTranscript('말로 입력을 사용하려면 마이크 권한 승인이 필요합니다.');
  
  const promptHtml = `
    <div class="p-2 text-center">
      <div class="text-sm font-extrabold text-white mb-1 flex items-center justify-center gap-1.5">
        <span class="text-rose-400">🎙️</span> 마이크 사용 승인
      </div>
      <p class="text-[11px] text-slate-300 leading-snug mb-3">
        "203호 입금" 같은 음성 명령을 편리하게 사용하시려면<br>
        마이크 사용 권한 승인이 필요합니다.
      </p>
      <button type="button" onclick="requestMicrophonePermissionAndStart()" class="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-black text-xs shadow-lg shadow-rose-950/60 border border-rose-300/30 transition cursor-pointer active:scale-95 flex items-center justify-center gap-2">
        <span class="text-base">🎙️</span>
        <span>마이크 사용 허용하고 시작하기</span>
      </button>
      <div class="text-[10px] text-slate-400 mt-2">
        ※ 버튼을 누르면 브라우저의 <b>[허용]</b> 팝업이 표시됩니다.
      </div>
    </div>
  `;
  updateVoiceStatus('confirm', promptHtml);
}

/**
 * '마이크 사용 허용하고 시작하기' 버튼 터치 시 호출 (명시적 User Gesture)
 */
export async function requestMicrophonePermissionAndStart() {
  updateVoiceStatus('confirm', `
    <div class="p-2 text-center text-xs font-bold text-cyan-300">
      ⏳ 마이크 권한 확인 중...<br>
      <span class="text-[10px] text-slate-300 font-normal">화면에 팝업이 뜨면 <b>[허용]</b>을 눌러주세요.</span>
    </div>
  `);

  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // 권한 허용 성공! 스트림 즉시 해제
      stream.getTracks().forEach(t => t.stop());
      localStorage.setItem('RENT_MIC_PERMISSION_GRANTED', 'true');
      
      updateVoiceStatus('success', '✅ 마이크 사용이 승인되었습니다! 음성을 듣습니다.');
      setTimeout(() => {
        startListeningSession();
      }, 500);
      return;
    } catch (err) {
      console.warn("마이크 getUserMedia 요청 거절/오류:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        updateVoiceUIState('error', '🎙️ 마이크 권한 차단됨');
        const helpHtml = `
          <div class="text-[11px] text-rose-300 font-bold mb-1">⚠️ 브라우저 마이크 권한이 차단되었습니다</div>
          <div class="text-[10px] text-slate-300 leading-relaxed text-left bg-slate-900/90 p-2.5 rounded-lg border border-rose-800/40 space-y-1">
            <div>• <b>원인:</b> 브라우저에서 사이트의 마이크 권한이 차단 상태입니다.</div>
            <div class="pt-1">• <b>해결 방법:</b> 주소창 왼쪽 <b>설정/자물쇠(Tune) 아이콘</b>을 눌러 <b>마이크를 '허용'</b>으로 변경한 뒤 다시 눌러주세요.</div>
          </div>
        `;
        updateVoiceStatus('error', helpHtml);
        return;
      }
    }
  }

  // getUserMedia 미지원 브라우저 폴백
  localStorage.setItem('RENT_MIC_PERMISSION_GRANTED', 'true');
  startListeningSession();
}

/**
 * 실제 음성인식 세션 시작
 */
async function startListeningSession() {
  if (!recognition) {
    recognition = initVoiceRecognition();
  }

  if (!recognition) {
    alert("현재 브라우저에서는 음성 인식을 지원하지 않습니다.\n(Chrome 또는 Safari 최신 버전 권장)");
    return;
  }

  updateVoiceStatus('idle', '');
  updateVoiceUIState('listening');
  updateVoiceTranscript('말씀해주세요... (예: "203호 입금", "501호 선택")');

  try {
    recognition.start();
  } catch (e) {
    console.warn("음성 인식 이미 동작 중이거나 시작 실패:", e);
  }
}

export function resumeListening() {
  if (!recognition) {
    recognition = initVoiceRecognition();
  }
  if (recognition) {
    try { recognition.stop(); } catch (e) {}
    setTimeout(() => {
      try {
        recognition.start();
        updateVoiceUIState('listening');
      } catch (e) {
        console.warn("마이크 재개 대기 중:", e);
      }
    }, 250);
  }
}

export function stopVoiceRecognition() {
  if (recognition && isListening) {
    try { recognition.stop(); } catch (e) {}
  }
  isListening = false;
  closeVoiceModal();
}

/**
 * 한국어 구두 명령 번호 파싱 ("1번", "2번", ..., "12번" 또는 "일번", "이번" 등)
 */
export function parseMenuNumber(rawText) {
  if (!rawText) return null;
  const clean = rawText.replace(/\s+/g, '').toLowerCase();

  // "1번", "1", "12번" 등 순수 숫자 매칭
  const numMatch = clean.match(/^(\d{1,2})번?$/);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    if (n >= 1 && n <= 12) return n;
  }

  // 문장 중에 "1번", "12번" 등이 포함된 경우
  const insideMatch = clean.match(/(\d{1,2})번/);
  if (insideMatch) {
    const n = parseInt(insideMatch[1], 10);
    if (n >= 1 && n <= 12) return n;
  }

  const map = {
    '일번': 1, '첫번째': 1, '하나': 1,
    '이번': 2, '두번째': 2, '둘': 2,
    '삼번': 3, '세번째': 3, '셋': 3,
    '사번': 4, '네번째': 4, '넷': 4,
    '오번': 5, '다섯번째': 5, '다섯': 5,
    '육번': 6, '여섯번째': 6, '여섯': 6,
    '칠번': 7, '일곱번째': 7, '일곱': 7,
    '팔번': 8, '여덟번째': 8, '여덟': 8,
    '구번': 9, '아홉번째': 9, '아홉': 9,
    '십번': 10, '열번째': 10, '열': 10,
    '십일번': 11, '열한번째': 11,
    '십이번': 12, '열두번째': 12
  };

  for (const [k, v] of Object.entries(map)) {
    if (clean.includes(k)) return v;
  }
  return null;
}

/**
 * Rent 구두 명령 1~12번 실행기 (말, 터치, 번호 선택 공통 단일 진입점)
 */
export async function executeVoiceCommandById(cmdId, targetRoom = null) {
  const rNum = targetRoom || parseKoreanNumber(String(targetRoom)) || state.selectedRoom || 203;

  switch (Number(cmdId)) {
    case 1: // 1. 203호 수납(입금 등) -> 입금 처리
      await executeVoicePayment(rNum);
      break;

    case 2: // 2. 203호 전출(퇴실, 공실처리, 이사 등) -> 전출 처리
      closeVoiceModal();
      selectRoom(rNum);
      if (typeof openContractEditModal === 'function') {
        openContractEditModal(rNum);
      } else if (window.openContractEditModal) {
        window.openContractEditModal(rNum);
      }
      setTimeout(() => {
        const moveOutEl = document.getElementById('formMoveOut');
        if (moveOutEl) {
          if (!moveOutEl.value) {
            moveOutEl.value = new Date().toISOString().split('T')[0];
          }
          moveOutEl.focus();
        }
      }, 200);
      speakText(`${rNum}호 전출 및 퇴실 처리 창을 열었습니다.`);
      break;

    case 3: // 3. 203호 전입(등록 등) -> 계약서 사진, 엑셀 붙여넣기 등록
      closeVoiceModal();
      selectRoom(rNum);
      if (typeof openExcelImportModal === 'function') {
        openExcelImportModal();
      } else if (window.openExcelImportModal) {
        window.openExcelImportModal();
      }
      speakText(`${rNum}호 전입 및 계약서 사진/엑셀 등록 창을 열었습니다.`);
      break;

    case 4: // 4. 203호 수정, 삭제
      closeVoiceModal();
      selectRoom(rNum);
      if (typeof openContractEditModal === 'function') {
        openContractEditModal(rNum);
      } else if (window.openContractEditModal) {
        window.openContractEditModal(rNum);
      }
      speakText(`${rNum}호 계약 정보 수정 및 삭제 창을 열었습니다.`);
      break;

    case 5: // 5. 203호 납입현황(월별, 1년간) 엑셀, pdf
      closeVoiceModal();
      selectRoom(rNum);
      if (typeof exportCurrentRoomCSV === 'function') {
        exportCurrentRoomCSV();
      } else if (window.exportCurrentRoomCSV) {
        window.exportCurrentRoomCSV();
      }
      speakText(`${rNum}호 월별 납입현황 엑셀을 다운로드하고 인쇄 화면을 준비합니다.`);
      setTimeout(() => {
        if (confirm(`${rNum}호 납입현황 엑셀(CSV)이 다운로드되었습니다.\n\nA4 인쇄 / PDF 저장을 실행하시겠습니까?`)) {
          window.print();
        }
      }, 600);
      break;

    case 6: // 6. 일괄 등록 -> 사진, 엑셀 붙여넣기
      closeVoiceModal();
      if (typeof openExcelImportModal === 'function') {
        openExcelImportModal();
      } else if (window.openExcelImportModal) {
        window.openExcelImportModal();
      }
      speakText("사진 및 엑셀 일괄 등록 창을 열었습니다.");
      break;

    case 7: // 7. 만기 확인
      closeVoiceModal();
      if (typeof openExpiryNoticeModal === 'function') {
        openExpiryNoticeModal();
      } else if (window.openExpiryNoticeModal) {
        window.openExpiryNoticeModal();
      }
      speakText("만기 도래 호실 확인 창을 열었습니다.");
      break;

    case 8: // 8. 지출등록
      closeVoiceModal();
      if (typeof openExpenseModal === 'function') {
        openExpenseModal();
      } else if (window.openExpenseModal) {
        window.openExpenseModal();
      }
      speakText("오늘의 지출 내역 등록 창을 열었습니다.");
      break;

    case 9: // 9. 데이터 백업 및 복구 -> json/엑셀
      const promptHtml = `
        <div class="p-2 text-center space-y-2">
          <div class="text-xs font-bold text-emerald-300">💾 데이터 백업 및 복구</div>
          <p class="text-[11px] text-slate-300">원하시는 데이터 관리 작업을 선택해주세요.</p>
          <div class="grid grid-cols-2 gap-2 pt-1">
            <button type="button" onclick="exportFullSystemBackupJSON(); closeVoiceModal();" class="py-2 px-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs shadow cursor-pointer active:scale-95 transition">
              💾 전체 백업 다운로드
            </button>
            <button type="button" onclick="triggerFullSystemRestoreFile(); closeVoiceModal();" class="py-2 px-1.5 rounded-xl bg-indigo-700 hover:bg-indigo-600 text-white font-bold text-xs shadow cursor-pointer active:scale-95 transition">
              📂 백업 파일 복원
            </button>
          </div>
        </div>
      `;
      updateVoiceStatus('confirm', promptHtml);
      speakText("전체 데이터 백업 다운로드 또는 복원 작업을 선택해주세요.");
      break;

    case 10: // 10. 월별 통계-> 엑셀, pdf
      closeVoiceModal();
      if (typeof exportAllRoomsCSV === 'function') {
        exportAllRoomsCSV();
      } else if (window.exportAllRoomsCSV) {
        window.exportAllRoomsCSV();
      }
      speakText("전체 호실의 월별 수납 및 계약대장 엑셀을 다운로드합니다.");
      break;

    case 11: // 11. 부가가치세(부가세, 부가세 자료 산출 등)
      closeVoiceModal();
      if (typeof openVatModal === 'function') {
        openVatModal();
      } else if (window.openVatModal) {
        window.openVatModal();
      }
      speakText("부가가치세 신고 및 세무 자료 산출 창을 열었습니다.");
      break;

    case 12: // 12. 도움말(사용법 등)
      window.open('./manual.html', '_blank');
      closeVoiceModal();
      speakText("운영 매뉴얼 도움말을 새 창으로 열었습니다.");
      break;

    default:
      console.warn("알 수 없는 구두 명령 번호:", cmdId);
      break;
  }
}

/**
 * 인식된 음성 문장 처리 핸들러 (대화형 2단계 승인 및 1~12번 구두 명령 지원)
 */
export async function handleVoiceCommand(rawText) {
  if (isProcessingVoice) return;
  isProcessingVoice = true;

  try {
    updateVoiceTranscript(`🗣️ "${rawText}" 분석 중...`);

    // ── 1. 승인 대기 중(Pending)일 때: 예/응/ok/yes 또는 아니오/취소 판정 ──
    if (pendingVoicePayment) {
      const clean = rawText.replace(/\s+/g, '').toLowerCase();

      // 긍정 확인 패턴: 예, 네, 응, 어, 그래, 맞아, 오케이, ok, yes, y, 진행, 수납, 입금, 확인, 처리
      const isAffirmative = /^(예|네|응|어|그래|맞아|오케이|ok|yes|y|진행|수납|입금|확인|처리|해줘|할래)/i.test(clean) ||
                            /예|네|응|오케이|ok|yes|진행|확인|수납/i.test(clean);

      // 부정 취소 패턴: 아니, 아니오, 아니요, 취소, 싫어, no, n, 하지마, 그만, 멈춰
      const isNegative = /^(아니|아니오|아니요|취소|싫어|no|n|하지마|그만|멈춰)/i.test(clean) ||
                         /아니|취소|no|하지마/i.test(clean);

      if (isAffirmative) {
        await confirmVoicePayment();
        isProcessingVoice = false;
        return;
      } else if (isNegative) {
        cancelVoicePayment();
        isProcessingVoice = false;
        return;
      } else {
        // 호실 번호가 새로 들어온 경우 신규 명령으로 대체
        const newRoomNum = parseKoreanNumber(rawText);
        if (newRoomNum && /입금|수납/.test(rawText)) {
          pendingVoicePayment = null;
          await executeVoicePayment(newRoomNum);
          isProcessingVoice = false;
          return;
        }

        const retryMsg = "확인을 위해 '예' 또는 '아니오'로 말씀하시거나 확인 버튼을 눌러주세요.";
        updateVoiceStatus('warning', retryMsg);
        speakText(retryMsg, () => {
          resumeListening();
        });
        isProcessingVoice = false;
        return;
      }
    }

    // ── 2. 번호 기반 구두 명령 파싱 ("1번", "2번", ..., "12번") ──
    const menuNum = parseMenuNumber(rawText);
    const roomNumber = parseKoreanNumber(rawText);

    if (menuNum) {
      await executeVoiceCommandById(menuNum, roomNumber);
      isProcessingVoice = false;
      return;
    }

    // ── 3. 키워드 기반 자연어 구두 명령 파싱 ──
    // 1. 수납 / 입금
    if (/수납|입금|완납|납부|넣었/.test(rawText)) {
      await executeVoiceCommandById(1, roomNumber);
      isProcessingVoice = false;
      return;
    }

    // 2. 전출 / 퇴실 / 공실처리 / 이사
    if (/전출|퇴실|공실처리|공실|이사/.test(rawText)) {
      await executeVoiceCommandById(2, roomNumber);
      isProcessingVoice = false;
      return;
    }

    // 3. 전입 / 신규 계약 / 등록
    if (/전입|신규계약|등록/.test(rawText) && !/지출|일괄/.test(rawText)) {
      await executeVoiceCommandById(3, roomNumber);
      isProcessingVoice = false;
      return;
    }

    // 4. 수정 / 삭제 / 변경
    if (/수정|삭제|변경|고치|바꿔/.test(rawText)) {
      await executeVoiceCommandById(4, roomNumber);
      isProcessingVoice = false;
      return;
    }

    // 5. 납입현황 / 현황 / 1년간 / 엑셀
    if (/납입현황|납부현황|현황|1년/.test(rawText)) {
      await executeVoiceCommandById(5, roomNumber);
      isProcessingVoice = false;
      return;
    }

    // 6. 일괄 등록
    if (/일괄|일괄등록|사진등록|엑셀붙여넣기/.test(rawText)) {
      await executeVoiceCommandById(6);
      isProcessingVoice = false;
      return;
    }

    // 7. 만기 확인
    if (/만기|만기확인|만기안내/.test(rawText)) {
      await executeVoiceCommandById(7);
      isProcessingVoice = false;
      return;
    }

    // 8. 지출등록
    if (/지출|지출등록|비용|영수증/.test(rawText)) {
      await executeVoiceCommandById(8);
      isProcessingVoice = false;
      return;
    }

    // 9. 데이터 백업 및 복구
    if (/백업|복구|복원|데이터백업|데이터복구/.test(rawText)) {
      await executeVoiceCommandById(9);
      isProcessingVoice = false;
      return;
    }

    // 10. 월별 통계
    if (/통계|월별통계|종합통계/.test(rawText)) {
      await executeVoiceCommandById(10);
      isProcessingVoice = false;
      return;
    }

    // 11. 부가가치세 / 부가세
    if (/부가가치세|부가세|세무|홈택스/.test(rawText)) {
      await executeVoiceCommandById(11);
      isProcessingVoice = false;
      return;
    }

    // 12. 도움말 / 매뉴얼
    if (/도움말|사용법|매뉴얼|설명서/.test(rawText)) {
      await executeVoiceCommandById(12);
      isProcessingVoice = false;
      return;
    }

    // ── 4. 호실 단독 선택 ──
    if (roomNumber) {
      selectRoom(roomNumber);
      const room = state.rooms[roomNumber];
      const name = (room && room.name) ? room.name : "공실";
      const msg = `${roomNumber}호 (${name}) 카드를 열었습니다. "입금", "전출", "수정", "현황" 등 구두 명령을 말씀하세요.`;
      updateVoiceStatus('success', msg);
      speakText(msg);
      isProcessingVoice = false;
      return;
    }

    // ── 5. 인식 불가 시 예문 가이드 ──
    const msg = `인식된 명령이 없습니다. 예문의 번호(1~12번)나 "203호 입금" 처럼 말씀해주세요.`;
    updateVoiceStatus('warning', msg);
    speakText(msg, () => {
      resumeListening();
    });
  } catch (err) {
    updateVoiceStatus('error', "명령 처리 중 오류: " + err.message);
  } finally {
    isProcessingVoice = false;
  }
}

/**
 * "203호 입금" 발화 시:
 * 전입 이후 가장 오래된 미납 회차 1건을 탐색하고 사용자에게 승인 확인(y/n)을 질의
 */
async function executeVoicePayment(roomNumber) {
  const result = findOldestUnpaidPeriod(roomNumber);

  if (result.error) {
    updateVoiceStatus('error', result.error);
    speakText(result.error);
    return;
  }

  if (result.allPaid) {
    updateVoiceStatus('info', result.message);
    speakText(`${roomNumber}호는 이미 전액 완납되어 미납 내역이 없습니다.`);
    selectRoom(roomNumber);
    setTimeout(() => closeVoiceModal(), 2000);
    return;
  }

  const { target, room, isMoveInMonth, isPostpaid, unpaidCount, totalRent } = result;
  const payYear = target.year;
  const payMonth = target.month;
  const tenantName = room.name;
  const rentFormatted = totalRent.toLocaleString();

  // 대기 상태(pendingVoicePayment) 보관
  pendingVoicePayment = {
    roomNumber,
    year: payYear,
    month: payMonth,
    tenantName,
    totalRent,
    unpaidCount,
    isMoveInMonth,
    isPostpaid,
    room,
    target
  };

  selectRoom(roomNumber);

  let noticeExtra = "";
  if (isMoveInMonth && isPostpaid) {
    noticeExtra = `<div class="text-[10px] text-amber-300 mt-1">⚠️ 입주월 후불 청구 회차입니다.</div>`;
  }

  // 안내문 구성: '203호 2월분 (350,000원) 수납 처리하시겠습니까? y/n'
  const promptHtml = `
    <div class="p-2">
      <div class="text-xs text-slate-300 font-semibold mb-1">
        ${tenantName} 님 · 남은 미납 <b class="text-rose-400">${unpaidCount}건</b>
      </div>
      <div class="text-sm font-extrabold text-white">
        🔔 <span class="text-cyan-300 font-mono">${roomNumber}호</span> <span class="text-slate-100">${payMonth}월분</span>
        <span class="text-emerald-400 font-mono">(${rentFormatted}원)</span>
      </div>
      <div class="text-xs text-cyan-200 font-bold mt-1.5">
        수납 처리하시겠습니까? <span class="text-amber-400 font-mono underline font-black">y/n</span>
      </div>
      ${noticeExtra}
      <div class="text-[10px] text-slate-400 mt-2 bg-slate-900/80 px-2 py-1 rounded-lg border border-slate-700/60">
        🗣️ <b>'예/응/ok/yes'</b>로 대답하거나 아래 <b>확인 버튼</b>을 누르세요.
      </div>
    </div>
  `;

  updateVoiceStatus('confirm', promptHtml);
  showVoiceConfirmButtons(true);

  // 음성(TTS)으로 질의 후 자동으로 마이크 재개
  const ttsQuestion = `${roomNumber}호 ${payMonth}월분 ${totalRent}원 수납 처리하시겠습니까?`;
  speakText(ttsQuestion, () => {
    resumeListening();
  });
}

/**
 * 2단계 승인 확정 (사용자가 '예' 또는 확인 버튼 클릭 시)
 */
export async function confirmVoicePayment() {
  if (!pendingVoicePayment) return;
  const { roomNumber, year, month, tenantName, totalRent, unpaidCount, room } = pendingVoicePayment;
  pendingVoicePayment = null;
  showVoiceConfirmButtons(false);

  const rentFormatted = totalRent.toLocaleString();
  const defaultPayDate = `${year}-${String(month).padStart(2, '0')}-10`;
  const note = `[음성승인] ${year}년 ${month}월분`;

  updateVoiceStatus('success', `⏳ ${roomNumber}호 ${month}월분 (${rentFormatted}원) 수납 승인 처리 중...`);

  try {
    if (state.isOnline) {
      const updatedRoom = await apiProcessPayment(
        roomNumber,
        month,
        state.currentBranch,
        defaultPayDate,
        note,
        tenantName,
        year
      );
      state.rooms[roomNumber] = updatedRoom;
    } else {
      // 오프라인 폴백
      if (room.payments) {
        const pKey = `${year}-${month}`;
        const payObj = {
          month: month,
          year: year,
          paid: true,
          paid_date: defaultPayDate,
          note: note,
          tenant_name: tenantName,
          is_previous_tenant: false,
          rent_amount: room.lease_type === "전세" ? 0 : room.rent,
          maintenance_amount: room.maintenance
        };
        room.payments[month] = payObj;
        room.payments[pKey] = payObj;
      }
    }

    selectRoom(roomNumber);
    renderAll();

    const successMsg = `✅ ${roomNumber}호 ${tenantName} 님, ${year}년 ${month}월분 (${rentFormatted}원) 수납 완료! (남은 미납: ${unpaidCount - 1}건)`;
    updateVoiceStatus('success', successMsg);
    speakText(`${roomNumber}호 ${month}월분 수납 처리가 완료되었습니다.`);

    setTimeout(() => {
      closeVoiceModal();
    }, 2500);

  } catch (err) {
    updateVoiceStatus('error', `수납 처리 실패: ${err.message}`);
    speakText(`수납 처리에 실패했습니다.`);
  }
}

/**
 * 2단계 승인 거절 / 취소 (사용자가 '아니오' 또는 취소 버튼 클릭 시)
 */
export function cancelVoicePayment() {
  if (!pendingVoicePayment) {
    closeVoiceModal();
    return;
  }
  const { roomNumber, month } = pendingVoicePayment;
  pendingVoicePayment = null;
  showVoiceConfirmButtons(false);

  const cancelMsg = `❌ ${roomNumber}호 ${month}월분 수납 처리가 취소되었습니다.`;
  updateVoiceStatus('warning', cancelMsg);
  speakText("수납 처리가 취소되었습니다.");

  setTimeout(() => {
    closeVoiceModal();
  }, 1800);
}

// ── UI 제어 헬퍼들 ──
export function openVoiceModal() {
  const modal = document.getElementById('voiceInputModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    updateVoiceUIState('listening');
    updateVoiceTranscript('말씀해주세요... (예: "203호 입금", "501호 선택")');
    updateVoiceStatus('idle', '');
    showVoiceConfirmButtons(false);
  }
}

export function closeVoiceModal() {
  const modal = document.getElementById('voiceInputModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
  if (recognition && isListening) {
    try { recognition.stop(); } catch (e) {}
  }
  pendingVoicePayment = null;
  showVoiceConfirmButtons(false);
  isListening = false;
  isProcessingVoice = false;
}

function updateVoiceUIState(status, message = '') {
  const micPulse = document.getElementById('voiceMicPulse');
  const micStatus = document.getElementById('voiceMicStatus');
  if (!micPulse || !micStatus) return;

  if (status === 'listening') {
    micPulse.classList.add('animate-ping', 'bg-rose-500/40');
    micPulse.classList.remove('bg-cyan-500/30', 'hidden');
    micStatus.textContent = pendingVoicePayment ? '🎙️ 답변(예/아니오)을 듣고 있습니다...' : '🎙️ 음성을 듣고 있습니다...';
    micStatus.className = 'text-xs font-bold text-rose-400 animate-pulse';
  } else if (status === 'idle') {
    micPulse.classList.remove('animate-ping', 'bg-rose-500/40');
    micPulse.classList.add('hidden');
    micStatus.textContent = pendingVoicePayment ? '답변 대기 중 (예 / 아니오 또는 버튼 터치)' : '대기 중 (마이크를 탭하여 다시 말하기)';
    micStatus.className = 'text-xs font-medium text-slate-400';
  } else if (status === 'error') {
    micPulse.classList.add('hidden');
    micStatus.textContent = message || '음성 인식 대기';
    micStatus.className = 'text-xs font-semibold text-rose-400';
  }
}

function updateVoiceTranscript(text) {
  const el = document.getElementById('voiceTranscriptText');
  if (el) el.textContent = text;
}

function updateVoiceStatus(type, message) {
  const box = document.getElementById('voiceResultBox');
  if (!box) return;

  if (!message) {
    box.classList.add('hidden');
    return;
  }

  box.classList.remove('hidden', 'bg-emerald-950/40', 'border-emerald-700/50', 'text-emerald-300', 'bg-rose-950/40', 'border-rose-700/50', 'text-rose-300', 'bg-amber-950/40', 'border-amber-700/50', 'text-amber-300', 'bg-cyan-950/40', 'border-cyan-700/50', 'text-cyan-300', 'bg-indigo-950/50', 'border-indigo-600/60');

  if (type === 'success') {
    box.classList.add('bg-emerald-950/40', 'border-emerald-700/50', 'text-emerald-300');
  } else if (type === 'error') {
    box.classList.add('bg-rose-950/40', 'border-rose-700/50', 'text-rose-300');
  } else if (type === 'warning') {
    box.classList.add('bg-amber-950/40', 'border-amber-700/50', 'text-amber-300');
  } else if (type === 'confirm') {
    box.classList.add('bg-indigo-950/50', 'border-indigo-600/60');
  } else {
    box.classList.add('bg-cyan-950/40', 'border-cyan-700/50', 'text-cyan-300');
  }

  box.innerHTML = message;
}

function showVoiceConfirmButtons(show) {
  const el = document.getElementById('voiceConfirmActions');
  if (el) {
    if (show) {
      el.classList.remove('hidden');
      el.classList.add('flex');
    } else {
      el.classList.add('hidden');
      el.classList.remove('flex');
    }
  }
}

// 글로벌 바인딩 (HTML onclick용)
if (typeof window !== 'undefined') {
  window.startVoiceRecognition = startVoiceRecognition;
  window.stopVoiceRecognition = stopVoiceRecognition;
  window.closeVoiceModal = closeVoiceModal;
  window.confirmVoicePayment = confirmVoicePayment;
  window.cancelVoicePayment = cancelVoicePayment;
  window.requestMicrophonePermissionAndStart = requestMicrophonePermissionAndStart;
}
