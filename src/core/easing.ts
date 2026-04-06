export const ease = {
  linear: (t: number): number => t,

  easeInQuad: (t: number): number => t * t,
  easeOutQuad: (t: number): number => t * (2 - t),
  easeInOutQuad: (t: number): number =>
    t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,

  easeInCubic: (t: number): number => t * t * t,
  easeOutCubic: (t: number): number => --t * t * t + 1,
  easeInOutCubic: (t: number): number =>
    t < 0.5
      ? 4 * t * t * t
      : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,

  /** Bounce at the end */
  easeOutBounce: (t: number): number => {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
  },

  /** Spring-like overshoot */
  easeOutBack: (t: number): number => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },

  /** Elastic oscillation at the end */
  easeOutElastic: (t: number): number => {
    if (t === 0 || t === 1) return t;
    const c4 = (2 * Math.PI) / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },

  /** Elastic oscillation at both ends */
  easeInOutElastic: (t: number): number => {
    if (t === 0 || t === 1) return t;
    const c5 = (2 * Math.PI) / 4.5;
    return t < 0.5
      ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
      : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1;
  },

  /** Exponential deceleration */
  easeOutExpo: (t: number): number => {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  },

  /** Exponential acceleration and deceleration */
  easeInOutExpo: (t: number): number => {
    if (t === 0 || t === 1) return t;
    return t < 0.5
      ? Math.pow(2, 20 * t - 10) / 2
      : (2 - Math.pow(2, -20 * t + 10)) / 2;
  },
} as const;

export type EasingFunction = (t: number) => number;

/**
 * Create a spring-based easing function.
 *
 * @param damping  - Damping ratio (0 = no damping / infinite oscillation,
 *                   1 = critically damped / no overshoot). Typical: 0.5–0.8.
 * @param stiffness - Spring stiffness. Higher = faster. Typical: 100–300.
 * @returns An easing function (t: 0-1) => value (may overshoot 0-1 range).
 */
export function spring(damping: number, stiffness: number): EasingFunction {
  // Approximate a damped spring using the analytical solution:
  //   x(t) = 1 - e^(-damping * omega * t) * cos(omega_d * t)
  // where omega = sqrt(stiffness), omega_d = omega * sqrt(1 - damping^2)
  const omega = Math.sqrt(stiffness);
  const dampedOmega = omega * Math.sqrt(Math.max(0, 1 - damping * damping));
  return (t: number): number => {
    if (t === 0) return 0;
    if (t >= 1) return 1;
    return 1 - Math.exp(-damping * omega * t) * Math.cos(dampedOmega * t);
  };
}
