import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '../ui/Button'

export function HeroSection() {
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100)
    return () => clearTimeout(timer)
  }, [])

  return (
    <section id="hero" className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 lp-hero-bg" />
      <div className="absolute top-20 left-1/4 w-72 h-72 bg-coral-500/10 rounded-full blur-[100px] lp-animate-float" />
      <div className="absolute bottom-32 right-1/4 w-56 h-56 bg-accent-blue/10 rounded-full blur-[80px] lp-animate-float" style={{ animationDelay: '1.5s' }} />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* Content */}
      <div className="relative z-10 text-center px-4 sm:px-6 max-w-4xl mx-auto">
        <h1
          className={`text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight transition-all duration-1000 ease-out ${
            isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <span className="gradient-text">家事</span>
          <span className="text-white">を、</span>
          <span className="gradient-text">家族の力</span>
          <span className="text-white">に。</span>
        </h1>

        <p
          className={`mt-6 md:mt-8 text-lg sm:text-xl md:text-2xl text-dark-300 leading-relaxed transition-all duration-1000 ease-out delay-300 ${
            isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          家族みんなで家事を見える化。
          <br className="sm:hidden" />
          誰が何をしたか一目瞭然。
        </p>

        <div
          className={`mt-10 md:mt-12 transition-all duration-1000 ease-out delay-500 ${
            isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <Button
            variant="secondary"
            size="lg"
            className="text-lg px-10"
            onClick={() => {
              document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            詳しく見る
          </Button>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 lp-animate-scroll-indicator">
        <ChevronDown className="w-6 h-6 text-dark-400" />
      </div>
    </section>
  )
}
