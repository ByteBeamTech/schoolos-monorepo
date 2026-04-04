"use client";
import { useRouter, usePathname } from "next/navigation";
import { ArrowLeft, X, ChevronRight } from "lucide-react";
import { Button } from "./button";
import Link from "next/link";
import { Fragment } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  showBack?: boolean;
  showClose?: boolean;
  onCloseHref?: string;
}

export function PageHeader({ 
  title, subtitle, description, icon, action, 
  showBack = true, showClose = false, onCloseHref 
}: PageHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sub = subtitle ?? description;

  // ── Breadcrumb Logic: URL को तोड़कर पाथ बनाना ─────────────────────
  const pathSegments = pathname.split("/").filter((v) => v.length > 0);
  //  - (people), (learning) जैसे फोल्डर्स को इग्नोर करना
  const crumbs = pathSegments.filter(segment => !segment.startsWith('('));

  return (
    <div className="mb-8 w-full">
      {/* ── Breadcrumbs Row ── */}
      <nav className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-3 px-1">
        {crumbs.map((crumb, i) => {
          const href = `/${crumbs.slice(0, i + 1).join("/")}`;
          const isLast = i === crumbs.length - 1;
          const label = crumb.charAt(0).toUpperCase() + crumb.slice(1).replace(/-/g, ' ');

          return (
            <Fragment key={i}>
              {i > 0 && <ChevronRight className="w-3 h-3 text-slate-300" />}
              {isLast ? (
                <span className="text-blue-600 font-semibold">{label}</span>
              ) : (
                <Link href={href} className="hover:text-slate-600 transition-colors capitalize">
                  {label}
                </Link>
              )}
            </Fragment>
          );
        })}
      </nav>

      {/* ── Main Header Row ── */}
      <div className="flex items-start justify-between pb-4 border-b border-slate-100/50">
        <div className="flex items-center gap-4">
          {showBack && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => router.back()}
              className="h-9 w-9 hover:bg-slate-100 rounded-full flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5 text-slate-500" />
            </Button>
          )}

          <div className="flex items-center gap-3">
            {icon && <div className="text-slate-400 flex-shrink-0">{icon}</div>}
            <div>
              <h1 className="page-title">{title}</h1>
              {sub && <p className="page-subtitle">{sub}</p>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {action && <div>{action}</div>}
          {showClose && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onCloseHref ? router.push(onCloseHref) : router.back()}
              className="h-9 w-9 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full"
            >
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
