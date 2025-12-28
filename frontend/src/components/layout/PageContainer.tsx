import { ReactNode } from 'react'
import { clsx } from 'clsx'

export interface PageContainerProps {
  children: ReactNode
  className?: string
  noPadding?: boolean
}

/**
 * ページコンテナ
 *
 * レスポンシブ対応:
 * - モバイル: max-w-lg (512px)
 * - タブレット: max-w-2xl (672px)
 * - デスクトップ: max-w-4xl (896px)
 */
export function PageContainer({ children, className, noPadding = false }: PageContainerProps) {
  return (
    <main
      className={clsx(
        'min-h-screen pb-20 mx-auto',
        // レスポンシブ幅
        'max-w-lg md:max-w-2xl lg:max-w-4xl',
        !noPadding && 'px-4 md:px-6 lg:px-8',
        className
      )}
    >
      {children}
    </main>
  )
}
