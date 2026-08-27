let mode = 'audio';

function setMode(newMode) {
    mode = newMode;
    const audioBtn = document.getElementById('audioBtn');
    const videoBtn = document.getElementById('videoBtn');

    audioBtn.classList.toggle('active', mode === 'audio');
    videoBtn.classList.toggle('active', mode === 'video');
}

async function handleAction() {
    const urlInput = document.getElementById('urlInput');
    const url = urlInput.value.trim();

    if (!url) {
        alert('유튜브 URL을 입력해 주세요.');
        urlInput.focus();
        return;
    }

    const actionBtn = document.getElementById('actionBtn');
    const statusPanel = document.getElementById('statusPanel');
    const resultPanel = document.getElementById('resultPanel');

    // UI State: Loading
    actionBtn.disabled = true;
    actionBtn.style.opacity = '0.5';
    resultPanel.classList.add('hidden');
    statusPanel.classList.remove('hidden');

    try {
        const response = await fetch('/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: url, mode: mode })
        });

        const data = await response.json();

        if (data.success) {
            // UI State: Success
            statusPanel.classList.add('hidden');
            resultPanel.classList.remove('hidden');

            document.getElementById('mediaTitle').innerText = data.title;

            const downloadLink = document.getElementById('downloadLink');
            downloadLink.href = `/get_file/${encodeURIComponent(data.filename)}`;

            // Scroll to result if needed
            resultPanel.scrollIntoView({ behavior: 'smooth', block: 'end' });
        } else {
            throw new Error(data.error || '분석 중 내부 서버 오류가 발생했습니다.');
        }
    } catch (err) {
        console.error('Download Error:', err);
        alert('에러가 발생했습니다: ' + err.message);
        statusPanel.classList.add('hidden');
    } finally {
        actionBtn.disabled = false;
        actionBtn.style.opacity = '1';
    }
}

// Add Enter key listener
document.getElementById('urlInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleAction();
    }
});
