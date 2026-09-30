import { useApp } from '../app/context';
import { ServiceBookingsDashboard } from '../features/bookings/ServiceBookingsDashboard';

export default function ServiceBookingsPage() {
  const { user, setShowLogin, showToast } = useApp();
  return <ServiceBookingsDashboard user={user} onLoginNeeded={() => setShowLogin(true)} showToast={showToast} />;
}
