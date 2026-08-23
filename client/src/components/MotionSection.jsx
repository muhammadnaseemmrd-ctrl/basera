import { motion } from "framer-motion";
import { fadeUp, stagger, transitions, useMotionSafe } from "../utils/motion";

export function MotionSection({ as = "section", children, className = "", delay = 0 }) {
  const motionSafe = useMotionSafe();
  const MotionTag = motion[as] || motion.section;

  return (
    <MotionTag
      className={className}
      initial={motionSafe ? "hidden" : false}
      whileInView={motionSafe ? "show" : undefined}
      viewport={motionSafe ? { once: true, amount: 0.25 } : undefined}
      variants={motionSafe ? stagger({ reduceMotion: false }) : undefined}
      transition={motionSafe ? { ...transitions.base, delay } : undefined}
    >
      <motion.div variants={motionSafe ? fadeUp : undefined}>{children}</motion.div>
    </MotionTag>
  );
}

