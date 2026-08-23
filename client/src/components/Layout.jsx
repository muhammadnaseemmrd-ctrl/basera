import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { BookOpenCheck, Home, Languages, Mail, Menu, MessageSquare, Moon, Search, Share2, Sun, User, Users, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { transitions, useMotionSafe } from "../utils/motion";
import { dashboardPathForRole, useAuthStore } from "../store/useAuthStore";
import { useAppStore } from "../store/useAppStore";
import { useLocaleStore } from "../store/useLocaleStore";

const navItems = [
  { key: "navFindHousing", to: "/" },
  { key: "navListings", to: "/hostels" },
  { key: "navRooms", to: "/rooms" },
  { key: "navStays", to: "/stays" },
  { key: "navCompare", to: "/compare-cities" },
  { key: "navDashboard", to: "/dashboard/student" },
  { key: "navAboutUs", to: "/about" }
];

export function Navbar({ simple = false }) {
  const motionSafe = useMotionSafe();
  const [open, setOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const theme = useAppStore((state) => state.theme);
  const toggleTheme = useAppStore((state) => state.toggleTheme);
  const locale = useLocaleStore((state) => state.locale);
  const toggleLocale = useLocaleStore((state) => state.toggleLocale);
  const t = useLocaleStore((state) => state.t);
  const dashboardPath = user ? dashboardPathForRole(user.role) : "/dashboard/student";
  const resolvedNavItems = navItems.map((item) => ({
    ...item,
    label: t(item.key),
    to: item.key === "navDashboard" ? dashboardPath : item.to
  }));

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
      <div className="container-page flex h-[76px] items-center justify-between gap-4">
        <Link to="/" className="group inline-flex shrink-0 items-center gap-3 text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-700 text-white shadow-card transition duration-250 ease-smooth group-hover:shadow-float">
            H
          </span>
          <span>
            Hostel<span className="text-primary-800">Hub</span>
          </span>
        </Link>
        {!simple && (
          <nav className="hidden items-center gap-8 text-base text-neutral-700 md:flex">
            {resolvedNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `group relative py-2 font-semibold transition duration-250 ease-smooth ${
                    isActive ? "text-ink" : "text-neutral-700 hover:text-ink"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <motion.span whileHover={motionSafe ? { y: -1 } : undefined} transition={motionSafe ? transitions.fast : undefined}>
                      {item.label}
                    </motion.span>
                    <span
                      className={`pointer-events-none absolute inset-x-0 -bottom-0.5 h-0.5 origin-left rounded-full bg-primary-700 transition duration-250 ease-smooth ${
                        isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                      }`}
                    />
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        )}
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={toggleLocale}
            className="hidden h-10 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-bold text-primary-800 shadow-card transition duration-250 ease-smooth hover:-translate-y-0.5 hover:shadow-float sm:inline-flex"
            aria-label="Toggle language"
          >
            <Languages size={16} /> {t("langToggleLabel")}
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-line bg-surface text-primary-800 shadow-card transition duration-250 ease-smooth hover:-translate-y-0.5 hover:shadow-float"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {user ? (
            <>
              <Link to={dashboardPath} className="hidden text-sm font-semibold text-primary-800 sm:inline-flex">
                {user.name}
              </Link>
              <button type="button" onClick={logout} className="btn-primary hidden px-5 py-2.5 sm:inline-flex">
                {t("navLogout")}
              </button>
            </>
          ) : (
            <Link to="/login" className="btn-primary hidden px-5 py-2.5 sm:inline-flex">
              {t("navLogin")}
            </Link>
          )}
          {!simple && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="btn-ghost inline-flex md:hidden"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {open && !simple && (
          <motion.div
            key="mobileMenu"
            initial={motionSafe ? { opacity: 0 } : false}
            animate={motionSafe ? { opacity: 1 } : undefined}
            exit={motionSafe ? { opacity: 0 } : undefined}
            transition={motionSafe ? transitions.fast : undefined}
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm md:hidden"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={motionSafe ? { y: -12, opacity: 0 } : false}
              animate={motionSafe ? { y: 0, opacity: 1 } : undefined}
              exit={motionSafe ? { y: -10, opacity: 0 } : undefined}
              transition={motionSafe ? transitions.base : undefined}
              className="mx-auto mt-3 w-[calc(100%-24px)] overflow-hidden rounded-2xl border border-line bg-white shadow-soft"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <Link to="/" className="inline-flex items-center gap-2 text-lg font-extrabold tracking-tight text-ink" onClick={() => setOpen(false)}>
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-700 text-white shadow-card">H</span>
                  Hostel<span className="text-primary-800">Hub</span>
                </Link>
                <button type="button" className="btn-ghost" onClick={() => setOpen(false)} aria-label="Close menu">
                  <X size={20} />
                </button>
              </div>
              <div className="p-4">
                <div className="grid gap-2">
                  {resolvedNavItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center justify-between rounded-xl px-4 py-3 font-semibold transition duration-250 ease-smooth ${
                          isActive ? "bg-neutral-100 text-ink" : "text-neutral-700 hover:bg-neutral-50 hover:text-ink"
                        }`
                      }
                    >
                      <span>{item.label}</span>
                      <span className="text-neutral-400">-&gt;</span>
                    </NavLink>
                  ))}
                </div>
                <div className="mt-4 grid gap-2">
                  <button type="button" onClick={toggleLocale} className="btn-secondary w-full">
                    <Languages size={18} />
                    {t("langToggleLabel")}
                  </button>
                  <button type="button" onClick={toggleTheme} className="btn-secondary w-full">
                    {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
                    Toggle Theme
                  </button>
                  {user ? (
                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        setOpen(false);
                      }}
                      className="btn-primary w-full"
                    >
                      {t("navLogout")}
                    </button>
                  ) : (
                    <>
                      <Link to="/login" onClick={() => setOpen(false)} className="btn-secondary w-full">
                        {t("login")}
                      </Link>
                      <Link to="/login" onClick={() => setOpen(false)} className="btn-primary w-full">
                        Sign In
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

export function Footer({ compact = false }) {
  if (compact) {
    return (
      <footer className="border-t border-line bg-surface">
        <div className="container-page flex flex-col gap-5 py-10 md:flex-row md:items-center md:justify-between">
          <Link to="/" className="text-xl font-extrabold text-ink">
            Hostel<span className="text-primary-800">Hub</span>
          </Link>
          <div className="flex flex-wrap gap-7 text-sm text-neutral-700">
            <Link to="/privacy" className="hover:text-ink">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-ink">Terms of Service</Link>
            <Link to="/help" className="hover:text-ink">Help Center</Link>
            <Link to="/contact" className="hover:text-ink">Contact Us</Link>
          </div>
          <p className="text-sm text-neutral-600">(c) 2024 Basera. All rights reserved.</p>
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t border-line bg-neutral-50">
      <div className="container-page grid gap-10 py-16 md:grid-cols-[1.5fr_1fr_1fr_1.35fr]">
        <div>
          <Link to="/" className="text-xl font-extrabold text-ink">
            Basera
          </Link>
          <p className="mt-5 max-w-sm text-sm leading-7 text-neutral-700">
            Pakistan's trusted platform for student accommodations. Find your home away from home with confidence.
          </p>
          <div className="mt-8 flex gap-4">
            {[Users, Share2, Mail].map((Icon, index) => (
              <span
                key={index}
                className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface text-primary-800 shadow-card transition duration-250 ease-smooth hover:-translate-y-0.5 hover:shadow-float"
              >
                <Icon size={18} />
              </span>
            ))}
          </div>
        </div>
        <FooterColumn title="Company" items={["About Us", "Careers", "Privacy Policy", "Terms of Service"]} />
        <FooterColumn title="Support" items={["Help Center", "Contact Us", "Safety Resource", "Cancellation Options"]} />
        <div>
          <h3 className="font-bold text-ink">Subscribe</h3>
          <p className="mt-5 text-sm leading-7 text-neutral-700">Get the latest hostel updates and student deals.</p>
          <input className="input mt-7" placeholder="Email address" />
          <button className="btn-primary mt-3 w-full">Subscribe</button>
        </div>
      </div>
      <div className="border-t border-line py-8 text-center text-sm text-neutral-600">(c) 2024 Basera. All rights reserved.</div>
    </footer>
  );
}

function FooterColumn({ title, items }) {
  return (
    <div>
      <h3 className="font-bold text-ink">{title}</h3>
      <div className="mt-5 grid gap-4 text-sm text-neutral-700">
        {items.map((item) => (
          <Link key={item} to="#" className="hover:text-ink">{item}</Link>
        ))}
      </div>
    </div>
  );
}

export function PageShell({ children, footer = true, compactFooter = false, simpleNav = false }) {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <Navbar simple={simpleNav} />
      {children}
      {footer && <Footer compact={compactFooter} />}
    </div>
  );
}

export function MobileBottomNav() {
  const user = useAuthStore((state) => state.user);
  const dashboardPath = user ? dashboardPathForRole(user.role) : "/dashboard/student";
  const items = [
    { label: "Home", to: "/", icon: Home },
    { label: "Search", to: "/rooms", icon: Search },
    { label: "Bookings", to: "/dashboard/student/bookings", icon: BookOpenCheck },
    { label: "Messages", to: "/dashboard/student/chat", icon: MessageSquare },
    { label: "Profile", to: user?.role === "student" ? "/dashboard/student/profile" : dashboardPath, icon: User }
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-surface/95 px-2 py-2 shadow-soft backdrop-blur md:hidden">
      {items.map(({ label, to, icon: Icon }) => (
        <NavLink key={label} to={to} className={({ isActive }) => `grid justify-items-center gap-1 rounded-lg px-1 py-2 text-[11px] font-semibold ${isActive ? "text-primary-800" : "text-slate-600"}`}>
          <Icon size={18} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
