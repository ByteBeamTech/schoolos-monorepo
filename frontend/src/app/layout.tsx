import "./globals.css";
import { Providers }     from "./providers";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster }       from "sonner";

export const metadata = {
  title: "SchoolOS — School Management Platform",
  description: "Complete school ERP system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <Providers>{children}</Providers>
        </ThemeProvider>
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{ duration: 4000 }}
        />
      </body>
    </html>
  );
}
