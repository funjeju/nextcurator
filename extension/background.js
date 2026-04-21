// 사이드패널 자동 열기 — YouTube watch 탭 활성화 시
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId)
    if (tab.url?.includes('youtube.com/watch')) {
      await chrome.sidePanel.open({ tabId })
    }
  } catch {}
})

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('youtube.com/watch')) {
    try {
      await chrome.sidePanel.open({ tabId })
    } catch {}
    // 사이드패널에 영상 변경 알림
    chrome.runtime.sendMessage({ type: 'video_changed', url: tab.url, title: tab.title }).catch(() => {})
  }
})

// ssoktube.com에서 auth 토큰 수신
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.type === 'ssoktube_auth' && message.idToken) {
    chrome.storage.local.set({
      idToken: message.idToken,
      uid: message.uid,
      email: message.email,
      displayName: message.displayName,
      photoURL: message.photoURL,
      tokenSavedAt: Date.now(),
    }, () => {
      sendResponse({ ok: true })
    })
    return true
  }
})

// 사이드패널에서 오는 메시지 처리
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'open_auth') {
    chrome.tabs.create({ url: `https://ssoktube.com/extension-auth?ext=${chrome.runtime.id}` })
    sendResponse({ ok: true })
  }

  if (message.type === 'get_current_video') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0]
      if (tab?.url?.includes('youtube.com/watch')) {
        sendResponse({ url: tab.url, title: tab.title })
      } else {
        sendResponse({ url: null, title: null })
      }
    })
    return true
  }

  if (message.type === 'logout') {
    chrome.storage.local.remove(['idToken', 'uid', 'email', 'displayName', 'photoURL', 'tokenSavedAt'], () => {
      sendResponse({ ok: true })
    })
    return true
  }

  return true
})
