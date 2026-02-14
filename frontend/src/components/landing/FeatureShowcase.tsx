import { ClipboardList, TrendingUp, Trophy, Bell, Calendar, Repeat, Check, Clock } from 'lucide-react'
import { useScrollAnimation } from '../../hooks/useScrollAnimation'

/** タスク管理カード内のmockタスクリスト */
function MockTaskList() {
  const tasks = [
    { name: 'お風呂掃除', time: '18:00', scope: 'family', done: true },
    { name: '洗濯物を畳む', time: '19:00', scope: 'family', done: false },
    { name: '夕食の準備', time: '17:30', scope: 'personal', done: false },
  ]
  return (
    <div className="mt-4 space-y-2">
      {tasks.map((task) => (
        <div
          key={task.name}
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs transition-colors ${
            task.done ? 'bg-dark-900/30' : 'bg-dark-900/60'
          }`}
        >
          <div
            className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${
              task.done
                ? 'bg-accent-teal/20 text-accent-teal'
                : 'border border-dark-600'
            }`}
          >
            {task.done && <Check className="w-3 h-3" />}
          </div>
          <span className={`flex-1 ${task.done ? 'text-dark-500 line-through' : 'text-white/80'}`}>
            {task.name}
          </span>
          <div className="flex items-center gap-1 text-dark-500">
            <Clock className="w-3 h-3" />
            <span>{task.time}</span>
          </div>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
              task.scope === 'family'
                ? 'bg-accent-blue/15 text-accent-blue'
                : 'bg-accent-green/15 text-accent-green'
            }`}
          >
            {task.scope === 'family' ? '家族' : '個人'}
          </span>
        </div>
      ))}
    </div>
  )
}

/** リアルタイム進捗カード内のmock ProgressRing + 統計 */
function MockProgressDashboard() {
  return (
    <div className="mt-4 flex items-center gap-5">
      <svg className="w-20 h-20 flex-shrink-0" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
        <circle
          cx="50" cy="50" r="40" fill="none" stroke="#ff9494" strokeWidth="8"
          strokeLinecap="round" strokeDasharray="251" strokeDashoffset="75"
          transform="rotate(-90 50 50)"
          style={{ animation: 'lp-progress-ring 1.5s ease-out forwards' }}
        />
        <text x="50" y="55" textAnchor="middle" fill="white" fontSize="18" fontWeight="bold">70%</text>
      </svg>
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent-teal" />
          <span className="text-dark-400">完了</span>
          <span className="text-white font-semibold ml-auto">7</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-coral-500" />
          <span className="text-dark-400">進行中</span>
          <span className="text-white font-semibold ml-auto">2</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-dark-600" />
          <span className="text-dark-400">未着手</span>
          <span className="text-white font-semibold ml-auto">1</span>
        </div>
      </div>
    </div>
  )
}

/** ランキングカード内のmockランキング */
function MockRanking() {
  const members = [
    { rank: '🥇', name: 'おかあさん', pts: 45, img: '/familyIcons/mother.jpg' },
    { rank: '🥈', name: 'おとうさん', pts: 30, img: '/familyIcons/father.jpg' },
    { rank: '🥉', name: 'おにいちゃん', pts: 20, img: '/familyIcons/brother.jpg' },
  ]
  return (
    <div className="mt-4 space-y-2">
      {members.map((m) => (
        <div key={m.name} className="flex items-center gap-2.5 bg-dark-900/50 rounded-lg px-3 py-2">
          <span className="text-sm">{m.rank}</span>
          <img src={m.img} alt="" className="w-6 h-6 rounded-full object-cover" loading="lazy" />
          <span className="text-xs text-white/80 flex-1">{m.name}</span>
          <span className="text-xs text-coral-400 font-semibold">{m.pts}pt</span>
        </div>
      ))}
    </div>
  )
}

/** プッシュ通知カード内のmock通知 */
function MockNotification() {
  return (
    <div className="mt-3 bg-dark-900/50 rounded-lg px-3 py-2 flex items-start gap-2">
      <div className="w-5 h-5 rounded-full bg-coral-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Bell className="w-3 h-3 text-coral-400" />
      </div>
      <div>
        <p className="text-[10px] text-dark-500">14:00</p>
        <p className="text-xs text-white/70">「お風呂掃除」がまだ完了していません</p>
      </div>
    </div>
  )
}

/** カレンダーカード内のminiカレンダー */
function MockMiniCalendar() {
  const days = ['月', '火', '水', '木', '金', '土', '日']
  const cells = [10, 11, 12, 13, 14, 15, 16]
  const hasTasks = [10, 12, 14, 15]
  return (
    <div className="mt-3">
      <div className="grid grid-cols-7 gap-1 text-center text-[9px]">
        {days.map((d) => (
          <span key={d} className="text-dark-500">{d}</span>
        ))}
        {cells.map((c) => (
          <div
            key={c}
            className={`rounded-md py-1 ${
              c === 14
                ? 'bg-coral-500/30 text-coral-300 font-bold'
                : hasTasks.includes(c)
                  ? 'bg-dark-700/50 text-white/60'
                  : 'text-dark-500'
            }`}
          >
            {c}
          </div>
        ))}
      </div>
    </div>
  )
}

/** スケジュールカード内のmockバッジ */
function MockScheduleBadges() {
  const badges = [
    { label: '毎日', color: 'bg-coral-500/15 text-coral-400' },
    { label: '毎週', color: 'bg-accent-blue/15 text-accent-blue' },
    { label: '毎月', color: 'bg-accent-green/15 text-accent-green' },
    { label: '単発', color: 'bg-dark-600/50 text-dark-300' },
  ]
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {badges.map((b) => (
        <span key={b.label} className={`px-2.5 py-1 rounded-lg text-[11px] font-medium ${b.color}`}>
          {b.label}
        </span>
      ))}
    </div>
  )
}

const features = [
  {
    icon: ClipboardList,
    title: 'タスク管理',
    description: '家族タスクと個人タスクを分けて管理。繰り返し設定やカレンダー表示で漏れなく把握。',
    size: 'large' as const,
    accent: 'coral',
    mock: 'taskList',
  },
  {
    icon: TrendingUp,
    title: 'リアルタイム進捗',
    description: '今日の達成率をひと目で確認。家族全員の進捗がリアルタイムに反映されます。',
    size: 'medium' as const,
    accent: 'blue',
    mock: 'progress',
  },
  {
    icon: Trophy,
    title: 'ポイント & ランキング',
    description: '家事を完了するとポイント獲得。家族内ランキングで楽しく競争。',
    size: 'medium' as const,
    accent: 'green',
    mock: 'ranking',
  },
  {
    icon: Bell,
    title: 'プッシュ通知',
    description: 'やり忘れをゼロに',
    size: 'small' as const,
    accent: 'coral',
    mock: 'notification',
  },
  {
    icon: Calendar,
    title: 'カレンダー表示',
    description: '予定を一目で確認',
    size: 'small' as const,
    accent: 'blue',
    mock: 'calendar',
  },
  {
    icon: Repeat,
    title: '柔軟なスケジュール',
    description: '毎日・毎週・毎月・単発',
    size: 'small' as const,
    accent: 'green',
    mock: 'schedule',
  },
]

const accentColors = {
  coral: {
    bg: 'bg-coral-500/10',
    hoverBg: 'group-hover:bg-coral-500/20',
    icon: 'text-coral-400',
    border: 'hover:border-coral-500/30',
  },
  blue: {
    bg: 'bg-accent-blue/10',
    hoverBg: 'group-hover:bg-accent-blue/20',
    icon: 'text-accent-blue',
    border: 'hover:border-accent-blue/30',
  },
  green: {
    bg: 'bg-accent-green/10',
    hoverBg: 'group-hover:bg-accent-green/20',
    icon: 'text-accent-green',
    border: 'hover:border-accent-green/30',
  },
}

const mockComponents: Record<string, React.FC> = {
  taskList: MockTaskList,
  progress: MockProgressDashboard,
  ranking: MockRanking,
  notification: MockNotification,
  calendar: MockMiniCalendar,
  schedule: MockScheduleBadges,
}

export function FeatureShowcase() {
  const { ref, isVisible } = useScrollAnimation()

  return (
    <section id="features" className="py-20 md:py-28 lg:py-32 px-4 sm:px-6">
      <div ref={ref} className="max-w-6xl mx-auto">
        <h2
          className={`text-2xl sm:text-3xl md:text-4xl font-bold text-center text-white mb-4 transition-all duration-700 ease-out ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <span className="gradient-text">Housework</span>でできること
        </h2>
        <p
          className={`text-dark-400 text-center mb-12 md:mb-16 text-base sm:text-lg transition-all duration-700 ease-out delay-100 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          家事管理に必要な機能をすべて揃えました
        </p>

        {/* Bento grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-auto">
          {features.map((feature, index) => {
            const Icon = feature.icon
            const colors = accentColors[feature.accent as keyof typeof accentColors]
            const isLarge = feature.size === 'large'
            const isMedium = feature.size === 'medium'
            const MockComponent = mockComponents[feature.mock]

            return (
              <div
                key={feature.title}
                className={`
                  glass-card p-6 group ${colors.border} transition-all duration-500 ease-out
                  ${isLarge ? 'sm:col-span-2 lg:col-span-2 lg:row-span-2' : ''}
                  ${isMedium ? 'lg:col-span-2' : ''}
                  ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
                `}
                style={{ transitionDelay: isVisible ? `${200 + index * 80}ms` : '0ms' }}
              >
                <div className={`w-10 h-10 rounded-xl ${colors.bg} ${colors.hoverBg} flex items-center justify-center transition-colors duration-300 mb-4`}>
                  <Icon className={`w-5 h-5 ${colors.icon}`} />
                </div>
                <h3 className={`font-bold text-white ${isLarge ? 'text-xl mb-3' : 'text-base mb-2'}`}>
                  {feature.title}
                </h3>
                <p className={`text-dark-400 leading-relaxed ${isLarge ? 'text-base' : 'text-sm'}`}>
                  {feature.description}
                </p>

                {MockComponent && <MockComponent />}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
