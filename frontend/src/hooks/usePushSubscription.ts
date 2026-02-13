/**
 * Push通知購読管理フック
 *
 * Service Workerの登録、通知権限の取得、Push購読の作成・管理を提供
 */

import { useState, useEffect, useCallback } from 'react'
import {
  registerPushSubscription,
  checkPushSubscription,
  checkPushNotificationsPermissionAnswer,
  savePushNotificationsPermissionAnswer,
} from '../api/pushSubscriptions'
import { getVapidPublicKey, urlBase64ToUint8Array, getSubscriptionKeys } from '../utils/pushSubscription'
import { getStoredToken } from '../api/client'

type BackendSubscriptionResult = {
  value: boolean
  updated: boolean
}

type BackendPermissionAnswerResult = {
  value: boolean
  updated: boolean
}

type ServiceWorkerStateResult = {
  registration: ServiceWorkerRegistration | null
  subscription: PushSubscription | null
  updated: boolean
}

const isPushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

const getNotificationPermission = (): NotificationPermission =>
  'Notification' in window ? Notification.permission : 'default'

const fetchBackendHasSubscription = async (): Promise<BackendSubscriptionResult> => {
  if (!getStoredToken()) {
    return { value: false, updated: false }
  }

  try {
    const res = await checkPushSubscription()
    return { value: res.hasActiveSubscription, updated: true }
  } catch {
    // 401などは無視
    return { value: false, updated: false }
  }
}

const fetchServiceWorkerState = async (): Promise<ServiceWorkerStateResult> => {
  try {
    const registration = await navigator.serviceWorker.getRegistration()
    if (!registration) {
      return { registration: null, subscription: null, updated: true }
    }

    const subscription = await registration.pushManager.getSubscription()
    return { registration, subscription, updated: true }
  } catch (error) {
    console.error('Failed to get SW registration', error)
    return { registration: null, subscription: null, updated: false }
  }
}

const fetchPermissionAnswer = async (): Promise<BackendPermissionAnswerResult> => {
  if (!getStoredToken()) {
    return { value: false, updated: false }
  }

  try {
    const res = await checkPushNotificationsPermissionAnswer()
    return { value: res.hasPushNotificationsPermissionAnswer, updated: true }
  } catch {
    return { value: false, updated: false }
  }
}

export interface PushSubscriptionState {
  /** Service Worker登録状態 */
  registration: ServiceWorkerRegistration | null
  /** 通知権限状態 */
  permission: NotificationPermission | null
  /** 既存の購読情報（ブラウザ側） */
  subscription: PushSubscription | null
  /** サーバー側に有効な購読があるか */
  hasBackendSubscription: boolean
  /** Push通知許可の回答済みか */
  hasPermissionAnswer: boolean
  /** Push通知許可の回答状態をDBで確認済みか */
  hasCheckedPermissionAnswer: boolean
  /** 購読状態の確認中かどうか */
  isCheckingSubscription: boolean
  /** 回答状態の確認中かどうか */
  isCheckingPermissionAnswer: boolean
  /** 登録中かどうか */
  isRegistering: boolean
  /** エラーメッセージ */
  error: string | null
  /** Push通知がサポートされているか */
  isSupported: boolean
}

export function usePushSubscription() {
  const [state, setState] = useState<PushSubscriptionState>({
    registration: null,
    permission: null,
    subscription: null,
    hasBackendSubscription: false,
    hasPermissionAnswer: false,
    hasCheckedPermissionAnswer: false,
    isCheckingSubscription: false,
    isCheckingPermissionAnswer: false,
    isRegistering: false,
    error: null,
    isSupported: false,
  })

  // 初期化：サポート確認、権限確認、サーバー状態確認
  useEffect(() => {
    const supported = isPushSupported()

    if (!supported) {
      setState((prev) => ({ ...prev, isSupported: false }))
      return
    }

    const init = async () => {
      const permission = getNotificationPermission()
      
      // ログイン状態を確認
      const hasToken = !!getStoredToken()
      
      if (!hasToken) {
        // ログインしていない場合は、Service Workerの状態のみ確認
        const swResult = await fetchServiceWorkerState()
        setState((prev) => ({
          ...prev,
          isSupported: true,
          permission,
          registration: swResult.registration,
          subscription: swResult.subscription,
          hasBackendSubscription: false,
          hasPermissionAnswer: false,
          hasCheckedPermissionAnswer: false,
          isCheckingSubscription: false,
          isCheckingPermissionAnswer: false,
        }))
        return
      }

      // ログインしている場合は、バックエンドの状態も確認
      setState((prev) => ({
        ...prev,
        isCheckingSubscription: true,
        isCheckingPermissionAnswer: true,
      }))
      
      const [backendResult, swResult, permissionResult] = await Promise.all([
        fetchBackendHasSubscription(),
        fetchServiceWorkerState(),
        fetchPermissionAnswer(),
      ])

      setState((prev) => ({
        ...prev,
        isSupported: true,
        permission,
        registration: swResult.registration,
        subscription: swResult.subscription,
        hasBackendSubscription: backendResult.updated
          ? backendResult.value
          : prev.hasBackendSubscription,
        hasPermissionAnswer: permissionResult.updated
          ? permissionResult.value
          : prev.hasPermissionAnswer,
        hasCheckedPermissionAnswer: permissionResult.updated,
        isCheckingSubscription: false,
        isCheckingPermissionAnswer: false,
      }))
    }

    init()
  }, [])

  /**
   * Push通知を購読
   */
  const subscribe = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({ ...prev, isRegistering: true, error: null }))

    try {
      if (!getStoredToken()) {
        throw new Error('ログインが必要です')
      }

      const vapidPublicKey = getVapidPublicKey()
      if (!vapidPublicKey) {
        throw new Error('VAPID公開鍵が設定されていません')
      }

      // Service Worker登録 (未登録の場合)
      let registration = state.registration
      if (!registration) {
        registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
        await navigator.serviceWorker.ready
      }

      // 通知権限リクエスト
      if (Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission()
        setState((prev) => ({ ...prev, permission }))
        if (permission !== 'granted') {
          throw new Error('通知権限が拒否されました')
        }
      }

      // 購読作成
      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
      const applicationServerKey = new Uint8Array(urlBase64ToUint8Array(vapidPublicKey))
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        })
      }

      // バックエンドへ送信
      const keys = getSubscriptionKeys(subscription)
      await registerPushSubscription({
        endpoint: subscription.endpoint,
        keys,
      })

      setState((prev) => ({
        ...prev,
        registration,
        subscription,
        hasBackendSubscription: true,
        hasPermissionAnswer: true,
        hasCheckedPermissionAnswer: true,
        isRegistering: false,
        error: null,
      }))

      return true
    } catch (err: any) {
      console.error('Push購読エラー:', err)
      setState((prev) => ({
        ...prev,
        isRegistering: false,
        error: err.message || '購読に失敗しました',
      }))
      return false
    }
  }, [state.registration])

  /**
   * 状態を再確認 (手動リフレッシュ用)
   */
  const checkSubscription = useCallback(async () => {
    if (!state.isSupported) return

    // ログイン状態を確認
    const hasToken = !!getStoredToken()
    if (!hasToken) {
      // ログインしていない場合は、Service Workerの状態のみ確認
      const swResult = await fetchServiceWorkerState()
      setState((prev) => ({
        ...prev,
        registration: swResult.registration,
        subscription: swResult.subscription,
        hasBackendSubscription: false,
        hasPermissionAnswer: false,
        hasCheckedPermissionAnswer: false,
        isCheckingSubscription: false,
        isCheckingPermissionAnswer: false,
      }))
      return
    }

    setState((prev) => ({
      ...prev,
      isCheckingSubscription: true,
      isCheckingPermissionAnswer: true,
    }))

    const [backendResult, swResult, permissionResult] = await Promise.all([
      fetchBackendHasSubscription(),
      fetchServiceWorkerState(),
      fetchPermissionAnswer(),
    ])

    const nextState: Partial<PushSubscriptionState> = {
      isCheckingSubscription: false,
      isCheckingPermissionAnswer: false,
    }
    if (backendResult.updated) {
      nextState.hasBackendSubscription = backendResult.value
    }
    if (permissionResult.updated) {
      nextState.hasPermissionAnswer = permissionResult.value
      nextState.hasCheckedPermissionAnswer = true
    }
    if (swResult.updated) {
      nextState.registration = swResult.registration
      nextState.subscription = swResult.subscription
    }

    setState((prev) => ({ ...prev, ...nextState }))
  }, [state.isSupported])

  const savePermissionAnswer = useCallback(async (value: boolean): Promise<boolean> => {
    try {
      await savePushNotificationsPermissionAnswer({ value })
      setState((prev) => ({
        ...prev,
        hasPermissionAnswer: true,
        hasCheckedPermissionAnswer: true,
      }))
      return true
    } catch (err: any) {
      console.error('Push通知許可回答の保存に失敗しました:', err)
      setState((prev) => ({
        ...prev,
        error: err.message || '回答の保存に失敗しました',
      }))
      return false
    }
  }, [])

  return {
    ...state,
    subscribe,
    checkSubscription,
    savePermissionAnswer,
  }
}
