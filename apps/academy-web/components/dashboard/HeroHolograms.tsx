import { HERO_SYMBOLS } from '../../lib/holograms';

export function HeroHolograms() {
  return (
    <div className="hero-holograms" aria-hidden="true">
      {HERO_SYMBOLS.map((symbol) => (
        <span
          key={symbol.id}
          className="hero-hologram"
          style={
            {
              left: `${symbol.x}%`,
              top: `${symbol.y}%`,
              fontSize: `${symbol.size}px`,
              '--holo-rot': `${symbol.rotate}deg`,
              animationDuration: `${symbol.duration}s`,
              animationDelay: `${symbol.delay}s`,
            } as React.CSSProperties
          }
        >
          {symbol.glyph}
        </span>
      ))}
    </div>
  );
}
