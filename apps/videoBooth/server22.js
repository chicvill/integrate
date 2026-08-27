const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

const uploadDir = path.join(__dirname, 'data');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const now = new Date();
        const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
        cb(null, `guestbook_${timestamp}.webm`);
    }
});

const upload = multer({ storage });
app.use(express.static(__dirname));

app.post('/upload', upload.single('video'), (req, res) => {
    if (req.file) res.json({ success: true, message: '저장 완료!' });
    else res.status(400).json({ success: false, message: '실패' });
});

app.listen(port, () => console.log(`Server running on port ${port}`));