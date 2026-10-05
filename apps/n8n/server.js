const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3000;
const EXCEL_FILE_PATH = path.join(__dirname, 'nonghyup_deposits.xlsx');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Store SSE clients for live push notifications
let sseClients = [];

// Store deposit history in memory
let depositHistory = [];

// Helper: Save depositHistory to Excel file (sorted by depositor, then by deposit time)
function saveToExcel(records = depositHistory) {
  try {
    // Sort records by depositor (입금자 가나다순) -> then by deposit time (입금일시 시간순)
    const sortedRecords = [...records].sort((a, b) => {
      const nameA = a.depositor || '';
      const nameB = b.depositor || '';
      const nameCompare = nameA.localeCompare(nameB, 'ko');
      
      if (nameCompare !== 0) {
        return nameCompare;
      }
      
      // Secondary sort: Deposit time ascending (입금 시간순)
      const dateA = a.depositDate || a.receivedAt || '';
      const dateB = b.depositDate || b.receivedAt || '';
      return dateA.localeCompare(dateB);
    });

    const cleanStr = (val) => String(val || '').replace(/^=/, '').trim();

    const excelData = sortedRecords.map(item => {
      let rawDep = cleanStr(item.depositor);
      let note = cleanStr(item.note || item.paymentStatus || '');
      
      // Separate status from depositor if combined like "101호 홍길동 [⚠️ 미납...]"
      const bracketMatch = rawDep.match(/^(.*?)\s*\[(.*?)\]$/);
      if (bracketMatch) {
        rawDep = bracketMatch[1].trim();
        note = bracketMatch[2].trim();
      }

      return {
        'ID': item.id,
        '계좌번호': cleanStr(item.account),
        '입금일시': cleanStr(item.depositDate),
        '입금자': rawDep,
        '입금금액(원)': Number(item.amount) || 0,
        '비고(납부상태)': note,
        '거래후잔액(원)': Number(item.balance) || 0,
        '수신이메일': item.recipientEmail,
        '시스템수신시각': item.receivedAt
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // Set column widths for clean presentation
    worksheet['!cols'] = [
      { wch: 22 }, // ID
      { wch: 18 }, // 계좌번호
      { wch: 18 }, // 입금일시
      { wch: 18 }, // 입금자
      { wch: 15 }, // 입금금액(원)
      { wch: 28 }, // 비고(납부상태)
      { wch: 15 }, // 거래후잔액(원)
      { wch: 25 }, // 수신이메일
      { wch: 28 }  // 시스템수신시각
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '입금내역');
    XLSX.writeFile(workbook, EXCEL_FILE_PATH);
    console.log(`[EXCEL] Successfully updated ${EXCEL_FILE_PATH}`);
  } catch (err) {
    console.error('[EXCEL SAVE ERROR]', err);
  }
}

// Helper: Load depositHistory from Excel file if it exists
function loadFromExcel() {
  try {
    if (fs.existsSync(EXCEL_FILE_PATH)) {
      const workbook = XLSX.readFile(EXCEL_FILE_PATH);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(sheet);
      
      if (rawData && rawData.length > 0) {
        depositHistory = rawData.map(row => ({
          id: row['ID'] || ('dep-' + Date.now()),
          account: row['계좌번호'] || '130027-52-081538',
          depositDate: row['입금일시'] || '',
          depositor: row['입금자'] || '',
          amount: Number(row['입금금액(원)']) || 0,
          balance: Number(row['거래후잔액(원)']) || 0,
          recipientEmail: row['수신이메일'] || 'himin50@gmail.com',
          receivedAt: row['시스템수신시각'] || new Date().toISOString()
        }));
        console.log(`[EXCEL LOAD] Loaded ${depositHistory.length} records from ${EXCEL_FILE_PATH}`);
        return;
      }
    }
    // Initial save if file does not exist yet
    saveToExcel();
  } catch (err) {
    console.error('[EXCEL LOAD ERROR]', err);
  }
}

// Initialize excel persistence on server start
loadFromExcel();

// Helper: Broadcast to all connected SSE clients
function broadcastEvent(data) {
  sseClients.forEach(client => {
    client.res.write(`data: ${JSON.stringify(data)}\n\n`);
  });
}

// 1. SSE Stream Endpoint for Real-time Browser Dashboard
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const clientId = Date.now();
  const newClient = { id: clientId, res };
  sseClients.push(newClient);

  // Send initial connected event & history
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'SSE Stream Active', history: depositHistory })}\n\n`);

  req.on('close', () => {
    sseClients = sseClients.filter(c => c.id !== clientId);
  });
});

// 2. Get deposit history API
app.get('/api/deposits', (req, res) => {
  res.json({ success: true, data: depositHistory });
});

// 3. Webhook endpoint called by n8n or external services
app.post('/api/webhook/deposit', (req, res) => {
  const { account, depositDate, depositor, amount, balance, recipientEmail, note, paymentStatus } = req.body;

  // Default account if omitted
  const cleanStr = (val) => {
    let s = String(val || '').replace(/^=/, '').trim();
    if (s.includes('{{') && s.includes('}}')) {
      s = s.replace(/\{\{\s*\$json\.[a-zA-Z0-9._]+\s*\}\}/g, '').trim();
    }
    return s;
  };
  const targetAccount = cleanStr(account) || '130027-52-081538';

  const depositRecord = {
    id: 'dep-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    account: targetAccount,
    depositDate: cleanStr(depositDate) || new Date().toLocaleString('ko-KR'),
    depositor: cleanStr(depositor) || '미확인 입금자',
    note: cleanStr(note || paymentStatus),
    amount: parseInt(amount, 10) || 0,
    balance: parseInt(balance, 10) || 0,
    recipientEmail: cleanStr(recipientEmail) || 'himin50@gmail.com',
    receivedAt: new Date().toISOString()
  };

  depositHistory.unshift(depositRecord);
  if (depositHistory.length > 50) depositHistory.pop(); // Keep recent 50

  // Save to Excel asynchronously
  saveToExcel();

  // Push live event to connected browser windows
  broadcastEvent({
    type: 'NEW_DEPOSIT',
    deposit: depositRecord
  });

  console.log(`[DEPOSIT ALERT] 언제: ${depositRecord.depositDate} | 누가: ${depositRecord.depositor} | 금액: ${depositRecord.amount.toLocaleString()}원 | 계좌: ${depositRecord.account}`);

  res.json({
    success: true,
    message: 'Deposit alert broadcasted successfully',
    record: depositRecord
  });
});

// 4. Parser & Simulator Endpoint (For testing Nonghyup email format)
app.post('/api/simulate-email', (req, res) => {
  const { rawEmailText } = req.body;
  if (!rawEmailText) {
    return res.status(400).json({ success: false, error: 'rawEmailText is required' });
  }

  // Parse email text using same logic as n8n Code node
  const content = rawEmailText;

  // Account
  const accountMatch = content.match(/130027-?52-?081538/);
  const account = accountMatch ? '130027-52-081538' : '130027-52-081538';

  // Date (언제)
  let dateMatch = content.match(/(\d{4}[-./]\d{2}[-./]\d{2}\s+\d{2}:\d{2}(?:\d{2})?)/);
  if (!dateMatch) {
    dateMatch = content.match(/(?:거래일시|일시)[:\s]*([\d-./:\s]+)/);
  }
  const depositDate = dateMatch ? (dateMatch[1] || dateMatch[2]).trim() : new Date().toLocaleString('ko-KR');

  // Depositor (누가)
  let depositorMatch = content.match(/(?:보내신분|입금자|보낸이|적요)[:\s]*([^\r\n<,]+)/);
  if (!depositorMatch) {
    depositorMatch = content.match(/(?:입금|통지)[:\s]*([^\r\n<,]+님|[^\r\n<,]+)/);
  }
  let depositor = depositorMatch ? depositorMatch[1].trim() : '미확인 입금자';
  depositor = depositor.replace(/<[^>]*>/g, '').replace(/^(?:\(적요\)|보내신분|입금자|보낸이)[:\s]*/, '').replace(/님$/, '').trim();

  // Amount
  let amountMatch = content.match(/(?:입금금액|입금액|금액)[:\s]*([\d,]+)(?:\s*원)?/);
  let amountStr = amountMatch ? amountMatch[1].replace(/,/g, '') : '100000';
  const amount = parseInt(amountStr, 10) || 100000;

  // Balance
  let balanceMatch = content.match(/(?:거래후잔액|잔액)[:\s]*([\d,]+)(?:\s*원)?/);
  let balanceStr = balanceMatch ? balanceMatch[1].replace(/,/g, '') : '2000000';
  const balance = parseInt(balanceStr, 10) || 2000000;

  const depositRecord = {
    id: 'dep-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    account,
    depositDate,
    depositor,
    amount,
    balance,
    recipientEmail: 'himin50@gmail.com',
    receivedAt: new Date().toISOString()
  };

  depositHistory.unshift(depositRecord);
  
  // Save to Excel
  saveToExcel();

  broadcastEvent({
    type: 'NEW_DEPOSIT',
    deposit: depositRecord
  });

  res.json({ success: true, parsed: depositRecord });
});

// 5. Excel Export / Download Endpoint
app.get('/api/export/excel', (req, res) => {
  try {
    saveToExcel(); // Ensure latest state is saved
    res.download(EXCEL_FILE_PATH, 'NH농협_입금내역.xlsx', (err) => {
      if (err) {
        console.error('[EXCEL DOWNLOAD ERROR]', err);
        if (!res.headersSent) {
          res.status(500).json({ success: false, error: 'Failed to download Excel file' });
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` 농협 130027-52-081538 입금 실시간 화면 대시보드 서버`);
  console.log(` 서버 실행 주소: http://localhost:${PORT}`);
  console.log(` 엑셀 저장 경로: ${EXCEL_FILE_PATH}`);
  console.log(`====================================================`);
});

