import { useScrollAnimation } from '../../hooks/useScrollAnimation'

const roles = [
  {
    image: '/familyIcons/father.jpg',
    label: 'おとうさん',
    role: 'FATHER',
    color: 'border-accent-blue/50',
  },
  {
    image: '/familyIcons/mother.jpg',
    label: 'おかあさん',
    role: 'MOTHER',
    color: 'border-coral-500/50',
  },
  {
    image: '/familyIcons/brother.jpg',
    label: 'おにいちゃん',
    role: 'BROTHER',
    color: 'border-accent-green/50',
  },
  {
    image: '/familyIcons/sister.jpg',
    label: 'いもうと',
    role: 'SISTER',
    color: 'border-coral-400/50',
  },
]

export function FamilyRolesSection() {
  const { ref, isVisible } = useScrollAnimation()

  return (
    <section id="roles" className="py-20 md:py-28 lg:py-32 px-4 sm:px-6">
      <div ref={ref} className="max-w-4xl mx-auto text-center">
        <h2
          className={`text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4 transition-all duration-700 ease-out ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <span className="gradient-text">家族みんな</span>で使える
        </h2>
        <p
          className={`text-dark-400 mb-12 md:mb-16 text-base sm:text-lg transition-all duration-700 ease-out delay-100 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          それぞれの役割で家事を楽しく分担しましょう
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 md:gap-10">
          {roles.map((role, index) => (
            <div
              key={role.role}
              className={`group transition-all duration-700 ease-out ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
              style={{ transitionDelay: isVisible ? `${300 + index * 100}ms` : '0ms' }}
            >
              <div className="relative mx-auto w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 mb-4 group-hover:-translate-y-2 transition-transform duration-300">
                <img
                  src={role.image}
                  alt={`${role.label}の役割アイコン`}
                  loading="lazy"
                  className={`w-full h-full rounded-full object-cover border-4 ${role.color} shadow-lg shadow-dark-950/50`}
                />
              </div>
              <p className="text-white font-semibold text-sm sm:text-base">{role.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
