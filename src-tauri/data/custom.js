window.addEventListener("DOMContentLoaded",()=>{const t=document.createElement("script");t.src="https://www.googletagmanager.com/gtag/js?id=G-W5GKHM0893",t.async=!0,document.head.appendChild(t);const n=document.createElement("script");n.textContent="window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'G-W5GKHM0893');",document.body.appendChild(n)});// ==========================
// PakePlus Tab 系统 - iframe 方案
// 版本：1.2.4
// 修复：正确处理新链接打开
// ==========================

const STORAGE_KEY = 'pp_tabs_data';

function isIframe() {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
}

function loadTabsFromStorage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const data = JSON.parse(saved);
      return {
        tabs: data.tabs || [{ id: 1, title: '首页', url: window.location.href }],
        activeTabId: data.activeTabId || 1
      };
    }
  } catch (e) {}
  return null;
}

function saveTabsToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      tabs: tabs,
      activeTabId: activeTabId
    }));
  } catch (e) {}
}

const savedData = loadTabsFromStorage();
let tabs = savedData ? savedData.tabs : [
  { id: 1, title: '首页', url: window.location.href }
];
let activeTabId = savedData ? savedData.activeTabId : 1;

const iframeCache = new Map();

function injectCSS() {
  const oldStyle = document.getElementById('ppTabStyle');
  if (oldStyle) oldStyle.remove();

  const style = document.createElement('style');
  style.id = 'ppTabStyle';
  style.textContent = `
    .pp-tab-bar {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      height: 40px !important;
      background: #2c2c2c !important;
      display: flex !important;
      align-items: center !important;
      padding: 0 8px !important;
      z-index: 999999 !important;
      gap: 4px !important;
      box-sizing: border-box !important;
      pointer-events: auto !important;
    }
    .pp-tab {
      height: 32px !important;
      line-height: 32px !important;
      padding: 0 12px !important;
      background: #444 !important;
      color: #fff !important;
      border-radius: 4px !important;
      cursor: pointer !important;
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      user-select: none !important;
      white-space: nowrap !important;
      box-sizing: border-box !important;
      font-size: 14px !important;
    }
    .pp-tab.active {
      background: #007aff !important;
    }
    .pp-tab-close {
      font-size: 14px !important;
      width: 16px !important;
      height: 16px !important;
      border-radius: 50% !important;
      background: rgba(255,255,255,0.2) !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      flex-shrink: 0 !important;
    }
    .pp-iframe-container {
      position: fixed !important;
      top: 40px !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      display: none !important;
      z-index: 10 !important;
      pointer-events: none !important;
    }
    .pp-iframe-container.active {
      display: block !important;
      pointer-events: auto !important;
    }
    .pp-iframe-container iframe {
      width: 100% !important;
      height: 100% !important;
      border: none !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
    }
    body {
      margin-top: 40px !important;
      overflow: hidden !important;
      pointer-events: auto !important;
    }
    html, body {
      height: 100% !important;
      width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    * {
      pointer-events: auto !important;
    }
  `;
  document.head.appendChild(style);
}

function createTabBar() {
  const oldBar = document.getElementById('ppTabBar');
  if (oldBar) oldBar.remove();

  injectCSS();

  const bar = document.createElement('div');
  bar.className = 'pp-tab-bar';
  bar.id = 'ppTabBar';
  document.body.appendChild(bar);

  renderTabs();
}

function renderTabs() {
  const bar = document.getElementById('ppTabBar');
  if (!bar) return;

  bar.innerHTML = '';

  tabs.forEach(tab => {
    const tabEl = document.createElement('div');
    tabEl.className = 'pp-tab' + (tab.id === activeTabId ? ' active' : '');
    tabEl.innerHTML = `<span>${tab.title}</span><span class="pp-tab-close" data-id="${tab.id}">×</span>`;

    tabEl.addEventListener('click', (e) => {
      if (!e.target.classList.contains('pp-tab-close')) {
        switchTab(tab.id);
      }
    });

    tabEl.querySelector('.pp-tab-close').addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(tab.id);
    });

    bar.appendChild(tabEl);
  });

  const addBtn = document.createElement('div');
  addBtn.className = 'pp-tab';
  addBtn.textContent = '+';
  addBtn.addEventListener('click', addNewTab);
  bar.appendChild(addBtn);
}

function injectIframeScript(iframe, tabId) {
  const injectAttempts = { [tabId]: 0 };
  
  function injectScript() {
    try {
      const win = iframe.contentWindow;
      const doc = iframe.contentDocument || win?.document;
      
      if (!doc || !win) {
        console.warn('Cannot access iframe content for tab', tabId);
        return false;
      }

      if (doc.readyState === 'loading') {
        return false;
      }

      const existingScript = doc.getElementById('pp-iframe-script');
      if (existingScript) {
        existingScript.remove();
      }

      const scriptCode = `
        (function() {
          if (window.ppScriptInjected) return;
          window.ppScriptInjected = true;
          window.ppTabId = ${tabId};
          
          function resolveUrl(url) {
            if (!url) return url;
            if (url.startsWith('http://') || url.startsWith('https://')) {
              return url;
            }
            if (url.startsWith('//')) {
              return window.location.protocol + url;
            }
            if (url.startsWith('/')) {
              return window.location.origin + url;
            }
            var baseUrl = window.location.origin + window.location.pathname;
            var basePath = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
            return basePath + url;
          }

          function navigateToParent(url, title) {
            var resolvedUrl = resolveUrl(url);
            window.parent.postMessage({ 
              type: 'PP_NAVIGATE', 
              url: resolvedUrl, 
              title: title 
            }, '*');
          }

          function handleAnchorClick(e) {
            var origin = e.target.closest('a');
            if (origin && origin.href) {
              if (origin.target === '_blank') {
                e.preventDefault();
                e.stopPropagation();
                navigateToParent(origin.href, origin.textContent.trim() || '新标签');
              }
            }
          }

          document.addEventListener('click', handleAnchorClick, true);

          var originalOpen = window.open;
          window.open = function(url, target, features) {
            if (!url) return originalOpen.call(window, url, target, features);
            if (url.startsWith('about:') || url.startsWith('javascript:')) {
              return originalOpen.call(window, url, target, features);
            }
            if (url.startsWith('data:') || url.startsWith('blob:')) {
              return originalOpen.call(window, url, target, features);
            }
            navigateToParent(url, '新标签');
            return { closed: false };
          };
        })();
      `;

      const script = doc.createElement('script');
      script.id = 'pp-iframe-script';
      script.textContent = scriptCode;
      
      if (doc.head) {
        doc.head.appendChild(script);
        console.log('Script injected successfully for tab', tabId);
        return true;
      } else if (doc.body) {
        doc.body.appendChild(script);
        console.log('Script injected to body for tab', tabId);
        return true;
      }
    } catch (e) {
      console.error('Error injecting script for tab', tabId, e.message);
    }
    return false;
  }
  
  function tryInject() {
    if (injectAttempts[tabId] > 30) {
      console.warn('Max injection attempts reached for tab', tabId);
      return;
    }
    
    if (injectScript()) {
      return;
    }
    
    injectAttempts[tabId]++;
    const delay = Math.min(injectAttempts[tabId] * 150, 2000);
    setTimeout(tryInject, delay);
  }
  
  setTimeout(tryInject, 100);
  
  setTimeout(function checkAndInject() {
    try {
      const win = iframe.contentWindow;
      const doc = iframe.contentDocument || win?.document;
      if (doc && doc.getElementById && !doc.getElementById('pp-iframe-script')) {
        console.log('Delayed injection attempt for tab', tabId);
        injectIframeScript(iframe, tabId);
      }
    } catch (e) {}
  }, 3000);
}

function createIframe(tabId, url) {
  const container = document.createElement('div');
  container.className = 'pp-iframe-container';
  container.id = `pp-iframe-${tabId}`;
  
  const iframe = document.createElement('iframe');
  iframe.src = url;
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframe.setAttribute('allowtransparency', 'true');
  
  container.appendChild(iframe);
  document.body.appendChild(container);
  
  let loadCount = 0;
  iframe.onload = () => {
    loadCount++;
    console.log('iframe loaded for tab', tabId, 'url:', url, 'load count:', loadCount);
    
    injectIframeScript(iframe, tabId);
    
    setTimeout(() => {
      injectIframeScript(iframe, tabId);
    }, 300);
    
    setTimeout(() => {
      injectIframeScript(iframe, tabId);
    }, 800);
    
    setTimeout(() => {
      injectIframeScript(iframe, tabId);
    }, 1500);
    
    setTimeout(() => {
      injectIframeScript(iframe, tabId);
    }, 3000);
    
    try {
      const title = iframe.contentDocument?.title || iframe.contentWindow?.document?.title;
      if (title) {
        const tab = tabs.find(t => t.id === tabId);
        if (tab && tab.title !== title.trim()) {
          tab.title = title.trim();
          saveTabsToStorage();
          renderTabs();
        }
      }
    } catch (e) {
      console.error('Error reading title for tab', tabId, e.message);
    }
  };
  
  iframe.onerror = (error) => {
    console.error('iframe error for tab', tabId, error);
  };
  
  iframeCache.set(tabId, { container, iframe });
  return { container, iframe };
}

function switchTab(tabId) {
  const prevFrame = iframeCache.get(activeTabId);
  if (prevFrame) {
    prevFrame.container.classList.remove('active');
  }

  activeTabId = tabId;
  saveTabsToStorage();

  const tab = tabs.find(t => t.id === tabId);
  if (tab) {
    let frameData = iframeCache.get(tabId);
    if (!frameData) {
      frameData = createIframe(tabId, tab.url);
    } else if (frameData.iframe.src !== tab.url) {
      frameData.iframe.src = tab.url;
    }
    frameData.container.classList.add('active');
  }

  renderTabs();
}

function navigateTo(url, title) {
  if (!url) return;

  const existingTab = tabs.find(t => t.url === url);
  if (existingTab) {
    switchTab(existingTab.id);
    return;
  }

  const newId = Date.now();
  const newTab = { id: newId, title: title || extractTitleFromUrl(url), url: url };
  tabs.push(newTab);
  activeTabId = newId;
  saveTabsToStorage();
  
  createIframe(newId, url);
  
  iframeCache.forEach((frame) => frame.container.classList.remove('active'));
  const newFrame = iframeCache.get(newId);
  if (newFrame) newFrame.container.classList.add('active');
  
  renderTabs();
}

window.pakePlusNavigate = navigateTo;

function extractTitleFromUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return '新标签';
  }
}

function closeTab(tabId) {
  if (tabs.length <= 1) return;

  const frameData = iframeCache.get(tabId);
  if (frameData) {
    frameData.container.remove();
    iframeCache.delete(tabId);
  }

  tabs = tabs.filter(t => t.id !== tabId);
  saveTabsToStorage();

  if (activeTabId === tabId) {
    switchTab(tabs[0].id);
  } else {
    renderTabs();
  }
}

function addNewTab() {
  const newId = Date.now();
  const currentTab = tabs.find(t => t.id === activeTabId);
  const newUrl = currentTab ? currentTab.url : window.location.href;
  tabs.push({ id: newId, title: '新标签', url: newUrl });
  saveTabsToStorage();
  switchTab(newId);
}

const originalOpen = window.open;
window.open = function (url, target, features) {
  if (!url) return originalOpen.call(window, url, target, features);
  
  if (url.startsWith('about:') || url.startsWith('javascript:')) {
    return originalOpen.call(window, url, target, features);
  }

  const existingTab = tabs.find(t => t.url === url);
  if (existingTab) {
    switchTab(existingTab.id);
    return { closed: false };
  }

  navigateTo(url, extractTitleFromUrl(url));
  return { closed: false };
};

function setupMessageListener() {
  window.addEventListener('message', function(event) {
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      
      if (data.type === 'PP_NAVIGATE' && data.url) {
        navigateTo(data.url, data.title || '新标签');
      }
    } catch (e) {
      console.error('Failed to handle message:', e);
    }
  }, false);
}

let setupDone = false;

function setup() {
  if (isIframe()) {
    return;
  }

  if (setupDone) {
    return;
  }

  setupDone = true;

  setupMessageListener();
  createTabBar();
  switchTab(activeTabId);
  
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (activeTab) {
    activeTab.url = window.location.href;
    activeTab.title = document.title.trim() || '首页';
    saveTabsToStorage();
    renderTabs();
  }
}

document.addEventListener('DOMContentLoaded', setup);
window.addEventListener('load', setup);