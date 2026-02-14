import { Eye, MessageSquare, CalendarX, AlertTriangle } from 'lucide-react'
import { useScrollAnimation } from '../../hooks/useScrollAnimation'

const problems = [
  {
    icon: Eye,
    title: '誰が何をしたか分からない',
    description: '家事の貢献が見えず、不公平感が生まれてしまう',
  },
  {
    icon: MessageSquare,
    title: 'やり方が共有されていない',
    description: '暗黙知のまま属人化し、引き継ぎができない',
  },
  {
    icon: CalendarX,
    title: '予定が把握できない',
    description: '家族の空き時間が分からず、頼みづらい',
  },
  {
    icon: AlertTriangle,
    title: 'タスクが抜け漏れる',
    description: '誰もやっていなかったことに後から気づく',
  },
]

export function ProblemSection() {
  const { ref, isVisible } = useScrollAnimation()

  return (
    <section id="problem" className="py-20 md:py-28 lg:py-32 px-4 sm:px-6">
      <div ref={ref} className="max-w-5xl mx-auto">
        <h2
          className={`text-2xl sm:text-3xl md:text-4xl font-bold text-center text-white mb-4 transition-all duration-700 ease-out ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          こんな<span className="gradient-text">お悩み</span>ありませんか？
        </h2>
        <p
          className={`text-dark-400 text-center mb-12 md:mb-16 text-base sm:text-lg transition-all duration-700 ease-out delay-100 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          家事の分担に関する「あるある」を、Houseworkが解決します
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
          {problems.map((problem, index) => {
            const Icon = problem.icon
            return (
              <div
                key={problem.title}
                className={`glass-card p-6 md:p-8 group hover:border-coral-500/30 transition-all duration-500 ease-out ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
                style={{ transitionDelay: isVisible ? `${200 + index * 100}ms` : '0ms' }}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-coral-500/10 flex items-center justify-center group-hover:bg-coral-500/20 transition-colors duration-300">
                    <Icon className="w-6 h-6 text-coral-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-2">{problem.title}</h3>
                    <p className="text-dark-400 text-sm leading-relaxed">{problem.description}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
