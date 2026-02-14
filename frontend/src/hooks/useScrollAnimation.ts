import { useCallback, useRef, useState } from 'react'

interface UseScrollAnimationOptions {
  threshold?: number
  rootMargin?: string
  triggerOnce?: boolean
}

interface UseScrollAnimationReturn {
  ref: (node: HTMLDivElement | null) => void
  isVisible: boolean
}

/**
 * Intersection Observer によるスクロールアニメーションフック
 *
 * ビューポートに要素が進入したことを検知し、isVisible を true にする。
 * prefers-reduced-motion が有効な場合は即座に true を返す。
 * callback ref パターンで要素マウント時に Observer を設定する。
 */
export function useScrollAnimation({
  threshold = 0.1,
  rootMargin = '0px 0px -50px 0px',
  triggerOnce = true,
}: UseScrollAnimationOptions = {}): UseScrollAnimationReturn {
  const [isVisible, setIsVisible] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      // Cleanup previous observer
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }

      if (!node) return

      // Skip animations for reduced-motion preference
      const prefersReducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches
      if (prefersReducedMotion) {
        setIsVisible(true)
        return
      }

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIsVisible(true)
            if (triggerOnce) {
              observer.disconnect()
            }
          } else if (!triggerOnce) {
            setIsVisible(false)
          }
        },
        { threshold, rootMargin }
      )

      observer.observe(node)
      observerRef.current = observer
    },
    [threshold, rootMargin, triggerOnce]
  )

  return { ref, isVisible }
}
