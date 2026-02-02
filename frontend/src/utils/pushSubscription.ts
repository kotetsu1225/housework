/**
 * Push通知購読関連のユーティリティ関数
 */

/**
 * Base64 URL-safeエンコードされたVAPID公開鍵をUint8Arrayに変換
 * @param base64UrlKey - Base64 URL-safeエンコードされた公開鍵
 * @returns Uint8Array形式の鍵
 */
export function urlBase64ToUint8Array(base64UrlKey: string): Uint8Array {
  const padding = '='.repeat((4 - (base64UrlKey.length % 4)) % 4)
  const base64 = (base64UrlKey + padding).replace(/-/g, '+').replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}

/**
 * ArrayBufferをBase64文字列に変換
 * @param buffer - 変換するArrayBuffer
 * @returns Base64エンコードされた文字列
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

/**
 * PushSubscriptionのキー情報を取得してBase64に変換
 * @param subscription - PushSubscriptionオブジェクト
 * @returns p256dhとauthキーのBase64文字列
 */
export function getSubscriptionKeys(subscription: PushSubscription): {
  p256dh: string
  auth: string
} {
  const p256dhKey = subscription.getKey('p256dh')
  const authKey = subscription.getKey('auth')

  if (!p256dhKey || !authKey) {
    throw new Error('PushSubscription keys are missing')
  }

  return {
    p256dh: arrayBufferToBase64(p256dhKey),
    auth: arrayBufferToBase64(authKey),
  }
}

/**
 * VAPID公開鍵を取得（環境変数から）
 * @returns VAPID公開鍵、未設定の場合はnull
 */
export function getVapidPublicKey(): string | null {
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY
  return key && key.trim() !== '' ? key.trim() : null
}
