import React, { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CircleAlert, Info, ShieldAlert, Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { statusClass, statusLabel } from "./data";

/**
 * Custom SVG brand mark for Digital Payment Behaviour Analysis.
 */
export function BrandIcon({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Digital Payment Behaviour Analysis"
    >
      <rect width="32" height="32" rx="8" fill="#155E63" />
      <rect x="7.5" y="8.5" width="17" height="15" rx="2.5" stroke="#FFFFFF" strokeWidth="1.8" />
      <path d="M8.5 13H23.5M11 19H14" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="20" cy="19" r="1.5" fill="#8FBFB4" />
    </svg>
  );
}

/**
 * Shared StatusBadge component strictly following the design system:
 * - At Risk: text #B42318, bg #FDECEC, border #F2C9C6
 * - Active / Normal: text #8A5A00, bg #FFF4D6, border #EBD8A5
 * - Loyal / High Value: text #216E4E, bg #E8F5EE, border #C4E5D1
 * - Not Scored: text #52606A, bg #EDF0F2, border #D7DDE0
 */
export function StatusBadge({
  status,
  size = "md",
  className = "",
}: {
  status: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const cls = statusClass(status);
  const glyph = cls === "risk" ? "▼" : cls === "active" ? "◐" : cls === "loyal" ? "◉" : "○";
  const label = statusLabel(status);
  const sizeClasses = size === "sm" ? "text-[11px] px-2 py-0.5" : "text-[12px] px-2.5 py-1";

  return (
    <span className={`status-badge ${cls} ${sizeClasses} ${className}`} role="status">
      <span aria-hidden="true" className="badge-glyph">
        {glyph}
      </span>
      <span>{label}</span>
    </span>
  );
}

/**
 * Shared PageHeader component with consistent title, subtitle, and action controls.
 */
export function PageHeader({
  title,
  subtitle,
  children,
  badge,
}: {
  title: string;
  subtitle: string;
  children?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="flex items-center gap-3">
          <h1>{title}</h1>
          {badge}
        </div>
        <p className="subtitle">{subtitle}</p>
      </div>
      {children && <div className="heading-tools">{children}</div>}
    </div>
  );
}

/**
 * Shared accessible HelpTooltip with 400ms hover/focus delay.
 * Never hides critical information; used strictly for secondary definitions.
 */
export function HelpTooltip({ content, children }: { content: ReactNode; children?: ReactNode }) {
  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>
          {children ? (
            <span className="inline-flex items-center cursor-help">{children}</span>
          ) : (
            <button
              type="button"
              className="inline-flex items-center justify-center p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary rounded-sm transition-colors cursor-help"
              aria-label="More information"
            >
              <Info size={14} />
            </button>
          )}
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs text-xs bg-[#182A2C] text-[#FFFFFF] border border-[#2B4242] shadow-md p-2.5 rounded-lg z-50"
        >
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Shared KPI Card component.
 * Displays major metric in Manrope font, clear label, and supporting context note.
 */
export function KpiCard({
  label,
  value,
  note,
  icon: Icon,
  kind = "neutral",
  tooltip,
}: {
  label: string;
  value: string | number;
  note: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  kind?: "risk" | "active" | "loyal" | "neutral" | "";
  tooltip?: ReactNode;
}) {
  return (
    <section className="panel kpi" role="region" aria-label={label}>
      <div className="kpi-top">
        <div className="flex items-center gap-1.5">
          <span className="kpi-label">{label}</span>
          {tooltip && <HelpTooltip content={tooltip} />}
        </div>
        {Icon && (
          <span className={`kpi-icon ${kind}`}>
            <Icon size={17} />
          </span>
        )}
      </div>
      <div className="big-number mt-2">{value}</div>
      <p className="kpi-description">{note}</p>
    </section>
  );
}

/**
 * Primary Button with consistent SaaS styling (#155E63).
 */
export function PrimaryButton({
  children,
  onClick,
  disabled = false,
  className = "",
  size = "md",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses =
    size === "sm"
      ? "px-3 py-1.5 text-xs"
      : size === "lg"
        ? "px-5 py-2.5 text-base"
        : "px-4 py-2 text-sm";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`btn-primary ${sizeClasses} ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * Secondary Button with subtle surface and clean border.
 */
export function SecondaryButton({
  children,
  onClick,
  disabled = false,
  className = "",
  size = "md",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses =
    size === "sm"
      ? "px-3 py-1.5 text-xs"
      : size === "lg"
        ? "px-5 py-2.5 text-base"
        : "px-4 py-2 text-sm";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`btn-secondary ${sizeClasses} ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * Shared Loading State component without fake loading percentages.
 */
export function LoadingState({
  title = "Loading customer analysis…",
  message = "Checking for active dataset and preparing customer predictions.",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <section className="panel loading-state stitch-global-loading" role="status" aria-live="polite">
      <span className="loading-indicator" />
      <div>
        <b>{title}</b>
        <p className="muted">{message}</p>
      </div>
    </section>
  );
}

/**
 * Shared Empty State component.
 */
export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="panel empty-state stitch-global-empty text-center p-8">
      <span className="stitch-empty-icon" aria-hidden="true">
        <Info size={20} />
      </span>
      <h3>{title}</h3>
      <p className="muted mt-2 max-w-md mx-auto">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function GlobalErrorState({
  title = "Something went wrong",
  message,
  action,
}: {
  title?: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <section className="stitch-global-error" role="alert">
      <span className="stitch-error-icon" aria-hidden="true">
        <CircleAlert size={18} />
      </span>
      <div>
        <b>{title}</b>
        <p>{message}</p>
        {action && <div className="stitch-error-action">{action}</div>}
      </div>
    </section>
  );
}

/**
 * Shared TableContainer component ensuring horizontal scrolling is strictly
 * contained within the table and never overflows the page.
 */
export function TableContainer({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`table-panel ${className}`}>
      <div className="table-scroll">{children}</div>
    </div>
  );
}

/**
 * Shared At-Risk Spotlight component:
 * Highlights high-priority at-risk customer intelligence with immediate action.
 * Explicitly states: "Suggestion only — nothing has been sent."
 */
export function AtRiskSpotlight({
  customerId,
  likelihoodPct,
  daysPastUsual,
  orderGapLabel,
  actionLabel = "WIN-BACK RECOMMENDED",
}: {
  customerId: string;
  likelihoodPct: number | null;
  daysPastUsual: number;
  orderGapLabel: string;
  actionLabel?: string;
}) {
  return (
    <div className="at-risk-spotlight" role="region" aria-label="At-Risk Customer Spotlight">
      <div className="spotlight-header">
        <div className="flex items-center gap-2">
          <ShieldAlert size={16} className="text-[#B42318]" />
          <span className="spotlight-tag">RETENTION INTELLIGENCE</span>
        </div>
        <StatusBadge status="At Risk" size="sm" />
      </div>

      <div className="spotlight-body">
        <div className="spotlight-customer">
          <strong>Customer {customerId}</strong>
          <span className="spotlight-gap">{orderGapLabel}</span>
        </div>

        <div className="spotlight-metrics">
          <div className="spotlight-metric">
            <span className="metric-val">{likelihoodPct != null ? `${likelihoodPct}%` : "—"}</span>
            <span className="metric-label">30-day return likelihood</span>
          </div>
          <div className="spotlight-metric">
            <span className="metric-val text-[#B42318]">
              {daysPastUsual > 0 ? `${daysPastUsual} days` : "Current gap"}
            </span>
            <span className="metric-label">
              {daysPastUsual > 0 ? "past usual interval" : "within usual window"}
            </span>
          </div>
        </div>

        <div className="spotlight-action-row">
          <div className="spotlight-recommendation">
            <Sparkles size={14} className="text-[#155E63]" />
            <span>{actionLabel}</span>
          </div>
          <Link to="/customers/$customerId" params={{ customerId }} className="spotlight-btn">
            Review customer <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      <div className="spotlight-disclaimer">Suggestion only — nothing has been sent.</div>
    </div>
  );
}
