/**
 * shared/ui/smart_input_bar.js
 * 제미나이(Gemini) 스타일 [+] 첨부 메뉴형 만능 스마트 입력바 (Drop-in Web Module).
 * 
 * 사용법 (단 1줄로 어떤 앱에서든 즉시 부착):
 *   import { mountSmartInputBar } from '/shared/ui/smart_input_bar.js';
 *   mountSmartInputBar('#myContainer', {
 *     apiBase: '/api/rent2', // 또는 /api/studycafe2, /api/selfstudy2
 *     onSuccess: (res) => reloadData()
 *   });
 */

export function mountSmartInputBar(target, options = {}) {
  const container = typeof target === 'string' ? document.querySelector(target) : target;
  if (!container) {
    console.error(`[SmartInputBar] 마운트 대상을 찾을 수 없습니다: ${target}`);
    return null;
  }

  const apiBase = options.apiBase || '/api';
  const placeholder = options.placeholder || '메시지를 입력하거나, [+] 버튼으로 사진/장부/문자를 첨부하세요...';
  const onSuccess = options.onSuccess || (() => {});
  const getBranchId = typeof options.branchId === 'function' ? options.branchId : (() => options.branchId || 'main');

  // CSS 자동 로드 (No-Configuration)
  if (!document.getElementById('smartInputBarCss')) {
    const link = document.createElement('link');
    link.id = 'smartInputBarCss';
    link.rel = 'stylesheet';
    link.href = '/shared/ui/smart_input_bar.css?v=2.0';
    document.head.appendChild(link);
  }

  // 고유 ID 네임스페이스
  const uid = 'sib_' + Math.random().toString(36).substring(2, 9);

  // 내부 상태
  let attachedImageBase64 = null;
  let attachedFileName = null;

  // DOM 템플릿 주입
  container.innerHTML = `
    <div class="smart-input-container" id="${uid}_container">
      <div class="smart-input-box">
        <!-- 첨부 썸네일 칩 -->
        <div class="smart-attachment-chips" id="${uid}_chips" style="display:none;"></div>

        <div class="smart-input-row">
          <!-- [+] 플러스 토글 버튼 -->
          <button type="button" class="smart-plus-btn" id="${uid}_plusBtn" title="파일, 사진, 링크 첨부">+</button>

          <!-- 제미나이 스타일 팝오버 메뉴 -->
          <div class="smart-popover-menu" id="${uid}_menu" style="display:none;">
            <button type="button" class="smart-menu-item" id="${uid}_menuCamera">
              <span class="menu-icon">📸</span>
              <div>
                <span>카메라 직접 촬영</span>
                <span class="menu-desc">영수증 / 계약서 / 실물 문서</span>
              </div>
            </button>
            <button type="button" class="smart-menu-item" id="${uid}_menuFile">
              <span class="menu-icon">📁</span>
              <div>
                <span>파일 첨부</span>
                <span class="menu-desc">엑셀(.xlsx), CSV, 사진, PDF</span>
              </div>
            </button>
            <button type="button" class="smart-menu-item" id="${uid}_menuSheet">
              <span class="menu-icon">📊</span>
              <div>
                <span>구글 시트 링크</span>
                <span class="menu-desc">2025/2026 클라우드 장부 URL</span>
              </div>
            </button>
            <button type="button" class="smart-menu-item" id="${uid}_menuPaste">
              <span class="menu-icon">💬</span>
              <div>
                <span>은행 문자 / 카톡</span>
                <span class="menu-desc">통장 입금 알림 스마트 수납</span>
              </div>
            </button>
          </div>

          <!-- 텍스트 인풋 -->
          <textarea class="smart-text-input" id="${uid}_text" rows="1" placeholder="${placeholder}"></textarea>

          <!-- 전송 / 실행 버튼 -->
          <button type="button" class="smart-send-btn" id="${uid}_sendBtn" title="전송 및 실행">⚡</button>
        </div>
      </div>

      <!-- 숨겨진 파일/카메라 인풋 -->
      <input type="file" id="${uid}_cameraInput" accept="image/*" capture="environment" style="display:none;">
      <input type="file" id="${uid}_fileInput" accept=".xlsx,.xls,.csv,.tsv,image/*,application/pdf" style="display:none;">
    </div>
  `;

  // 엘리먼트 참조
  const plusBtn = document.getElementById(`${uid}_plusBtn`);
  const menu = document.getElementById(`${uid}_menu`);
  const textInput = document.getElementById(`${uid}_text`);
  const sendBtn = document.getElementById(`${uid}_sendBtn`);
  const chipsContainer = document.getElementById(`${uid}_chips`);
  const cameraInput = document.getElementById(`${uid}_cameraInput`);
  const fileInput = document.getElementById(`${uid}_fileInput`);

  // 칩 렌더링
  function renderChip() {
    if (attachedImageBase64) {
      chipsContainer.style.display = 'flex';
      chipsContainer.innerHTML = `
        <div class="smart-chip">
          <img src="${attachedImageBase64}" alt="첨부 사진">
          <span>${attachedFileName || '첨부된 이미지'}</span>
          <button type="button" class="chip-remove" id="${uid}_chipRemove" title="첨부 삭제">&times;</button>
        </div>
      `;
      document.getElementById(`${uid}_chipRemove`)?.addEventListener('click', () => {
        attachedImageBase64 = null;
        attachedFileName = null;
        renderChip();
      });
    } else {
      chipsContainer.style.display = 'none';
      chipsContainer.innerHTML = '';
    }
  }

  // 팝오버 토글
  function toggleMenu(show) {
    const isVisible = show !== undefined ? show : menu.style.display === 'flex';
    menu.style.display = isVisible ? 'none' : 'flex';
    plusBtn.classList.toggle('active', !isVisible);
  }

  plusBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenu();
  });

  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target) && e.target !== plusBtn) {
      toggleMenu(false);
    }
  });

  // 1. 카메라 촬영
  document.getElementById(`${uid}_menuCamera`).addEventListener('click', () => {
    toggleMenu(false);
    cameraInput.click();
  });

  cameraInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    attachedFileName = `📸 카메라 사진 (${(file.size / 1024).toFixed(1)}KB)`;
    const reader = new FileReader();
    reader.onload = (evt) => {
      attachedImageBase64 = evt.target.result;
      renderChip();
      textInput.focus();
    };
    reader.readAsDataURL(file);
  });

  // 2. 파일 첨부
  document.getElementById(`${uid}_menuFile`).addEventListener('click', () => {
    toggleMenu(false);
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const isImg = file.type.startsWith('image/');
    if (isImg) {
      attachedFileName = `🖼️ ${file.name}`;
      const reader = new FileReader();
      reader.onload = (evt) => {
        attachedImageBase64 = evt.target.result;
        renderChip();
      };
      reader.readAsDataURL(file);
    } else {
      // 엑셀/CSV 등 일반 파일은 경로 또는 텍스트 입력창에 안내
      textInput.value = `[파일 첨부: ${file.name}] `;
      textInput.focus();
    }
  });

  // 3. 구글 시트 링크 안내
  document.getElementById(`${uid}_menuSheet`).addEventListener('click', () => {
    toggleMenu(false);
    const url = prompt('구글 스프레드시트 URL을 입력하세요:\n(예: https://docs.google.com/spreadsheets/d/...)');
    if (url && url.trim()) {
      textInput.value = url.trim();
      executeSubmit();
    }
  });

  // 4. 문자 붙여넣기 모달 또는 프롬프트
  document.getElementById(`${uid}_menuPaste`).addEventListener('click', () => {
    toggleMenu(false);
    textInput.placeholder = '은행 입금 문자/카톡을 여기에 붙여넣으세요...';
    textInput.focus();
  });

  // 클립보드 사진 (Ctrl+V) 자동 가로채기
  textInput.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData)?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
        attachedFileName = '📷 클립보드 캡처 사진';
        const reader = new FileReader();
        reader.onload = (evt) => {
          attachedImageBase64 = evt.target.result;
          renderChip();
        };
        reader.readAsDataURL(file);
        break;
      }
    }
  });

  // 텍스트 자동 리사이즈 및 Enter 키 전송
  textInput.addEventListener('input', () => {
    textInput.style.height = 'auto';
    textInput.style.height = Math.min(textInput.scrollHeight, 120) + 'px';
  });

  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      executeSubmit();
    }
  });

  sendBtn.addEventListener('click', executeSubmit);

  // 실행 및 전송
  async function executeSubmit() {
    const text = textInput.value.trim();
    const img = attachedImageBase64;
    const branchId = getBranchId();

    if (!text && !img) {
      alert('전송할 내용이나 사진을 입력해 주세요.');
      return;
    }

    sendBtn.disabled = true;
    sendBtn.innerHTML = '⏳';

    try {
      // 1. 이미지가 첨부되어 있거나 은행 문자/구글시트 패턴인 경우 -> 만능 인제스트 실행
      const isSheet = text.includes('docs.google.com/spreadsheets');
      const isBankText = /입금|결제|승인|이체|원\s*입금/.test(text) || /\d{3,4}\s*호/.test(text);

      let res, data;
      if (img || isSheet || isBankText) {
        res = await fetch(`${apiBase}/smart/universal-ingest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            image_base64: img,
            branch_id: branchId
          })
        });
        data = await res.json();
      } else {
        // 2. 일반 자연어 질의인 경우 -> AI 질의(/agent/ask 또는 앱별 핸들러)
        res = await fetch(`${apiBase}/agent/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: text,
            branch_id: branchId
          })
        });
        data = await res.json();
      }

      if (!res.ok) throw new Error(data.detail || data.message || '요청 실패');

      // 성공 알림 및 리셋
      alert(data.message || data.answer || '성공적으로 처리되었습니다.');
      textInput.value = '';
      textInput.style.height = 'auto';
      attachedImageBase64 = null;
      attachedFileName = null;
      renderChip();

      onSuccess(data);
    } catch (err) {
      console.error('[SmartInputBar Error]', err);
      alert(`처리 오류: ${err.message}`);
    } finally {
      sendBtn.disabled = false;
      sendBtn.innerHTML = '⚡';
    }
  }

  return {
    clear: () => {
      textInput.value = '';
      attachedImageBase64 = null;
      attachedFileName = null;
      renderChip();
    },
    focus: () => textInput.focus()
  };
}
