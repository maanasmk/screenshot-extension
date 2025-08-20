const captureBtn = document.getElementById('captureBtn');
const downloadBtn = document.getElementById('downloadBtn');
const previewImg = document.getElementById('preview');
const msgDiv = document.getElementById('msg');
const canvas = document.getElementById('canvas');
const deleteBtn = document.getElementById('deleteBtn');

function showMessage(m) {
  msgDiv.textContent = m || '';
}

chrome.storage.local.get("lastCapture", ({ lastCapture }) => {
  if (lastCapture && lastCapture.dataUrl) {
    handleCaptureResult(lastCapture.dataUrl, lastCapture.rect);
  }
});

function handleCaptureResult(dataUrl, rect) {
  const img = new Image();
  img.onload = () => {
    const dpr = rect.devicePixelRatio || 1;
    const sx = rect.x * dpr;
    const sy = rect.y * dpr;
    const sw = rect.width * dpr;
    const sh = rect.height * dpr;

    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, sw, sh);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

    previewImg.src = canvas.toDataURL("image/png");
    previewImg.style.display = "block";
    downloadBtn.disabled = false;
    deleteBtn.disabled = false;
    deleteBtn.style.display = "inline-block";
    showMessage('');
  };
  img.src = dataUrl;
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'ERROR') {
    showMessage(message.error || 'Error occurred');
  }
  if (message.type === 'CAPTURE_RESULT') {
    handleCaptureResult(message.dataUrl, message.rect);
  }
});

captureBtn.addEventListener('click', async () => {
  showMessage('');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) { showMessage("No active tab."); return; }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    showMessage('Select an area on the page...');
  } catch (err) {
    showMessage("Failed to inject selection script: " + err.message);
  }
});

downloadBtn.addEventListener('click', () => {
  if (!canvas.width) { showMessage('No image to download.'); return; }
  canvas.toBlob((blob) => {
    if (!blob) { showMessage('Failed to create file.'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.download = `screenshot-${timestamp}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, 'image/png');
});
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get("lastCapture", (result) => {
    if (result.lastCapture && result.lastCapture.dataUrl) {
      previewImg.src = result.lastCapture.dataUrl;
      previewImg.style.display = "block";
      deleteBtn.disabled = false;
      deleteBtn.style.display = "inline-block";
    }
  });

  deleteBtn.addEventListener("click", () => {
    chrome.storage.local.remove("lastCapture", () => {
      previewImg.src = "";
      previewImg.style.display = "none";
      deleteBtn.disabled = true;
      deleteBtn.style.display = "none";
      canvas.width = 0;
      canvas.height = 0;
      downloadBtn.disabled = true;
      showMessage("Screenshot deleted.");
    });
  });
});
