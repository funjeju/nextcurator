// YouTube SPA 네비게이션 감지
let lastUrl = location.href

const observer = new MutationObserver(() => {
  const url = location.href
  if (url !== lastUrl) {
    lastUrl = url
    if (url.includes('youtube.com/watch')) {
      setTimeout(() => {
        chrome.runtime.sendMessage({
          type: 'video_changed',
          url: location.href,
          title: document.title,
        }).catch(() => {})
      }, 1500)
    }
  }
})

observer.observe(document, { subtree: true, childList: true })

// 초기 로드
if (location.href.includes('youtube.com/watch')) {
  setTimeout(() => {
    chrome.runtime.sendMessage({
      type: 'video_changed',
      url: location.href,
      title: document.title,
    }).catch(() => {})
  }, 1500)
}
