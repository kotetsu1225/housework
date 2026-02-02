/**
 * Push Subscription API関数
 *
 * Push通知購読関連のAPI呼び出しを提供
 * @see backend/src/main/kotlin/com/task/presentation/PushSubscriptions.kt
 */

import { apiPost, apiGet } from './client'
import type {
  RegisterPushSubscriptionRequest,
  RegisterPushSubscriptionResponse,
  CheckPushSubscriptionResponse,
  IsPushNotificationsPermissionAnswerResponse,
  SavePushNotificationsPermissionAnswerRequest,
  SavePushNotificationsPermissionAnswerResponse,
} from '../types/api'

/**
 * Push通知購読を登録する
 * POST /api/push-subscriptions
 *
 * @param request - 購読登録リクエスト（endpoint, keys）
 * @returns 購読ID
 *
 * @example
 * ```typescript
 * const { subscriptionId } = await registerPushSubscription({
 *   endpoint: 'https://fcm.googleapis.com/...',
 *   keys: {
 *     p256dh: 'base64-encoded-key',
 *     auth: 'base64-encoded-auth'
 *   }
 * })
 * ```
 */
export async function registerPushSubscription(
  request: RegisterPushSubscriptionRequest
): Promise<RegisterPushSubscriptionResponse> {
  return apiPost<RegisterPushSubscriptionResponse, RegisterPushSubscriptionRequest>(
    '/push-subscriptions',
    request
  )
}

/**
 * 自身のPush通知購読状態を確認する
 * GET /api/push-subscriptions/my
 *
 * @returns 購読状態
 */
export async function checkPushSubscription(): Promise<CheckPushSubscriptionResponse> {
  return apiGet<CheckPushSubscriptionResponse>('/push-subscriptions/my')
}

/**
 * Push通知許可の回答済み判定を確認する
 * GET /api/push-subscriptions/is-push-notification-permission-answer
 *
 * @returns 回答済みかどうか
 */
export async function checkPushNotificationsPermissionAnswer(
): Promise<IsPushNotificationsPermissionAnswerResponse> {
  return apiGet<IsPushNotificationsPermissionAnswerResponse>(
    '/push-subscriptions/is-push-notification-permission-answer'
  )
}

/**
 * Push通知許可の回答を保存する
 * POST /api/push-subscriptions/permission-answer
 *
 * @param request - 回答内容
 */
export async function savePushNotificationsPermissionAnswer(
  request: SavePushNotificationsPermissionAnswerRequest
): Promise<SavePushNotificationsPermissionAnswerResponse> {
  return apiPost<
    SavePushNotificationsPermissionAnswerResponse,
    SavePushNotificationsPermissionAnswerRequest
  >('/push-subscriptions/permission-answer', request)
}
