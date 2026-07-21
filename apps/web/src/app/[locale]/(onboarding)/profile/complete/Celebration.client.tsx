'use client';

import { useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

interface Particle {
  id: number;
  vx: number;
  vy: number;
  colorClass: string;
  size: number;
  roundClass: string;
}

const PARTICLE_COLORS = ['bg-primary', 'bg-teal', 'bg-gold', 'bg-success'];

export function Celebration() {
  const prefersReducedMotion = useReducedMotion();
  const [particles, setParticles] = useState<Particle[]>([]);
  const [progress, setProgress] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion) return;

    const newParticles: Particle[] = Array.from({ length: 24 }).map((_, i) => {
      const angle = (Math.PI * 2 * i) / 24;
      const velocity = 3 + Math.random() * 2;
      const size = Math.random() < 0.5 ? 8 : 12;

      return {
        id: i,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - 2,
        colorClass: PARTICLE_COLORS[i % PARTICLE_COLORS.length] ?? 'bg-gold',
        size,
        roundClass: Math.random() < 0.5 ? 'rounded-full' : 'rounded-sm',
      };
    });

    setParticles(newParticles);
    startTimeRef.current = Date.now();

    const duration = 1500;

    const animate = () => {
      if (!startTimeRef.current) return;

      const elapsed = Date.now() - startTimeRef.current;
      const currentProgress = Math.min(elapsed / duration, 1);

      setProgress(currentProgress);

      if (currentProgress < 1) {
        requestAnimationFrame(animate);
      } else {
        setParticles([]);
      }
    };

    requestAnimationFrame(animate);
  }, [prefersReducedMotion]);

  if (prefersReducedMotion || particles.length === 0) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed inset-0"
      aria-hidden="true"
    >
      {particles.map((particle) => {
        const x = particle.vx * progress * 60;
        const y = particle.vy * progress * 60;
        const opacity = Math.max(0, 1 - progress);

        return (
          <div
            key={particle.id}
            style={{
              position: 'fixed',
              left: '50%',
              top: '60%',
              transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
              opacity,
              pointerEvents: 'none',
              transition: 'none',
            }}
          >
            <div
              className={`${particle.colorClass} ${particle.roundClass}`}
              style={{
                width: particle.size,
                height: particle.size,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
