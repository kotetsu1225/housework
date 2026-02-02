/**
 * Service Worker for Push Notifications
 * 家事タスク管理アプリのPush通知を処理
 */

// Service Workerのインストール
self.addEventListener('install', (event) => {
  // 即座にアクティベート（待機中の古いSWをスキップ）
  self.skipWaiting()
})

// Service Workerのアクティベート
self.addEventListener('activate', (event) => {
  // すべてのクライアントを即座に制御
  event.waitUntil(self.clients.claim())
})

// Push通知の受信
self.addEventListener('push', (event) => {
  // ペイロードがない場合は何もしない
  if (!event.data) {
    console.warn('[SW] Push received without data')
    return
  }

  const rawText = event.data.text()
  if (!rawText) {
    console.warn('[SW] Push received with empty payload')
    return
  }

  let title = '家事タスク'
  let body = ''
  let icon = '/icons/icon-192x192.png'

  try {
    const data = JSON.parse(rawText)
    title = data.title || title
    body = data.body || ''
    icon = data.icon || icon
  } catch (e) {
    // JSONでない場合はテキストをそのまま使用
    body = rawText
  }

  // 通知を表示
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: icon,
      tag: 'housework-task',
      requireInteraction: true,
      data: { url: '/' },
    })
  )
})

// 通知クリック時の処理
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  // アプリを開く or フォーカス
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        // 既存のウィンドウがあればフォーカス
        const appClient = clients.find((c) => c.url.includes(self.location.origin))
        if (appClient) {
          return appClient.focus()
        }
        // なければ新規に開く
        return self.clients.openWindow('/')
      })
  )
})
