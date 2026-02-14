import { UserPlus, ListPlus, Trophy } from 'lucide-react'
import { useScrollAnimation } from '../../hooks/useScrollAnimation'

const steps = [
  {
    icon: UserPlus,
    number: '01',
    title: '家族で登録',
    description: '父・母・兄弟・姉妹の役割を選んで、それぞれのアカウントを作成します。',
  },
  {
    icon: ListPlus,
    number: '02',
    title: 'タスクを設定',
    description: '繰り返しタスクや単発タスクを自由に作成。家族共有と個人用を使い分けられます。',
  },
  {
    icon: Trophy,
    number: '03',
    title: '記録 & 達成',
    description: 'タスクを完了してポイントを獲得。ランキングで家族と楽しく競争しましょう。',
  },
]

export function HowItWorksSection() {
  const { ref, isVisible } = useScrollAnimation()

  return (
    <section id="how-it-works" className="py-20 md:py-28 lg:py-32 px-4 sm:px-6">
      <div ref={ref} className="max-w-5xl mx-auto">
        <h2
          className={`text-2xl sm:text-3xl md:text-4xl font-bold text-center text-white mb-4 transition-all duration-700 ease-out ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          使い方は<span className="gradient-text">かんたん</span>3ステップ
        </h2>
        <p
          className={`text-dark-400 text-center mb-12 md:mb-16 text-base sm:text-lg transition-all duration-700 ease-out delay-100 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          すぐに始められるシンプルな設計
        </p>

        <div className="relative flex flex-col md:flex-row items-stretch gap-6 md:gap-8">
          {/* Connector line (desktop) */}
          <div
            className={`hidden md:block absolute top-16 left-[calc(16.66%+1rem)] right-[calc(16.66%+1rem)] h-0.5 bg-gradient-to-r from-coral-500/40 via-coral-500/20 to-coral-500/40 transition-transform duration-1000 ease-out origin-left ${
              isVisible ? 'scale-x-100' : 'scale-x-0'
            }`}
            style={{ transitionDelay: '600ms' }}
          />

          {steps.map((step, index) => {
            const Icon = step.icon
            return (
              <div
                key={step.number}
                className={`flex-1 text-center transition-all duration-700 ease-out ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
                style={{ transitionDelay: isVisible ? `${300 + index * 200}ms` : '0ms' }}
              >
                {/* Step circle */}
                <div className="relative inline-flex items-center justify-center w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-coral-500/20 to-coral-600/10 border border-coral-500/30 mb-6">
                  <Icon className="w-8 h-8 md:w-10 md:h-10 text-coral-400" />
                  <span className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-coral-500 text-white text-xs font-bold flex items-center justify-center">
                    {step.number}
                  </span>
                </div>

                <h3 className="text-lg md:text-xl font-bold text-white mb-3">{step.title}</h3>
                <p className="text-dark-400 text-sm md:text-base leading-relaxed max-w-xs mx-auto">
                  {step.description}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
