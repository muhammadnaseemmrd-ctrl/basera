import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useMotionSafe } from "../utils/motion";

const spring = { stiffness: 220, damping: 24, mass: 0.7 };

export function DepthCard({ as = "article", outerClassName = "h-full", className = "", children, maxRotate = 5 }) {
  const motionSafe = useMotionSafe();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const rotateX = useSpring(useTransform(pointerY, [-0.5, 0.5], [maxRotate, -maxRotate]), spring);
  const rotateY = useSpring(useTransform(pointerX, [-0.5, 0.5], [-maxRotate, maxRotate]), spring);
  const MotionTag = motion[as] || motion.article;

  const updatePointer = (event) => {
    if (!motionSafe) return;
    const rect = event.currentTarget.getBoundingClientRect();
    pointerX.set((event.clientX - rect.left) / rect.width - 0.5);
    pointerY.set((event.clientY - rect.top) / rect.height - 0.5);
  };

  const resetPointer = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  return (
    <MotionTag
      className={outerClassName}
      onMouseMove={updatePointer}
      onMouseLeave={resetPointer}
      style={{ perspective: 1200 }}
    >
      <motion.div
        className={className}
        style={motionSafe ? { rotateX, rotateY, transformStyle: "preserve-3d" } : undefined}
        transition={motionSafe ? spring : undefined}
      >
        {children}
      </motion.div>
    </MotionTag>
  );
}
