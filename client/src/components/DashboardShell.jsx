import { Link, NavLink } from "react-router-dom";
import { MobileBottomNav } from "./Layout";
import { GlobalAlertBanner } from "./GlobalAlertBanner";

// Derives up to 2 initials from user.name, falling back to user.email, then "U",
// so a missing/undefined name (e.g. incomplete profile) never throws in the sidebar.
const getUserInitials = (user) => {
  const name = user?.name?.trim();
  if (name) {
    return name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }
  const email = user?.email?.trim();
  if (email) return email.slice(0, 2).toUpperCase();
  return "U";
};

export function DashboardShell({
  title,
  subtitle,
  navItems,
  active,
  user,
  children,
  headerRight = null,
  navLabel = "Menu",
  footerText = "Professional management solutions for the modern Basera Host."
}) {
  const itemClasses = (isActive) =>
    `group flex min-w-fit items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold outline-none transition duration-250 ease-smooth ${
      isActive
        ? "bg-primary-700 text-white shadow-card"
        : "text-neutral-700 hover:bg-neutral-100 hover:text-ink focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2"
    }`;

  return (
    <div className="min-h-screen overflow-x-hidden bg-canvas text-ink lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="min-w-0 overflow-hidden border-r border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="flex h-20 items-center gap-3 px-6 text-xl font-extrabold tracking-tight text-ink">
          <img src="/favicon.svg" alt="Basera" className="h-10 w-10 rounded-xl shadow-card" />
          <span>Basera</span>
        </div>

        <p className="hidden px-6 pb-2 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-neutral-400 lg:block">{navLabel}</p>

        <nav className="flex w-full max-w-full gap-2 overflow-x-auto px-4 pb-4 lg:grid lg:flex-1 lg:content-start lg:gap-1.5 lg:overflow-y-auto lg:px-4 lg:py-2">
          {navItems.map(({ icon: Icon, label, to, onClick }) => {
            const isActiveButton = active === label;
            if (to) {
              return (
                <NavLink key={label} to={to} className={({ isActive }) => itemClasses(isActive)}>
                  {Icon && <Icon size={18} className="shrink-0" />}
                  <span className="truncate">{label}</span>
                </NavLink>
              );
            }
            return (
              <button key={label} type="button" onClick={onClick} className={itemClasses(isActiveButton)}>
                {Icon && <Icon size={18} className="shrink-0" />}
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </nav>

        {user && (
          <div className="hidden border-t border-line p-5 lg:flex lg:items-center lg:gap-3">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="h-11 w-11 rounded-full object-cover" />
            ) : (
              <span className="grid h-11 w-11 place-items-center rounded-full bg-primary-700 text-sm font-bold text-white">
                {getUserInitials(user)}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate font-semibold">{user.name}</p>
              <p className="truncate text-xs text-neutral-500">{user.role}</p>
            </div>
          </div>
        )}
      </aside>

      <main className="min-w-0 overflow-x-hidden">
        <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur supports-[backdrop-filter]:bg-surface/70">
          <div className="flex min-h-20 flex-col gap-4 px-5 py-4 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              {subtitle && <p className="mt-0.5 text-sm text-neutral-500">{subtitle}</p>}
            </div>
            {headerRight}
          </div>
        </header>
        <GlobalAlertBanner compact />
        <div className="min-w-0 px-5 py-8 sm:px-8">{children}</div>
        <footer className="border-t border-line bg-surface px-5 py-12 sm:px-8">
          <div className="flex min-w-0 flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Link to="/" className="flex items-center gap-2 text-xl font-extrabold text-ink">
                <img src="/favicon.svg" alt="Basera" className="h-8 w-8 rounded-lg" />
                Basera
              </Link>
              <p className="mt-5 max-w-md text-neutral-600">{footerText}</p>
              <p className="mt-6 text-sm text-neutral-500">(c) 2026 Basera. All rights reserved.</p>
            </div>
            <div className="flex flex-wrap gap-12 text-neutral-600">
              <div className="grid gap-3">
                <p className="font-semibold text-ink">Platform</p>
                <Link to="#" className="hover:text-ink">Privacy Policy</Link>
                <Link to="#" className="hover:text-ink">Terms of Service</Link>
              </div>
              <div className="grid gap-3">
                <p className="font-semibold text-ink">Support</p>
                <Link to="#" className="hover:text-ink">Help Center</Link>
                <Link to="#" className="hover:text-ink">Contact Us</Link>
              </div>
            </div>
          </div>
        </footer>
      </main>
      <MobileBottomNav />
    </div>
  );
}
