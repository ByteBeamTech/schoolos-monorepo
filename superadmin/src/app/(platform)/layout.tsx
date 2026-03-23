import { ProtectedRoute }  from "@/components/protected-route";
import { PlatformLayout }  from "@/components/platform-layout";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <PlatformLayout>{children}</PlatformLayout>
    </ProtectedRoute>
  );
}
