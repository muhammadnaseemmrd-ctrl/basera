import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { PublicLayout } from "./components/PublicLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ToastProvider } from "./components/ui";
import { useAppStore } from "./store/useAppStore";

const lazyPage = (loader, exportName) => lazy(() => loader().then((module) => ({ default: module[exportName] })));

const HomePage = lazyPage(() => import("./pages/HomePage"), "HomePage");
const ListingsPage = lazyPage(() => import("./pages/ListingsPage"), "ListingsPage");
const RoomsMarketPage = lazyPage(() => import("./pages/RoomsMarketPage"), "RoomsMarketPage");
const RoomDetailPage = lazyPage(() => import("./pages/RoomDetailPage"), "RoomDetailPage");
const HostelDetailPage = lazyPage(() => import("./pages/HostelDetailPage"), "HostelDetailPage");
const HostelGroupPage = lazyPage(() => import("./pages/HostelGroupPage"), "HostelGroupPage");
const CityComparisonPage = lazyPage(() => import("./pages/CityComparisonPage"), "CityComparisonPage");
const BookingPage = lazyPage(() => import("./pages/BookingPage"), "BookingPage");
const StudentDashboardLayout = lazyPage(() => import("./pages/student/StudentDashboardLayout"), "StudentDashboardLayout");
const StudentOverview = lazyPage(() => import("./pages/student/StudentOverview"), "StudentOverview");
const StudentBookings = lazyPage(() => import("./pages/student/StudentBookings"), "StudentBookings");
const StudentPayments = lazyPage(() => import("./pages/student/StudentPayments"), "StudentPayments");
const StudentSaved = lazyPage(() => import("./pages/student/StudentSaved"), "StudentSaved");
const StudentEngagement = lazyPage(() => import("./pages/student/StudentEngagement"), "StudentEngagement");
const StudentCommunity = lazyPage(() => import("./pages/student/StudentCommunity"), "StudentCommunity");
const StudentSupport = lazyPage(() => import("./pages/student/StudentSupport"), "StudentSupport");
const StudentProfile = lazyPage(() => import("./pages/student/StudentProfile"), "StudentProfile");
const StudentChat = lazyPage(() => import("./pages/student/StudentChat"), "StudentChat");
const StudentServices = lazyPage(() => import("./pages/student/StudentServices"), "StudentServices");
const OwnerDashboard = lazyPage(() => import("./pages/OwnerDashboard"), "OwnerDashboard");
const LandlordDashboard = lazyPage(() => import("./pages/LandlordDashboard"), "LandlordDashboard");
const ListerOnboardingPage = lazyPage(() => import("./pages/ListerOnboardingPage"), "ListerOnboardingPage");
const AdminDashboard = lazyPage(() => import("./pages/AdminDashboard"), "AdminDashboard");
const AuthPage = lazyPage(() => import("./pages/AuthPage"), "AuthPage");
const StaticPage = lazyPage(() => import("./pages/StaticPage"), "StaticPage");
const ReceiptVerifyPage = lazyPage(() => import("./pages/ReceiptVerifyPage"), "ReceiptVerifyPage");
const ParentPortalPage = lazyPage(() => import("./pages/ParentPortalPage"), "ParentPortalPage");
const LiveRoomBoardPage = lazyPage(() => import("./pages/LiveRoomBoardPage"), "LiveRoomBoardPage");
const WardenDashboard = lazyPage(() => import("./pages/WardenDashboard"), "WardenDashboard");
const StaysSearchPage = lazyPage(() => import("./pages/StaysSearchPage"), "StaysSearchPage");
const StayDetailPage = lazyPage(() => import("./pages/StayDetailPage"), "StayDetailPage");
const StayBookingsPage = lazyPage(() => import("./pages/StayBookingsPage"), "StayBookingsPage");
const StayManagerPage = lazyPage(() => import("./pages/host/StayManagerPage"), "StayManagerPage");

function RouteFallback() {
  return (
    <main className="container-page grid min-h-[60vh] place-items-center py-16">
      <div className="panel w-full max-w-md p-8 text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-primary-800">Basera</p>
        <p className="mt-3 text-slate-700">Loading screen...</p>
      </div>
    </main>
  );
}

export default function App() {
  const theme = useAppStore((state) => state.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <BrowserRouter>
      <ToastProvider>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/hostels" element={<ListingsPage />} />
            <Route path="/rooms" element={<RoomsMarketPage />} />
            <Route path="/rooms/:id" element={<RoomDetailPage />} />
            <Route path="/hostels/:slug/live-board" element={<LiveRoomBoardPage />} />
            <Route path="/hostels/:slug" element={<HostelDetailPage />} />
            <Route path="/hostel-groups/:slug" element={<HostelGroupPage />} />
            <Route path="/compare-cities" element={<CityComparisonPage />} />
            <Route path="/booking" element={<BookingPage />} />
            <Route path="/stays" element={<StaysSearchPage />} />
            <Route path="/stays/:id" element={<StayDetailPage />} />
            <Route path="/login" element={<AuthPage />} />
            <Route path="/landlord/onboarding" element={<ListerOnboardingPage />} />
            <Route path="/verify/:receiptId" element={<ReceiptVerifyPage />} />
            <Route path="/parent/:token" element={<ParentPortalPage />} />
            <Route path="/about" element={<StaticPage title="About Us" />} />
            <Route path="/contact" element={<StaticPage title="Contact Us" />} />
          </Route>

          <Route
            path="/dashboard/student"
            element={
              <ProtectedRoute roles={["student", "admin"]}>
                <StudentDashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<StudentOverview />} />
            <Route path="bookings" element={<StudentBookings />} />
            <Route path="payments" element={<StudentPayments />} />
            <Route path="saved" element={<StudentSaved />} />
            <Route path="engage" element={<StudentEngagement />} />
            <Route path="services" element={<StudentServices />} />
            <Route path="community" element={<StudentCommunity />} />
            <Route path="support" element={<StudentSupport />} />
            <Route path="chat" element={<StudentChat />} />
            <Route path="profile" element={<StudentProfile />} />
          </Route>
          <Route
            path="/owner/dashboard"
            element={
              <ProtectedRoute roles={["owner", "admin"]}>
                <OwnerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/host/dashboard"
            element={
              <ProtectedRoute roles={["host", "admin"]}>
                <LandlordDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/landlord/dashboard"
            element={
              <ProtectedRoute roles={["host", "admin"]}>
                <LandlordDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={["admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/warden/dashboard"
            element={
              <ProtectedRoute roles={["warden", "host", "admin"]}>
                <WardenDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/stays"
            element={
              <ProtectedRoute roles={["student", "host", "admin"]}>
                <StayBookingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/host/stays"
            element={
              <ProtectedRoute roles={["host", "admin"]}>
                <StayManagerPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      </ToastProvider>
    </BrowserRouter>
  );
}
