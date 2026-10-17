/**
 * apps/rent/frontend/js/voice.js
 * 원룸 임차료 관리 시스템 음성인식(STT) 및 말로 입력 컨트롤러.
 * Web Speech API 기반 한국어 음성 명령 파싱 및 입금 2단계 대화형 승인 처리.
 */

import { state, currentYear, currentMonth } from './state.js?v=2.0';
import { handleProcessPayment, handleCancelPayment, selectRoom, renderAll, openMenuDrawer } from './ui.js?v=2.0';
import { apiProcessPayment } from './api.js?v=2.0';
import {
  openContractEditModal,
  openExcelImportModal,
  openExpiryNoticeModal,
  openExpenseModal,
  openSmsDepositModal,
  openTenantHistoryModal,
  saveTestSnapshot,
  restoreTestSnapshot,
  handlePhoneMessageClick,
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
 * 한글 금액 단위(억, 만, 천, 백, 십 등)를 아라비아 숫자(정수)로 변환
 * 예: '일천만원', '천만원', '1000만원', '500만원', '사십오만원', '45만원', '오만원', '1억'
 */
export function parseKoreanAmount(str) {
  if (!str) return null;
  let clean = String(str).replace(/[\s,]/g, '').replace(/원$/, '').replace(/(?:으로|로)$/, '');
  const digitMap = { '일': 1, '이': 2, '삼': 3, '사': 4, '오': 5, '육': 6, '칠': 7, '팔': 8, '구': 9 };

  let total = 0;
  // 억 단위
  const ukMatch = clean.match(/([0-9가-힣]+)억/);
  if (ukMatch) {
    const part = ukMatch[1];
    let num = 0;
    if (/^\d+$/.test(part)) {
      num = parseInt(part, 10);
    } else {
      for (const ch of part) {
        if (digitMap[ch]) num += digitMap[ch];
      }
      if (num === 0) num = 1;
    }
    total += num * 100000000;
    clean = clean.slice(ukMatch.index + ukMatch[0].length);
  }

  // 만 단위
  const manMatch = clean.match(/([0-9가-힣]+)만/);
  if (manMatch) {
    const part = manMatch[1];
    let num = 0;
    if (/^\d+$/.test(part)) {
      num = parseInt(part, 10);
    } else {
      let temp = part;
      let cheon = 0, baek = 0, ship = 0, il = 0;

      const mCheon = temp.match(/([일이삼사오육칠팔구0-9]?)천/);
      if (mCheon) {
        const d = mCheon[1];
        cheon = /^\d+$/.test(d) ? parseInt(d, 10) : (digitMap[d] || 1);
        temp = temp.slice(mCheon.index + mCheon[0].length);
      }

      const mBaek = temp.match(/([일이삼사오육칠팔구0-9]?)백/);
      if (mBaek) {
        const d = mBaek[1];
        baek = /^\d+$/.test(d) ? parseInt(d, 10) : (digitMap[d] || 1);
        temp = temp.slice(mBaek.index + mBaek[0].length);
      }

      const mShip = temp.match(/([일이삼사오육칠팔구0-9]?)십/);
      if (mShip) {
        const d = mShip[1];
        ship = /^\d+$/.test(d) ? parseInt(d, 10) : (digitMap[d] || 1);
        temp = temp.slice(mShip.index + mShip[0].length);
      }

      for (const ch of temp) {
        if (digitMap[ch]) il = digitMap[ch];
        else if (/^\d$/.test(ch)) il = parseInt(ch, 10);
      }
      num = (cheon * 1000) + (baek * 100) + (ship * 10) + il;
    }
    total += num * 10000;
    clean = clean.slice(manMatch.index + manMatch[0].length);
  }

  // 남아있는 순수 아라비아 숫자
  if (/^\d+$/.test(clean)) {
    total += parseInt(clean, 10);
  }

  return total > 0 ? total : null;
}

/**
 * 자연어 구두 발화에서 계약 수정 항목(세입자명, 보증금, 월세, 관리비, 연락처) 자동 추출
 * 예: "302호 세입자명을 홍길동, 보증금을 일천만원으로 수정"
 */
export function parseContractVoiceFields(text) {
  if (!text) return {};
  const fields = {};
  const isDeleteIntent = /삭제|지워|지우|비워|초기화|없애/.test(text);

  // 1. 임대형태 (전세/월세)
  if (/전세(?:로)?\s*(?:수정|변경|전환|바꿔)?/.test(text) && !/월세/.test(text)) {
    fields.lease_type = '전세';
  } else if (/월세(?:로)?\s*(?:수정|변경|전환|바꿔)?/.test(text) && !/보증금|관리비|월세금|월세는/.test(text)) {
    fields.lease_type = '월세';
  }

  // 2. 납부방식 (선불/후불)
  if (/선불(?:로)?\s*(?:수정|변경|바꿔)?/.test(text)) {
    fields.pay_timing = '선불';
  } else if (/후불(?:로)?\s*(?:수정|변경|바꿔)?/.test(text)) {
    fields.pay_timing = '후불';
  }

  // 3. 세입자명
  const mName = text.match(/(?:세입자(?:명)?|이름|임차인|계약자)(?:을|를|은|는)?\s*([가-힣a-zA-Z]{2,8})/);
  if (mName) {
    const rawName = mName[1].replace(/(?:으로|로)$/, '');
    if (!/수정|삭제|변경|확인|등록|처리|지워|비워/.test(rawName)) {
      fields.name = rawName;
    } else if (isDeleteIntent) {
      fields.name = '';
    }
  } else if (isDeleteIntent && /세입자|이름|임차인/.test(text)) {
    fields.name = '';
  }

  // 4. 보증금
  if (isDeleteIntent && /보증금/.test(text) && !/[0-9일이삼사오육칠팔구]/.test(text)) {
    fields.deposit = 0;
  } else {
    const mDep = text.match(/(?:보증금)(?:을|를|은|는)?\s*([0-9가-힣]+)/);
    if (mDep) {
      const amt = parseKoreanAmount(mDep[1]);
      if (amt !== null) fields.deposit = amt;
    }
  }

  // 5. 월세 / 임대료
  if (isDeleteIntent && /월세|임대료/.test(text) && !/[0-9일이삼사오육칠팔구]/.test(text)) {
    fields.rent = 0;
  } else {
    const mRent = text.match(/(?:월세|임대료)(?:를|을|은|는)?\s*([0-9가-힣]+)/);
    if (mRent) {
      const amt = parseKoreanAmount(mRent[1]);
      if (amt !== null) fields.rent = amt;
    }
  }

  // 6. 관리비
  if (isDeleteIntent && /관리비/.test(text) && !/[0-9일이삼사오육칠팔구]/.test(text)) {
    fields.maintenance = 0;
  } else {
    const mMaint = text.match(/(?:관리비)(?:를|을|은|는)?\s*([0-9가-힣]+)/);
    if (mMaint) {
      const amt = parseKoreanAmount(mMaint[1]);
      if (amt !== null) fields.maintenance = amt;
    }
  }

  // 7. 청소비
  const mClean = text.match(/(?:청소비|퇴실청소비)(?:를|을|은|는)?\s*([0-9가-힣]+)/);
  if (mClean) {
    const amt = parseKoreanAmount(mClean[1]);
    if (amt !== null) fields.clean_fee = amt;
  }

  // 8. 연락처
  if (isDeleteIntent && /연락처|전화번호|폰번호|핸드폰/.test(text)) {
    fields.phone = '';
  } else {
    const mPhone = text.match(/(?:연락처|전화번호|폰번호|핸드폰)(?:를|을|은|는)?\s*([0-9]{2,4}[-\s]?[0-9]{3,4}[-\s]?[0-9]{4})/);
    if (mPhone) {
      fields.phone = mPhone[1].replace(/\s+/g, '-');
    }
  }

  // 9. 주민등록번호
  const mIdNum = text.match(/(?:주민번호|주민등록번호)(?:를|을|은|는)?\s*([0-9]{6}[-\s]?[0-9]{7})/);
  if (mIdNum) {
    fields.id_number = mIdNum[1].replace(/\s+/g, '-');
  }

  // 10. 전입일 / 만기일 날짜
  const mMoveIn = text.match(/(?:전입일|입주일)(?:을|를|은|는)?\s*(\d{4}[-./년\s]*\d{1,2}[-./월\s]*\d{1,2})/);
  if (mMoveIn) {
    fields.move_in = mMoveIn[1].replace(/[년월일\s]/g, '-').replace(/--+/g, '-').replace(/-$/, '');
  }
  const mExpiry = text.match(/(?:만기일|만료일)(?:을|를|은|는)?\s*(\d{4}[-./년\s]*\d{1,2}[-./월\s]*\d{1,2})/);
  if (mExpiry) {
    fields.expiry = mExpiry[1].replace(/[년월일\s]/g, '-').replace(/--+/g, '-').replace(/-$/, '');
  }

  return fields;
}


/**
 * 특정 호실의 전입 이후 가장 오래된 미납 회차 탐색
 * (후불 입주월 비과세/익월 청구 원칙 적용: 후불 전입월은 구두 입금 대상에서 원천 배제 및 승인 차단)
 */
export function findOldestUnpaidPeriod(roomNumber, specificMonth = null, rawText = '') {
  let targetRoom = roomNumber;
  // 호실 번호가 없으면 rawText에서 세입자 이름으로 검색 시도
  if (!targetRoom && rawText && state.rooms) {
    for (const [rNum, rData] of Object.entries(state.rooms)) {
      if (rData && rData.name && rawText.includes(rData.name)) {
        targetRoom = Number(rNum);
        break;
      }
    }
  }

  if (!targetRoom) {
    return { error: '호실명이나 세입자명을 찾을 수 없습니다. [확인 후 수동 처리]해 주세요.' };
  }

  const room = state.rooms[targetRoom];
  if (!room) {
    return { error: `${targetRoom}호 정보를 찾을 수 없습니다. [확인 후 수동 처리]해 주세요.` };
  }
  if (!room.name) {
    return { error: `${targetRoom}호는 현재 세입자가 없는 공실입니다. [확인 후 수동 처리]해 주세요.` };
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

  const isPostpaid = (room.pay_timing === "후불" || !room.pay_timing);

  // ⚠️ 특정 월(예: 1월)을 명시했을 때, 그것이 후불 입주월인 경우 즉시 승인 차단 반환
  if (specificMonth !== null && moveInYear > 0 && Number(specificMonth) === moveInMonth && isPostpaid) {
    return {
      blockedMoveInPostpaid: true,
      room: room,
      moveInMonth: moveInMonth,
      error: `${targetRoom}호 (${room.name})는 ${moveInMonth}월 전입 세입자(후불)입니다. 후불 익월 납부 원칙에 따라 입주월인 ${moveInMonth}월 입금 처리는 승인되지 않습니다. [확인 후 수동 처리]해 주세요.`
    };
  }

  // 2. 납부 내역 정규화 및 수집 (복합키/단순키 중복 제거 및 년/월 안전 파싱)
  const paymentsList = [];
  const seen = new Set();
  if (room.payments) {
    for (const [k, p] of Object.entries(room.payments)) {
      if (!p || typeof p !== 'object') continue;
      const yr = p.year || (String(k).includes('-') ? parseInt(String(k).split('-')[0], 10) : currentYear);
      const mo = p.month || (String(k).includes('-') ? parseInt(String(k).split('-')[1], 10) : parseInt(k, 10));
      if (!mo) continue;
      const key = `${yr}-${mo}`;
      if (!seen.has(key)) {
        seen.add(key);
        paymentsList.push({ ...p, year: yr, month: mo });
      }
    }
  }

  // 과거부터 최신순으로 정렬 (오름차순)
  paymentsList.sort((a, b) => (a.year - b.year) || (a.month - b.month));

  // 3. 전입일 이후 & 미납 회차 필터링
  const unpaidList = paymentsList.filter(p => {
    // 특정 월이 지정된 경우 해당 월만 필터링
    if (specificMonth !== null && Number(p.month) !== Number(specificMonth)) {
      return false;
    }

    // 특정 월이 명시되지 않은 일반 입금 명령인 경우: 현재 월(currentYear, currentMonth)까지의 미납만 탐색 (미래 월 배제!)
    if (specificMonth === null) {
      if (p.year > currentYear || (p.year === currentYear && p.month > currentMonth)) {
        return false;
      }
    }

    // 전입일 이전 회차는 전 세입자 영역이므로 제외
    if (moveInYear > 0) {
      if (p.year < moveInYear || (p.year === moveInYear && p.month < moveInMonth)) {
        return false;
      }
      // ⚠️ 후불 입주월 비과세/익월 청구 원칙: 후불인 경우 입주월 자체는 당월 청구/수납 대상이 아니므로 원천 제외
      if (p.year === moveInYear && p.month === moveInMonth && isPostpaid) {
        return false;
      }
    }
    // 미납 상태인 것만
    return !p.paid;
  });

  if (unpaidList.length === 0) {
    if (specificMonth !== null) {
      return {
        allPaid: true,
        room: room,
        targetRoom: targetRoom,
        message: `${targetRoom}호 (${room.name})의 ${specificMonth}월분은 수납 대상 미납 내역이 없거나 이미 완납되었습니다. [확인 후 수동 처리]해 주세요.`
      };
    }
    return {
      allPaid: true,
      room: room,
      targetRoom: targetRoom,
      message: `${targetRoom}호 (${room.name})는 전입월부터 현재 월(${currentMonth}월)까지 이미 전액 완납되어 미납 내역이 없습니다. 선납이나 기타 입금은 [확인 후 수동 처리]해 주세요.`
    };
  }

  const oldest = unpaidList[0];
  const isMoveInMonth = (moveInYear > 0 && oldest.year === moveInYear && oldest.month === moveInMonth);
  const totalRent = (room.lease_type === "전세" ? 0 : (room.rent || 0)) + (room.maintenance || 0);

  // 2중 보호막: 만에 하나 남아있는 후불 입주월인 경우 승인 차단
  if (isMoveInMonth && isPostpaid) {
    return {
      blockedMoveInPostpaid: true,
      room: room,
      moveInMonth: moveInMonth,
      error: `${targetRoom}호 (${room.name})는 ${moveInMonth}월 전입 세입자(후불)이므로 입주월인 ${moveInMonth}월 입금 처리는 승인되지 않습니다. [확인 후 수동 처리]해 주세요.`
    };
  }

  return {
    success: true,
    target: oldest,
    room: room,
    isMoveInMonth: false,
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
 * 한국어 구두 명령 번호 파싱 ("1번", "2번", ..., "17번" 또는 "일번", "십칠번" 등)
 */
export function parseMenuNumber(rawText) {
  if (!rawText) return null;
  const clean = rawText.replace(/\s+/g, '').toLowerCase();

  // "1번", "1", "17번" 등 순수 숫자 매칭
  const numMatch = clean.match(/^(\d{1,2})번?$/);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    if (n >= 1 && n <= 17) return n;
  }

  // 문장 중에 "1번", "17번" 등이 포함된 경우
  const insideMatch = clean.match(/(\d{1,2})번/);
  if (insideMatch) {
    const n = parseInt(insideMatch[1], 10);
    if (n >= 1 && n <= 17) return n;
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
    '십이번': 12, '열두번째': 12,
    '십삼번': 13, '열세번째': 13,
    '십사번': 14, '열네번째': 14,
    '십오번': 15, '열다섯번째': 15,
    '십육번': 16, '열여섯번째': 16,
    '십칠번': 17, '열일곱번째': 17
  };

  for (const [k, v] of Object.entries(map)) {
    if (clean.includes(k)) return v;
  }
  return null;
}

/**
 * Rent 구두 명령 1~17번 실행기 (목적별 완전 분리, 사용 빈도순 배치, 관리자 전용 메뉴 후방 배치)
 * (말, 터치, 번호 선택 공통 단일 진입점)
 */
export async function executeVoiceCommandById(cmdId, targetRoom = null, extraFields = {}) {
  const rNum = targetRoom || parseKoreanNumber(String(targetRoom)) || state.selectedRoom || 203;

  switch (Number(cmdId)) {
    // ── [그룹 1: 실시간 일상 업무 - 최다 빈도] ──
    case 1: // 1. 203호 수납(입금 등) -> 최장기 미납 탐색 및 2단계 음성 승인
      await executeVoicePayment(rNum);
      break;

    case 2: // 2. 입금문자 간편인식 -> 은행 SMS 복사 붙여넣기로 즉시 수납
      closeVoiceModal();
      if (typeof openSmsDepositModal === 'function') {
        openSmsDepositModal();
      } else if (window.openSmsDepositModal) {
        window.openSmsDepositModal();
      }
      speakText("은행 입금문자 간편 수납 창을 열었습니다.");
      break;

    case 3: // 3. 수납 취소 (미납 환원) -> 지정 호실의 완납을 미납으로 원클릭 롤백
      await executeVoiceCancelPayment(rNum);
      break;

    case 4: // 4. 지출등록 -> 수리비, 비품비, 공과금 영수증 기록
      closeVoiceModal();
      if (typeof openExpenseModal === 'function') {
        openExpenseModal();
      } else if (window.openExpenseModal) {
        window.openExpenseModal();
      }
      speakText("오늘의 지출 내역 등록 창을 열었습니다.");
      break;

    case 5: // 5. 영수증 발급 및 전송 -> 납부 영수증 / 미납 청구서 문자 발송
      closeVoiceModal();
      selectRoom(rNum);
      if (typeof handlePhoneMessageClick === 'function') {
        handlePhoneMessageClick(rNum);
      } else if (window.handlePhoneMessageClick) {
        window.handlePhoneMessageClick(rNum);
      }
      speakText(`${rNum}호 영수증 및 안내 문자 발송 창을 열었습니다.`);
      break;

    // ── [그룹 2: 계약 및 호실 관리 - 수시 업무] ──
    case 6: // 6. 203호 전입 (신규 세입자 단건 등록) -> 공실에 새 세입자 계약 입력
      closeVoiceModal();
      selectRoom(rNum);
      if (typeof openContractEditModal === 'function') {
        openContractEditModal(rNum);
      } else if (window.openContractEditModal) {
        window.openContractEditModal(rNum);
      }
      setTimeout(() => {
        const nameEl = document.getElementById('formName');
        if (nameEl) {
          nameEl.focus();
        }
      }, 200);
      speakText(`${rNum}호 신규 세입자 전입 등록 창을 열었습니다.`);
      break;

    case 7: // 7. 203호 전출(퇴실, 공실처리) -> 퇴실일자 자동 설정 및 정산 포커스
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

    case 8: // 8. 203호 수정, 삭제 -> 세입자명/보증금/월세/관리비 구두 추출 필드 자동 입력 지원
      closeVoiceModal();
      selectRoom(rNum);
      if (typeof openContractEditModal === 'function') {
        openContractEditModal(rNum);
      } else if (window.openContractEditModal) {
        window.openContractEditModal(rNum);
      }

      const modifiedLabels = [];
      setTimeout(() => {
        if (extraFields && typeof extraFields === 'object') {
          if (extraFields.name) {
            const el = document.getElementById('formName');
            if (el) {
              el.value = extraFields.name;
              el.classList.add('ring-2', 'ring-cyan-400');
              modifiedLabels.push(`세입자명 '${extraFields.name}'`);
            }
          }
          if (extraFields.deposit !== undefined && extraFields.deposit !== null) {
            const el = document.getElementById('formDeposit');
            if (el) {
              el.value = extraFields.deposit;
              el.classList.add('ring-2', 'ring-cyan-400');
              modifiedLabels.push(`보증금 '${Number(extraFields.deposit).toLocaleString()}원'`);
            }
          }
          if (extraFields.rent !== undefined && extraFields.rent !== null) {
            const el = document.getElementById('formRent');
            if (el) {
              el.value = extraFields.rent;
              el.classList.add('ring-2', 'ring-cyan-400');
              modifiedLabels.push(`월세 '${Number(extraFields.rent).toLocaleString()}원'`);
            }
          }
          if (extraFields.maintenance !== undefined && extraFields.maintenance !== null) {
            const el = document.getElementById('formMaintenance');
            if (el) {
              el.value = extraFields.maintenance;
              el.classList.add('ring-2', 'ring-cyan-400');
              modifiedLabels.push(`관리비 '${Number(extraFields.maintenance).toLocaleString()}원'`);
            }
          }
          if (extraFields.lease_type) {
            const el = document.getElementById('formLeaseType');
            if (el) {
              el.value = extraFields.lease_type;
              el.classList.add('ring-2', 'ring-cyan-400');
              modifiedLabels.push(`임대형태 '${extraFields.lease_type}'`);
            }
          }
          if (extraFields.pay_timing) {
            const el = document.getElementById('formPayTiming');
            if (el) {
              el.value = extraFields.pay_timing;
              el.classList.add('ring-2', 'ring-cyan-400');
              modifiedLabels.push(`납부방식 '${extraFields.pay_timing}'`);
            }
          }
          if (extraFields.clean_fee !== undefined && extraFields.clean_fee !== null) {
            const el = document.getElementById('formCleanFee');
            if (el) {
              el.value = extraFields.clean_fee;
              el.classList.add('ring-2', 'ring-cyan-400');
              modifiedLabels.push(`청소비 '${Number(extraFields.clean_fee).toLocaleString()}원'`);
            }
          }
          if (extraFields.id_number) {
            const el = document.getElementById('formIdNumber');
            if (el) {
              el.value = extraFields.id_number;
              el.classList.add('ring-2', 'ring-cyan-400');
              modifiedLabels.push(`주민번호 '${extraFields.id_number}'`);
            }
          }
          if (extraFields.move_in) {
            const el = document.getElementById('formMoveIn');
            if (el) {
              el.value = extraFields.move_in;
              el.classList.add('ring-2', 'ring-cyan-400');
              modifiedLabels.push(`전입일 '${extraFields.move_in}'`);
            }
          }
          if (extraFields.expiry) {
            const el = document.getElementById('formExpiry');
            if (el) {
              el.value = extraFields.expiry;
              el.classList.add('ring-2', 'ring-cyan-400');
              modifiedLabels.push(`만기일 '${extraFields.expiry}'`);
            }
          }
        }

        if (modifiedLabels.length > 0) {
          const speakMsg = `${rNum}호 ${modifiedLabels.join(', ')}을 입력했습니다. 확인 후 [저장 완료]를 눌러주세요.`;
          speakText(speakMsg);
        } else {
          speakText(`${rNum}호 계약 정보 수정 및 삭제 창을 열었습니다.`);
        }
      }, 150);
      break;

    case 9: // 9. 만기 확인 및 갱신 안내 -> 만기 도래 호실 목록 & 재계약 문자 통보
      closeVoiceModal();
      if (typeof openExpiryNoticeModal === 'function') {
        openExpiryNoticeModal();
      } else if (window.openExpiryNoticeModal) {
        window.openExpiryNoticeModal();
      }
      speakText("만기 도래 호실 확인 및 갱신 안내 창을 열었습니다.");
      break;

    // ── [그룹 3: 장부, 출력 및 통계 - 세입자 교부용 vs 건물주 결산용 완전 분리] ──
    case 10: // 10. 203호 납입현황 (세입자 교부·출력용 1년 납부 영수대장 엑셀 & A4 인쇄)
      closeVoiceModal();
      selectRoom(rNum);
      if (typeof exportCurrentRoomCSV === 'function') {
        exportCurrentRoomCSV();
      } else if (window.exportCurrentRoomCSV) {
        window.exportCurrentRoomCSV();
      }
      speakText(`${rNum}호 세입자 교부용 납입현황 엑셀을 다운로드하고 인쇄 화면을 준비합니다.`);
      setTimeout(() => {
        if (confirm(`${rNum}호 납입현황 엑셀(CSV)이 다운로드되었습니다.\n\n세입자 교부용 A4 인쇄 / PDF 저장을 실행하시겠습니까?`)) {
          window.print();
        }
      }, 600);
      break;

    case 11: // 11. 건물 전체 월별 통계 (건물주 결산용 연간 누적 합계 및 호실별/월별 종합 통계)
      closeVoiceModal();
      if (typeof exportAllRoomsCSV === 'function') {
        exportAllRoomsCSV();
      } else if (window.exportAllRoomsCSV) {
        window.exportAllRoomsCSV();
      }
      speakText("건물 전체 연간 누적 합계 및 월별 통계 엑셀을 다운로드합니다.");
      break;

    case 12: // 12. 전출자 1년 보존 이력 -> 퇴실자 과거 계약 대장 & 납부 이력 1년 영구 보존 조회
      closeVoiceModal();
      if (typeof openTenantHistoryModal === 'function') {
        openTenantHistoryModal();
      } else if (window.openTenantHistoryModal) {
        window.openTenantHistoryModal();
      }
      speakText("퇴실자 1년 보존 이력 및 과거 장부 창을 열었습니다.");
      break;

    // ── [그룹 4: 시스템 및 관리자 전용 메뉴 - 뒤편 배치] ──
    case 13: // 13. 건물 전체 일괄등록 (건물 전체 데이터를 사진 및 엑셀 붙여넣기로 일괄 구축)
      closeVoiceModal();
      if (typeof openExcelImportModal === 'function') {
        openExcelImportModal();
      } else if (window.openExcelImportModal) {
        window.openExcelImportModal();
      }
      speakText("건물 전체 데이터 엑셀 및 사진 일괄 등록 창을 열었습니다.");
      break;

    case 14: // 14. 1초 롤백 & 스냅샷 백업 (실수 직전 1초 롤백, 스냅샷 저장 및 JSON 풀 백업/복구)
      const promptHtml = `
        <div class="p-2 text-center space-y-2">
          <div class="text-xs font-bold text-emerald-300">↩️ 1초 롤백 & 백업 관리 센터</div>
          <p class="text-[11px] text-slate-300">원하시는 백업 또는 롤백 작업을 선택하세요.</p>
          <div class="grid grid-cols-2 gap-1.5 pt-1">
            <button type="button" onclick="saveTestSnapshot(); closeVoiceModal();" class="py-2 px-1 rounded-xl bg-teal-800 hover:bg-teal-700 text-white font-bold text-xs shadow cursor-pointer active:scale-95 transition">
              📸 스냅샷 즉시 저장
            </button>
            <button type="button" onclick="restoreTestSnapshot(); closeVoiceModal();" class="py-2 px-1 rounded-xl bg-amber-800 hover:bg-amber-700 text-white font-bold text-xs shadow cursor-pointer active:scale-95 transition">
              ↩️ 1초 전 즉시 롤백
            </button>
            <button type="button" onclick="exportFullSystemBackupJSON(); closeVoiceModal();" class="py-2 px-1 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs shadow cursor-pointer active:scale-95 transition">
              💾 JSON 전체 백업
            </button>
            <button type="button" onclick="triggerFullSystemRestoreFile(); closeVoiceModal();" class="py-2 px-1 rounded-xl bg-indigo-800 hover:bg-indigo-700 text-white font-bold text-xs shadow cursor-pointer active:scale-95 transition">
              📂 파일에서 복원
            </button>
          </div>
        </div>
      `;
      updateVoiceStatus('confirm', promptHtml);
      speakText("1초 롤백 또는 시스템 백업 복구 작업을 선택해주세요.");
      break;

    case 15: // 15. 건물 / 지점 변경 -> 원룸 매장 선택 드로어
      closeVoiceModal();
      if (typeof openMenuDrawer === 'function') {
        openMenuDrawer();
      } else if (window.openMenuDrawer) {
        window.openMenuDrawer();
      }
      speakText("건물 및 지점 선택 메뉴를 열었습니다.");
      break;

    case 16: // 16. 부가가치세(VAT) 신고 자료 산출 -> 국세청 홈택스 세무 서식
      closeVoiceModal();
      if (typeof openVatModal === 'function') {
        openVatModal();
      } else if (window.openVatModal) {
        window.openVatModal();
      }
      speakText("부가가치세 신고 및 세무 자료 산출 창을 열었습니다.");
      break;

    case 17: // 17. 도움말 (공식 운영 매뉴얼 & 인쇄/PDF)
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
 * 인식된 음성 문장 처리 핸들러 (대화형 2단계 승인 및 1~17번 구두 명령 지원)
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
          const newMonthMatch = rawText.match(/(\d{1,2})\s*월/);
          const newMonth = newMonthMatch ? parseInt(newMonthMatch[1], 10) : null;
          await executeVoicePayment(newRoomNum, newMonth);
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

    // ── 2. 번호 기반 구두 명령 파싱 ("1번", "2번", ..., "17번") ──
    const menuNum = parseMenuNumber(rawText);
    const roomNumber = parseKoreanNumber(rawText);
    const monthMatch = rawText.match(/(\d{1,2})\s*월/);
    const specificMonth = monthMatch ? parseInt(monthMatch[1], 10) : null;

    if (menuNum) {
      if (menuNum === 1) {
        await executeVoicePayment(roomNumber, specificMonth, rawText);
      } else {
        await executeVoiceCommandById(menuNum, roomNumber);
      }
      isProcessingVoice = false;
      return;
    }

    // ── 3. 키워드 기반 자연어 구두 명령 파싱 (빈도 순서 기반 디스패치) ──
    // 2. 입금문자 간편인식 ("문자 수납", "입금문자", "SMS 수납")
    if (/문자|sms|문자로/.test(rawText) && /수납|입금|인식/.test(rawText)) {
      await executeVoiceCommandById(2);
      isProcessingVoice = false;
      return;
    }

    // 3. 수납 취소 / 미납 환원 ("302호 10월 수납 취소", "302호 10월 미납으로 처리", "10월 납부 취소")
    if (/취소|미납/.test(rawText) && /수납|입금|완납|납부|월/.test(rawText)) {
      await executeVoiceCancelPayment(roomNumber, specificMonth);
      isProcessingVoice = false;
      return;
    }

    // 1. 호실 수납 / 입금 처리 ("203호 입금", "203호 5월 완납", "배종봉 입금")
    if (/수납|입금|완납|납부|넣었/.test(rawText)) {
      await executeVoicePayment(roomNumber, specificMonth, rawText);
      isProcessingVoice = false;
      return;
    }

    // 4. 지출 등록 ("지출 등록", "수리비 기록", "비용")
    if (/지출|비용|수리비|비품비/.test(rawText)) {
      await executeVoiceCommandById(4);
      isProcessingVoice = false;
      return;
    }

    // 5. 영수증 발급 및 전송 ("영수증 발급", "영수증 보내줘", "문자 전송")
    if (/영수증|청구서|안내문자/.test(rawText)) {
      await executeVoiceCommandById(5, roomNumber);
      isProcessingVoice = false;
      return;
    }

    // 7. 전출 / 퇴실 / 공실처리 / 이사
    if (/전출|퇴실|공실처리|공실|이사/.test(rawText)) {
      await executeVoiceCommandById(7, roomNumber);
      isProcessingVoice = false;
      return;
    }

    // 13. 건물 전체 일괄 등록 (엑셀/사진 일괄)
    if (/일괄|일괄등록|사진등록|엑셀붙여넣기|전체등록/.test(rawText)) {
      await executeVoiceCommandById(13);
      isProcessingVoice = false;
      return;
    }

    // 6. 호실 전입 / 신규 계약 / 새 세입자 등록
    if (/전입|신규계약|새세입자|입주/.test(rawText)) {
      await executeVoiceCommandById(6, roomNumber);
      isProcessingVoice = false;
      return;
    }

    // 8. 계약 수정 / 삭제 / 변경 또는 계약 필드(세입자명/보증금/월세/관리비/연락처) 발화
    const contractFields = parseContractVoiceFields(rawText);
    const hasContractFields = Object.keys(contractFields).length > 0;
    if (hasContractFields || /수정|삭제|변경|고치|바꿔/.test(rawText)) {
      await executeVoiceCommandById(8, roomNumber, contractFields);
      isProcessingVoice = false;
      return;
    }

    // 9. 만기 확인 및 갱신 안내
    if (/만기|만기확인|만기안내|갱신/.test(rawText)) {
      await executeVoiceCommandById(9);
      isProcessingVoice = false;
      return;
    }

    // 10. 호실별 납입현황 (세입자 교부용)
    if (roomNumber && /납입현황|납부현황|현황|1년/.test(rawText)) {
      await executeVoiceCommandById(10, roomNumber);
      isProcessingVoice = false;
      return;
    }

    // 11. 건물 전체 월별 통계 (연간 누적/종합 통계)
    if (/통계|월별통계|종합통계|전체현황|누적/.test(rawText)) {
      await executeVoiceCommandById(11);
      isProcessingVoice = false;
      return;
    }

    // 12. 전출자 1년 보존 이력
    if (/전출자|퇴실자|이력|과거|보존/.test(rawText)) {
      await executeVoiceCommandById(12);
      isProcessingVoice = false;
      return;
    }

    // 14. 1초 롤백 & 스냅샷 / 데이터 백업 및 복구
    if (/롤백|스냅샷|되돌리기|백업|복구|복원/.test(rawText)) {
      await executeVoiceCommandById(14);
      isProcessingVoice = false;
      return;
    }

    // 15. 건물 / 지점 변경
    if (/건물|지점|매장|지점변경|건물변경/.test(rawText)) {
      await executeVoiceCommandById(15);
      isProcessingVoice = false;
      return;
    }

    // 16. 부가가치세 / 부가세
    if (/부가가치세|부가세|세무|홈택스/.test(rawText)) {
      await executeVoiceCommandById(16);
      isProcessingVoice = false;
      return;
    }

    // 17. 도움말 / 매뉴얼
    if (/도움말|사용법|매뉴얼|설명서/.test(rawText)) {
      await executeVoiceCommandById(17);
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
    const msg = `인식된 명령이 없습니다. 예문의 번호(1~17번)나 "101호 입금" 처럼 말씀해 주시거나, [확인 후 수동 처리]해 주세요.`;
    updateVoiceStatus('warning', msg);
    speakText("인식된 명령이 없습니다. 다시 말씀해 주시거나 확인 후 수동 처리해 주세요.", () => {
      resumeListening();
    });
  } catch (err) {
    updateVoiceStatus('error', "명령 처리 중 오류: " + err.message);
  } finally {
    isProcessingVoice = false;
  }
}

/**
 * "302호 10월 수납 취소" / "302호 10월 미납으로 처리" 발화 시:
 * 해당 호실의 특정 월(또는 당월) 수납을 즉시 취소하여 미납으로 환원
 */
export async function executeVoiceCancelPayment(roomNumber, specificMonth = null) {
  const rNum = roomNumber || state.selectedRoom || 203;
  const m = specificMonth || currentMonth;
  closeVoiceModal();
  selectRoom(rNum);

  if (typeof handleCancelPayment === 'function') {
    await handleCancelPayment(rNum, m);
  } else if (window.handleCancelPayment) {
    await window.handleCancelPayment(rNum, m);
  }

  const msg = `${rNum}호 ${m}월분 수납이 취소되어 '미납'으로 변경되었습니다.`;
  speakText(msg);
}

/**
 * "203호 입금" 발화 시:
 * 전입 이후 가장 오래된 미납 회차 1건을 탐색하고 사용자에게 승인 확인(y/n)을 질의
 */
async function executeVoicePayment(roomNumber, specificMonth = null, rawText = '') {
  const result = findOldestUnpaidPeriod(roomNumber, specificMonth, rawText);
  const targetRoomNum = result.targetRoom || roomNumber;

  // ⚠️ 후불 전입월 구두 입금 승인 원천 차단
  if (result.blockedMoveInPostpaid) {
    updateVoiceStatus('warning', `⚠️ ${result.error}`);
    speakText(`${targetRoomNum}호는 전입월 후불 비과세 대상입니다. 확인 후 수동 처리해 주세요.`);
    if (targetRoomNum) selectRoom(targetRoomNum);
    return;
  }

  if (result.error) {
    updateVoiceStatus('error', result.error);
    speakText(result.error);
    return;
  }

  if (result.allPaid) {
    updateVoiceStatus('info', result.message);
    speakText(`${targetRoomNum}호는 전입월부터 현재 월까지 이미 전액 완납되었습니다. 확인 후 수동 처리해 주세요.`);
    if (targetRoomNum) selectRoom(targetRoomNum);
    return;
  }

  const { target, room, isMoveInMonth, isPostpaid, unpaidCount, totalRent } = result;

  // ⚠️ 안전 보호막: 입주월 후불 회차 승인 차단
  if (isMoveInMonth && isPostpaid) {
    const blockMsg = `⚠️ ${roomNumber}호 (${room.name})는 ${target.month}월 전입 세입자(후불)이므로 입주월 입금 처리가 승인되지 않습니다. (후불 익월 납부 대상)`;
    updateVoiceStatus('warning', blockMsg);
    speakText(`${roomNumber}호는 입주월 후불 대상이므로 입금 처리가 승인되지 않습니다.`);
    selectRoom(roomNumber);
    return;
  }

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
  const { roomNumber, year, month, tenantName, totalRent, unpaidCount, room, isMoveInMonth, isPostpaid } = pendingVoicePayment;

  // ⚠️ 후불 입주월 최종 확정 단계 차단 보호막
  if (isMoveInMonth && isPostpaid) {
    pendingVoicePayment = null;
    showVoiceConfirmButtons(false);
    const blockMsg = `🚫 ${roomNumber}호는 ${month}월 전입 세입자(후불)이므로 입주월 입금 처리가 승인되지 않습니다.`;
    updateVoiceStatus('warning', blockMsg);
    speakText("입주월 후불 비과세 대상이므로 입금 처리가 승인되지 않습니다.");
    return;
  }

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

    // 수납 후 영수 문자 발송 연동 (사용자 확인 후 발송)
    const curBranchObj = state.branches.find(b => b.branch_id === state.currentBranch);
    const branchName = state.currentBranch === 'main' ? '시크빌' : (curBranchObj ? curBranchObj.name : '시크빌');
    const receiptText = `[${branchName} 임차료 수납 영수증]\n${roomNumber}호 ${tenantName} 님\n- 귀속: ${year}년 ${month}월분\n- 수납액: ${rentFormatted}원\n- 수납일자: ${defaultPayDate}\n정상 수납(완납) 처리되었습니다. 감사합니다.`;
    state.pendingReceiptText = receiptText;
    state.pendingReceiptRoom = roomNumber;

    setTimeout(() => {
      closeVoiceModal();
      if (room && room.phone) {
        const sendReceipt = confirm(`✅ [${roomNumber}호 ${tenantName}님] ${year}년 ${month}월분 수납이 정상 완료되었습니다.\n\n세입자에게 영수증 문자를 발송하시겠습니까?`);
        if (sendReceipt && typeof window.handleSendSmsReceipt === 'function') {
          window.handleSendSmsReceipt(room.phone);
        }
      }
    }, 1500);

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
  window.executeVoiceCommandById = executeVoiceCommandById;
  window.parseMenuNumber = parseMenuNumber;
}
