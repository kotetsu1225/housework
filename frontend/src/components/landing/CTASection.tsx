import { useScrollAnimation } from '../../hooks/useScrollAnimation'

export function CTASection() {
  const { ref, isVisible } = useScrollAnimation()

  return (
    <section id="cta" className="py-20 md:py-28 lg:py-32 px-4 sm:px-6">
      <div ref={ref} className="max-w-4xl mx-auto">
        <div className="relative rounded-3xl overflow-hidden p-8 sm:p-12 md:p-16 text-center bg-gradient-to-br from-coral-500/20 via-coral-600/10 to-dark-900 border border-coral-500/20">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-coral-500/10 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent-blue/10 rounded-full blur-[80px]" />

          <div className="relative z-10">
            <h2
              className={`text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4 md:mb-6 transition-all duration-700 ease-out ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
              }`}
            >
              <span className="gradient-text">家族の家事</span>を、もっとスマートに
            </h2>

            <p
              className={`text-dark-300 text-base sm:text-lg transition-all duration-700 ease-out delay-100 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
              }`}
            >
              Houseworkは家族の家事分担を見える化し、
              <br className="hidden sm:block" />
              みんなが気持ちよく暮らせる仕組みを提供します。
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
