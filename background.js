chrome.runtime.onMessage.addListener((message, sender) => {
    if (message && message.type === "SELECTION_ESTABLISHED") {
      const rect = message.rect;
      chrome.tabs.captureVisibleTab({ format: "png" }, (dataUrl) => {
        if (chrome.runtime.lastError || !dataUrl) {
          chrome.runtime.sendMessage({
            type: "ERROR",
            error: chrome.runtime.lastError?.message || "Capture failed",
          });
          return;
        }

        chrome.storage.local.set({ lastCapture: { dataUrl, rect } }, () => {
          chrome.runtime.sendMessage({ type: "CAPTURE_RESULT", dataUrl, rect });
  
          if (chrome.action.openPopup) {
            chrome.action.openPopup().catch(() => {});
          }
        });
      });
    }

    if (message && message.type === "CAPTURE_VISIBLE_REQUEST") {
      captureVisibleAndDownload();
    }
  });

  chrome.commands.onCommand.addListener((command) => {
    console.log("command recieved", command)
    if (command === "capture_visible_area_Q"|| command === "capture_visible_area_X") {
      captureVisibleAndDownload();
    }
  });

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "captureFullPage") {
      captureFullPage(msg.tabId);
    }
  });
  
  async function captureFullPage(tabId) {
    const [{ result: page }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight
      }),
    });
  
    let y = 0;
    const images = [];
    while (y < page.height) {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (scrollY) => window.scrollTo(0, scrollY),
        args: [y],
      });
  
      await new Promise(r => setTimeout(r, 700));
  
      const dataUrl = await new Promise(resolve => {
        chrome.tabs.captureVisibleTab({ format: "png" }, resolve);
      });
  
      images.push({ dataUrl, y });
      y += page.viewportHeight;
    }
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
    chrome.tabs.sendMessage(tabId, { action: "stitch", images, width: page.width, height: page.height });
    chrome.tabs.sendMessage(tabId, { action: "cleanup" });
  }
  
  
  