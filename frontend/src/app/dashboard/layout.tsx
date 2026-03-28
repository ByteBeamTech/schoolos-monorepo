import { ProtectedRoute }   from "@/components/protected-route";
import { DashboardLayout }  from "@/components/dashboard-layout";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <DashboardLayout>{children}</DashboardLayout>
    </ProtectedRoute>
  );
}
