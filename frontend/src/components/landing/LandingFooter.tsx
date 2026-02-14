export function LandingFooter() {
  return (
    <footer className="border-t border-dark-800 py-8 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold gradient-text">Housework</span>
        </div>

        <nav className="flex items-center gap-6 text-sm text-dark-400">
          <button
            onClick={() => document.getElementById('hero')?.scrollIntoView({ behavior: 'smooth' })}
            className="hover:text-white transition-colors duration-200"
          >
            トップ
          </button>
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
        </nav>

        <p className="text-dark-500 text-xs">
          &copy; 2025 Housework
        </p>
      </div>
    </footer>
  )
}
