import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import OwnerLayout from "./components/OwnerLayout";
import OwnerProtectedRoute from "./components/OwnerProtectedRoute";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import { OwnerAuthProvider } from "./context/OwnerAuthContext";

import Login from "./pages/Login/Login";
import Signup from "./pages/Signup/Signup";
import RoleSelect from "./pages/RoleSelect/RoleSelect";
import Dashboard from "./pages/Dashboard/Dashboard";
import FindParking from "./pages/FindParking/FindParking";
import ParkingDetails from "./pages/ParkingDetails/ParkingDetails";
import NavigationPage from "./pages/Navigation/Navigation";
import Booking from "./pages/Booking/Booking";
import BookingSuccess from "./pages/BookingSuccess/BookingSuccess";
import MyBookings from "./pages/MyBookings/MyBookings";
import FindMyCar from "./pages/FindMyCar/FindMyCar";
import ParkingArrival3D from "./pages/ParkingArrival3D/ParkingArrival3D";
import Profile from "./pages/Profile/Profile";
import Notifications from "./pages/Notifications/Notifications";
import HelpSupport from "./pages/HelpSupport";

import OwnerLogin from "./pages/OwnerLogin/OwnerLogin";
import OwnerSignup from "./pages/OwnerSignup/OwnerSignup";
import OwnerDashboard from "./pages/OwnerDashboard/OwnerDashboard";
import OwnerParkingList from "./pages/OwnerParkingList/OwnerParkingList";
import OwnerParkingForm from "./pages/OwnerParkingForm/OwnerParkingForm";
import OwnerCsvImport from "./pages/OwnerCsvImport/OwnerCsvImport";
import OwnerProfile from "./pages/OwnerProfile/OwnerProfile";
import OwnerBookings from "./pages/OwnerBookings/OwnerBookings";
import OwnerPayments from "./pages/OwnerPayments/OwnerPayments";
import OwnerReports from "./pages/OwnerReports/OwnerReports";
import OwnerNotifications from "./pages/OwnerNotifications/OwnerNotifications";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <OwnerAuthProvider>
          <Routes>
            <Route path="/" element={<RoleSelect />} />

            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            <Route element={<AppLayout />}>
              <Route path="/app" element={<Dashboard />} />
              <Route path="/parking/:id" element={<ParkingDetails />} />
              <Route path="/help" element={<HelpSupport />} />

              <Route
                path="/find-parking"
                element={
                  <ProtectedRoute>
                    <FindParking />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/navigation"
                element={
                  <ProtectedRoute>
                    <NavigationPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/book/:locationId"
                element={
                  <ProtectedRoute>
                    <Booking />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/booking-success/:bookingId"
                element={
                  <ProtectedRoute>
                    <BookingSuccess />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-bookings"
                element={
                  <ProtectedRoute>
                    <MyBookings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/find-my-car"
                element={
                  <ProtectedRoute>
                    <FindMyCar />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/parking-arrival/:bookingId"
                element={
                  <ProtectedRoute>
                    <ParkingArrival3D />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/notifications"
                element={
                  <ProtectedRoute>
                    <Notifications />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route path="/owner/login" element={<OwnerLogin />} />
            <Route path="/owner/signup" element={<OwnerSignup />} />

            <Route element={<OwnerLayout />}>
              <Route
                path="/owner/dashboard"
                element={
                  <OwnerProtectedRoute>
                    <OwnerDashboard />
                  </OwnerProtectedRoute>
                }
              />
              <Route
                path="/owner/parking"
                element={
                  <OwnerProtectedRoute>
                    <OwnerParkingList />
                  </OwnerProtectedRoute>
                }
              />
              <Route
                path="/owner/parking/new"
                element={
                  <OwnerProtectedRoute>
                    <OwnerParkingForm />
                  </OwnerProtectedRoute>
                }
              />
              <Route
                path="/owner/parking/:id/edit"
                element={
                  <OwnerProtectedRoute>
                    <OwnerParkingForm />
                  </OwnerProtectedRoute>
                }
              />
              <Route
                path="/owner/parking/import"
                element={
                  <OwnerProtectedRoute>
                    <OwnerCsvImport />
                  </OwnerProtectedRoute>
                }
              />
              <Route
                path="/owner/bookings"
                element={
                  <OwnerProtectedRoute>
                    <OwnerBookings />
                  </OwnerProtectedRoute>
                }
              />
              <Route
                path="/owner/payments"
                element={
                  <OwnerProtectedRoute>
                    <OwnerPayments />
                  </OwnerProtectedRoute>
                }
              />
              <Route
                path="/owner/reports"
                element={
                  <OwnerProtectedRoute>
                    <OwnerReports />
                  </OwnerProtectedRoute>
                }
              />
              <Route
                path="/owner/notifications"
                element={
                  <OwnerProtectedRoute>
                    <OwnerNotifications />
                  </OwnerProtectedRoute>
                }
              />
              <Route
                path="/owner/profile"
                element={
                  <OwnerProtectedRoute>
                    <OwnerProfile />
                  </OwnerProtectedRoute>
                }
              />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </OwnerAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
