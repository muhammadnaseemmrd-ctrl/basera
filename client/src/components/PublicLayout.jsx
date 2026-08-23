import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { Footer, MobileBottomNav, Navbar } from "./Layout";
import { pageTransition, transitions, useMotionSafe } from "../utils/motion";
import { GlobalAlertBanner } from "./GlobalAlertBanner";
import { WhatsAppButton } from "./WhatsAppButton";

const compactFooterMatchers = [
  (pathname) => pathname === "/booking",
  (pathname) => pathname === "/login",
  (pathname) => pathname === "/about",
  (pathname) => pathname === "/contact",
  (pathname) => pathname.startsWith("/hostels/")
];

export function PublicLayout() {
  const location = useLocation();
  const motionSafe = useMotionSafe();

  if (location.pathname === "/dashboard") {
    return <Navigate to="/dashboard/student" replace />;
  }

  const compactFooter = compactFooterMatchers.some((match) => match(location.pathname));

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <Navbar />
      <GlobalAlertBanner />
      <MotionConfig reducedMotion="user" transition={transitions.base}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            {...pageTransition({ reduceMotion: !motionSafe })}
            transition={motionSafe ? transitions.base : transitions.fast}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </MotionConfig>
      <Footer compact={compactFooter} />
      <MobileBottomNav />
      <WhatsAppButton />
    </div>
  );
}
