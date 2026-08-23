import { Outlet } from "react-router-dom";
import { BookOpenCheck, Bookmark, Compass, CreditCard, Grid2X2, LifeBuoy, MessageSquare, Newspaper, PackageCheck, User } from "lucide-react";
import { DashboardShell } from "../../components/DashboardShell";
import { useDocumentTitle } from "../../utils/useDocumentTitle";
import { useAuthStore } from "../../store/useAuthStore";
import { useLocaleStore } from "../../store/useLocaleStore";

// Labels are resolved via useLocaleStore's t() below so the Urdu/English toggle also
// covers the student dashboard's main nav, not just the public site.
const navItemDefs = [
  { key: "dashOverview", fallbackLabel: "Overview", icon: Grid2X2, to: "/dashboard/student" },
  { key: "dashBookings", fallbackLabel: "My Bookings", icon: BookOpenCheck, to: "/dashboard/student/bookings" },
  { key: "dashPayments", fallbackLabel: "Payments", icon: CreditCard, to: "/dashboard/student/payments" },
  { key: "dashSaved", fallbackLabel: "Saved Hostels", icon: Bookmark, to: "/dashboard/student/saved" },
  { key: "dashExplore", fallbackLabel: "Explore & Activities", icon: Compass, to: "/dashboard/student/engage" },
  { key: "dashServices", fallbackLabel: "Services", icon: PackageCheck, to: "/dashboard/student/services" },
  { key: "dashCommunity", fallbackLabel: "Community", icon: Newspaper, to: "/dashboard/student/community" },
  { key: "dashSupport", fallbackLabel: "Safety & Support", icon: LifeBuoy, to: "/dashboard/student/support" },
  { key: "dashChat", fallbackLabel: "Chat", icon: MessageSquare, to: "/dashboard/student/chat" },
  { key: "dashProfile", fallbackLabel: "Profile", icon: User, to: "/dashboard/student/profile" }
];

export function StudentDashboardLayout() {
  const authUser = useAuthStore((state) => state.user);
  const locale = useLocaleStore((state) => state.locale);
  const t = useLocaleStore((state) => state.t);
  useDocumentTitle("Student Dashboard | Basera");
  const user = {
    name: authUser?.name || "Ali Ahmed",
    role: authUser?.isVerified ? "Verified Student" : "Student",
    avatar: authUser?.avatar || "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80"
  };
  // Only swap the label when the translated string differs from a generic fallback so
  // items without a close dictionary match (e.g. "My Bookings") still read naturally.
  const navItems = navItemDefs.map((item) => ({ ...item, label: locale === "ur" ? t(item.key) : item.fallbackLabel }));

  return (
    <DashboardShell
      title={`Welcome back, ${user.name.split(" ")[0]}`}
      subtitle="Your bookings, payments, saved hostels and campus life — all in one place."
      navLabel="Student Hub"
      navItems={navItems}
      user={user}
      footerText="Making student living simple, secure, and accessible across the nation."
    >
      <Outlet />
    </DashboardShell>
  );
}
