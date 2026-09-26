const sleep = ms => new Promise(r => setTimeout(r, ms));

// Allow side panel to open on action click
if (chrome.sidePanel) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
}

// Automatically open feedback page when user removes the extension
if (chrome.runtime && chrome.runtime.setUninstallURL) {
  const UNINSTALL_URL = 'https://guy224.github.io/unfollowdel/uninstall.html';
  chrome.runtime.setUninstallURL(UNINSTALL_URL).catch((err) => {
    console.warn('Failed to set uninstall URL:', err);
  });
}

let automationState = {
  status: 'idle', // 'idle', 'running', 'paused', 'completed', 'error'
  queue: [],
  currentIndex: 0,
  targetTotal: 0,
  errorMsg: ''
};

// Listen for messages from the popup (side panel)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_STATUS') {
    sendResponse(automationState);
    return true;
  }
  if (request.action === 'START_AUTOMATION') {
    startAutomation(request.users, request.batchSize || 25);
    sendResponse({ success: true });
    return true;
  }
  if (request.action === 'STOP_AUTOMATION') {
    automationState.status = 'paused';
    sendResponse({ success: true });
    return true;
  }
  if (request.action === 'FOLLOW_USER') {
    executeFollowUser(request.username)
      .then(() => sendResponse({ success: true }))
      .catch((e) => sendResponse({ error: e.message }));
    return true;
  }
});

async function startAutomation(users, batchSize) {
  if (automationState.status === 'running') return;
  
  automationState = {
    status: 'running',
    queue: users,
    currentIndex: 0,
    targetTotal: Math.min(users.length, batchSize), 
    errorMsg: ''
  };

  try {
    const tabs = await new Promise(resolve => {
      chrome.tabs.query({ url: "*://*.instagram.com/*" }, resolve);
    });
    if (!tabs || tabs.length === 0) {
      throw new Error("No Instagram tab open. Please open one to use visual automation.");
    }
    const igTab = tabs[0];

    for (let i = 0; i < automationState.targetTotal; i++) {
      if (automationState.status !== 'running') break;

      const user = automationState.queue[i];
      automationState.currentIndex = i;

      await processUser(igTab.id, user.username);

      if (automationState.status !== 'running') break;
      automationState.currentIndex = i + 1;

      if (i < automationState.targetTotal - 1) {
        // Fast but semi-safe human delay between profiles
        const delaySecs = Math.floor(Math.random() * (2000 - 800 + 1) + 800);
        await sleep(delaySecs);
      }
    }
    
    if (automationState.status === 'running') {
      automationState.status = 'completed';
    }
  } catch (err) {
    console.error("Automation error:", err);
    automationState.status = 'error';
    automationState.errorMsg = err.message;
  }
}

async function processUser(tabId, username) {
  try {
    // 1. Navigate
    await new Promise(resolve => {
      chrome.tabs.update(tabId, { url: `https://www.instagram.com/${username}/`, active: true }, resolve);
    });

    // Wait for the navigation to actually complete before injecting scripts
    await new Promise((resolve) => {
      const checkStatus = () => {
        chrome.tabs.get(tabId, (tab) => {
          if (tab.status === 'complete') {
            resolve();
          } else {
            setTimeout(checkStatus, 200);
          }
        });
      };
      setTimeout(checkStatus, 500); // give it a moment to start navigating
    });
    
    // Give Instagram's React tree a small extra moment to mount after 'complete'
    await sleep(800);
    
    // Bring window to focus so visual automation works properly
    const tab = await new Promise(resolve => chrome.tabs.get(tabId, resolve));
    chrome.windows.update(tab.windowId, { focused: true });

    // NO HARD SLEEP HERE ANYMORE! We rely purely on the fast DOM polling inside animateAndGetCoords.

    // 2. Attach Debugger
    const debugTarget = { tabId };
    await new Promise((resolve, reject) => {
      chrome.debugger.attach(debugTarget, "1.3", () => {
        if (chrome.runtime.lastError) {
           if (chrome.runtime.lastError.message.includes('attached')) {
             resolve();
           } else {
             reject(chrome.runtime.lastError);
           }
        } else {
          resolve();
        }
      });
    });

    try {
      // Step 1: Find "Following" button coordinates & play animation
      const coords1 = await animateAndGetCoords(tabId, ['Following', 'במעקב', 'Requested', 'מבוקש']);
      if (!coords1) throw new Error("Following button not found");

      // Click "Following"
      await simulateClick(debugTarget, coords1.x, coords1.y);

      // NO HARD SLEEP HERE EITHER! The next poll instantly waits for the modal.

      // Step 2: Find "Unfollow" button coordinates & play animation in modal
      const coords2 = await animateAndGetCoords(tabId, ['Unfollow', 'ביטול מעקב']);
      if (!coords2) throw new Error("Unfollow confirm button not found in modal");

      // Click "Unfollow"
      await simulateClick(debugTarget, coords2.x, coords2.y);
      
      // Wait for action to register slightly before navigating away
      await sleep(300);
      
    } finally {
      // Always detach debugger when done with this profile
      await new Promise(resolve => {
         chrome.debugger.detach(debugTarget, resolve);
      });
    }

  } catch (error) {
    console.error(`Error processing ${username}:`, error);
    throw error;
  }
}

async function animateAndGetCoords(tabId, targetTexts) {
  const results = await new Promise(resolve => {
    chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: async (texts) => {
        // Aggressive Polling to wait for button to render instantly (up to 6 seconds max)
        let target = null;
        for (let i = 0; i < 40; i++) {
          const elements = Array.from(document.querySelectorAll('button, div[role="button"], div[tabindex="0"]'));
          target = elements.find(el => {
            // Instagram often nests text deep in spans.
            // Check direct text and text of all children.
            const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
            return texts.some(t => txt.includes(t.toLowerCase()));
          });
          if (target) break;
          await new Promise(r => setTimeout(r, 150));
        }

        if (!target) return null;

        // Smooth scroll to it
        target.scrollIntoView({ behavior: 'auto', block: 'center' }); // Switched to 'auto' for instant scrolling
        await new Promise(r => setTimeout(r, 50));

        const rect = target.getBoundingClientRect();
        const endX = rect.left + rect.width / 2;
        const endY = rect.top + rect.height / 2;

        // Visual "Bot Cursor" Animation - made much faster
        let cursor = document.getElementById('insta-bot-cursor');
        if (!cursor) {
            cursor = document.createElement('div');
            cursor.id = 'insta-bot-cursor';
            cursor.style.cssText = 'position:fixed; z-index:999999; width:24px; height:24px; background:radial-gradient(circle, #ff0055 0%, #ff0000 100%); border-radius:50%; box-shadow:0 0 15px 5px rgba(255,0,0,0.6); pointer-events:none; transition: all 0.25s cubic-bezier(0.25, 1, 0.5, 1);';
            document.body.appendChild(cursor);
            cursor.style.left = (window.innerWidth / 2) + 'px';
            cursor.style.top = (window.innerHeight) + 'px';
            cursor.getBoundingClientRect();
        }

        // Move cursor to target
        cursor.style.left = (endX - 12) + 'px';
        cursor.style.top = (endY - 12) + 'px';

        const originalBoxShadow = target.style.boxShadow;
        const originalTransform = target.style.transform;
        const originalTransition = target.style.transition;
        
        target.style.transition = 'all 0.15s';
        target.style.boxShadow = '0 0 20px 5px rgba(255, 0, 85, 0.8)';
        target.style.transform = 'scale(1.02)';

        // Wait for fast cursor travel
        await new Promise(r => setTimeout(r, 260));

        // Inject Ripple Animation CSS (Faster ripple)
        if (!document.getElementById('insta-bot-styles')) {
            const style = document.createElement('style');
            style.id = 'insta-bot-styles';
            style.textContent = `@keyframes insta-bot-ripple { 0% { transform: scale(0.5); opacity: 1; } 100% { transform: scale(3.5); opacity: 0; } }`;
            document.head.appendChild(style);
        }

        // Ripple Effect
        const ripple = document.createElement('div');
        ripple.style.cssText = `position:fixed; z-index:999998; width:40px; height:40px; border:3px solid #ff0055; border-radius:50%; pointer-events:none; left:${endX-20}px; top:${endY-20}px; animation: insta-bot-ripple 0.3s ease-out forwards;`;
        document.body.appendChild(ripple);
        
        setTimeout(() => ripple.remove(), 300);

        // Restore button styling
        setTimeout(() => {
            target.style.transform = originalTransform || 'none';
            target.style.boxShadow = originalBoxShadow || 'none';
            target.style.transition = originalTransition || 'none';
        }, 300);

        return { x: endX, y: endY };
      },
      args: [targetTexts]
    }, resolve);
  });

  return results && results[0] ? results[0].result : null;
}

async function simulateClick(debugTarget, x, y) {
  const moveEvent = {
    type: 'mouseMoved',
    x: x,
    y: y,
    button: 'none',
    clickCount: 0
  };
  
  const pressEvent = {
    type: 'mousePressed',
    x: x,
    y: y,
    button: 'left',
    clickCount: 1
  };
  
  const releaseEvent = {
    type: 'mouseReleased',
    x: x,
    y: y,
    button: 'left',
    clickCount: 1
  };

  await sendDebuggerCommand(debugTarget, 'Input.dispatchMouseEvent', moveEvent);
  await sleep(40); 
  await sendDebuggerCommand(debugTarget, 'Input.dispatchMouseEvent', pressEvent);
  await sleep(Math.floor(Math.random() * (60 - 20 + 1) + 20)); 
  await sendDebuggerCommand(debugTarget, 'Input.dispatchMouseEvent', releaseEvent);
}

function sendDebuggerCommand(target, method, params) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand(target, method, params, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result);
      }
    });
  });
}

async function executeFollowUser(username) {
  const tabs = await new Promise(resolve => {
    chrome.tabs.query({ url: "*://*.instagram.com/*" }, resolve);
  });
  if (!tabs || tabs.length === 0) throw new Error("No Instagram tab open.");
  const tabId = tabs[0].id;

  await new Promise(resolve => {
    chrome.tabs.update(tabId, { url: `https://www.instagram.com/${username}/`, active: true }, resolve);
  });

  await new Promise((resolve) => {
    const checkStatus = () => {
      chrome.tabs.get(tabId, (tab) => {
        if (tab.status === 'complete') resolve();
        else setTimeout(checkStatus, 200);
      });
    };
    setTimeout(checkStatus, 500);
  });

  await sleep(800);
  const tab = await new Promise(resolve => chrome.tabs.get(tabId, resolve));
  chrome.windows.update(tab.windowId, { focused: true });

  const debugTarget = { tabId };
  await new Promise((resolve, reject) => {
    chrome.debugger.attach(debugTarget, "1.3", () => {
      if (chrome.runtime.lastError) {
        if (chrome.runtime.lastError.message.includes('attached')) resolve();
        else reject(chrome.runtime.lastError);
      } else resolve();
    });
  });

  try {
    const coords = await animateAndGetCoords(tabId, ['Follow', 'מעקב', 'Follow Back', 'מעקב חזרה']);
    if (!coords) throw new Error("Follow button not found");

    await simulateClick(debugTarget, coords.x, coords.y);
    await sleep(1500);
  } finally {
    await new Promise(resolve => chrome.debugger.detach(debugTarget, resolve));
  }
}
