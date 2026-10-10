package com.task.usecase.pushSubscription

/**
 * 通知の購読先(endpoint = 端末のブラウザ)が、別の家族(テナント)のアカウントで既に登録されている(#48)。
 *
 * オーナー判断(#48 案 C): 付け替えずに断る。元の家族側で通知を解除すれば登録できる。
 * StatusPages で HTTP 409 に変換する。メッセージはそのまま利用者に表示してよい内容にしている
 * (別の家族の情報は含めない)。
 */
class PushEndpointRegisteredByAnotherFamilyException :
    RuntimeException("この端末は別の家族のアカウントで通知登録されています")
