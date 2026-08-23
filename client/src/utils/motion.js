import { useReducedMotion } from "framer-motion";

export function useMotionSafe() {
  const prefersReduced = useReducedMotion();
  return !prefersReduced;
}

export const easing = {
  smooth: [0.16, 1, 0.3, 1],
  standard: [0.2, 0.8, 0.2, 1]
};

export const fadeUp = {
  hidden: { opacity: 0, y: 14, filter: "blur(4px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)" }
};

export const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1 }
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.98, y: 6, filter: "blur(4px)" },
  show: { opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }
};

export function pageTransition({ reduceMotion = false } = {}) {
  if (reduceMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 }
    };
  }

  return {
    initial: { opacity: 0, y: 12, filter: "blur(6px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    exit: { opacity: 0, y: -8, filter: "blur(6px)" }
  };
}

export const transitions = {
  fast: { duration: 0.22, ease: easing.smooth },
  base: { duration: 0.35, ease: easing.smooth }
};

export function stagger({ reduceMotion = false } = {}) {
  if (reduceMotion) {
    return {
      hidden: {},
      show: { transition: { when: "beforeChildren" } }
    };
  }

  return {
    hidden: {},
    show: {
      transition: {
        when: "beforeChildren",
        staggerChildren: 0.08,
        delayChildren: 0.05
      }
    }
  };
}

