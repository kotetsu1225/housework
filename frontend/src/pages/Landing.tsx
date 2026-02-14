import { useState, useEffect } from 'react'
import { HeroSection } from '../components/landing/HeroSection'
import { ProblemSection } from '../components/landing/ProblemSection'
import { FeatureShowcase } from '../components/landing/FeatureShowcase'
import { HowItWorksSection } from '../components/landing/HowItWorksSection'
import { FamilyRolesSection } from '../components/landing/FamilyRolesSection'
import { StatsSection } from '../components/landing/StatsSection'
import { CTASection } from '../components/landing/CTASection'
import { LandingFooter } from '../components/landing/LandingFooter'

function LandingNav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-dark-950/90 backdrop-blur-lg border-b border-dark-800'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        <button
          onClick={() => document.getElementById('hero')?.scrollIntoView({ behavior: 'smooth' })}
          className="text-lg font-bold gradient-text"
        >
          Housework
        </button>

        <div className="flex items-center gap-4 text-sm text-dark-400">
          <button
            onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
            className="hover:text-white transition-colors duration-200"
          >
            機能紹介
          </button>
          <button
            onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
            className="hover:text-white transition-colors duration-200"
          >
            使い方
          </button>
        </div>
      </div>
    </nav>
  )
}

export function Landing() {
  return (
    <div className="min-h-screen bg-dark-950 overflow-x-hidden">
      <LandingNav />
      <HeroSection />

      <div className="lp-section-divider max-w-4xl mx-auto" />
      <ProblemSection />

      <div className="lp-section-divider max-w-4xl mx-auto" />
      <FeatureShowcase />

      <div className="lp-section-divider max-w-4xl mx-auto" />
      <HowItWorksSection />

      <div className="lp-section-divider max-w-4xl mx-auto" />
      <FamilyRolesSection />

      <div className="lp-section-divider max-w-4xl mx-auto" />
      <StatsSection />

      <div className="lp-section-divider max-w-4xl mx-auto" />
      <CTASection />

      <LandingFooter />
    </div>
  )
}
