const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

// 1. 영상 저장 폴더 ('data') 자동 생성
const uploadDir = path.join(__dirname, 'data');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// 2. 파일 저장 설정
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const now = new Date();
        const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
        cb(null, `guestbook_${timestamp}.webm`);
    }
});

const upload = multer({ storage });

app.use(express.static(__dirname));
// ★ 중요: data 폴더를 정적 경로로 추가해야 영상 재생 가능
app.use('/data', express.static(uploadDir));

// 3. 업로드 처리 라우터
app.post('/upload', upload.single('video'), (req, res) => {
    if (req.file) {
        console.log(`[저장 완료] ${req.file.filename}`);
        res.json({ success: true, message: '영상 저장 완료!' });
    } else {
        res.status(400).json({ success: false, message: '업로드 실패' });
    }
});

// ★ 4. [이 부분이 없어서 에러가 난 것입니다] 파일 목록 가져오기 라우터
app.get('/list', (req, res) => {
    fs.readdir(uploadDir, (err, files) => {
        if (err) {
            res.status(500).json([]);
            return;
        }
        // 웹엠(.webm) 파일만 골라서 최신순(역순)으로 정렬
        const videoFiles = files
            .filter(file => file.endsWith('.webm'))
            .sort()
            .reverse();
        res.json(videoFiles);
    });
});

app.listen(port, () => {
    console.log(`---------------------------------------------------`);
    console.log(`📺 TV 방명록 서버가 시작되었습니다.`);
    console.log(`👉 접속 주소: http://localhost:${port}`);
    console.log(`---------------------------------------------------`);
});