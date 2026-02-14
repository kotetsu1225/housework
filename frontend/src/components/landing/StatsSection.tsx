import { useEffect, useState } from 'react'
import { useScrollAnimation } from '../../hooks/useScrollAnimation'

function useCountUp(target: number, duration: number, isVisible: boolean): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!isVisible) return

    let startTime: number | null = null
    let animationId: number

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // easeOutCubic
      setCount(Math.floor(eased * target))
      if (progress < 1) {
        animationId = requestAnimationFrame(animate)
      }
    }

    animationId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationId)
  }, [target, duration, isVisible])

  return count
}

const stats = [
  { value: 100, suffix: '+', label: 'タスクパターン', description: '自由に組み合わせ可能' },
  { value: 4, suffix: '種類', label: 'スケジュール', description: '毎日・毎週・毎月・単発' },
  { value: 0, suffix: '', label: 'リアルタイム', description: '進捗の可視化', isText: true },
  { value: 0, suffix: '円', label: '完全無料', description: '全機能が無料で使える' },
]

export function StatsSection() {
  const { ref, isVisible } = useScrollAnimation()

  const count100 = useCountUp(100, 2000, isVisible)
  const count4 = useCountUp(4, 1500, isVisible)

  return (
    <section id="stats" className="py-20 md:py-28 lg:py-32 px-4 sm:px-6">
      <div ref={ref} className="max-w-5xl mx-auto">
        <div className="glass-card p-8 md:p-12 lp-animate-shine">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className={`text-center transition-all duration-700 ease-out ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                }`}
                style={{ transitionDelay: isVisible ? `${200 + index * 150}ms` : '0ms' }}
              >
                <div className="text-3xl sm:text-4xl md:text-5xl font-extrabold gradient-text mb-2">
                  {stat.isText ? (
                    stat.label
                  ) : (
                    <>
                      {index === 0 ? count100 : index === 1 ? count4 : stat.value}
                      <span className="text-xl sm:text-2xl">{stat.suffix}</span>
                    </>
                  )}
                </div>
                {!stat.isText && (
                  <p className="text-white font-semibold text-sm sm:text-base mb-1">{stat.label}</p>
                )}
                <p className="text-dark-400 text-xs sm:text-sm">{stat.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
