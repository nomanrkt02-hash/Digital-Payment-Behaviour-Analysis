import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  LayoutDashboard,
  Users,
  ChartNoAxesCombined,
  Database,
  FileChartColumn,
  Settings,
  Menu,
  X,
  ChevronRight,
  Info,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { datasetSource, statusLabel, useData, useDataLoaded } from "./data";
import { BrandIcon, EmptyState } from "./components";
import { loadDemoData } from "./api";
const nav = [
  { path: "/overview", label: "Overview", icon: LayoutDashboard },
  { path: "/customers", label: "Customers", icon: Users },
  { path: "/insights", label: "Insights", icon: ChartNoAxesCombined },
  { path: "/transactions", label: "Data", icon: Database },
  { path: "/outreach", label: "Outreach", icon: Activity },
  { path: "/reports", label: "Reports", icon: FileChartColumn },
  { path: "/settings", label: "Settings", icon: Settings },
] as const;
export function AppShell({ children }: { children: ReactNode }) {
  const SAMPLE_DATA = useData();
  const DATA_LOADED = useDataLoaded();
  const [open, setOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [palette, setPalette] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const current = nav.find((n) => location.pathname.startsWith(n.path));
  const currentLabel =
    location.pathname.startsWith("/customers/") && location.pathname !== "/customers/"
      ? "Customer detail"
      : (current?.label ?? (location.pathname === "/settings" ? "Settings" : "Workspace"));
  const welcome = location.pathname === "/";
  const customers = DATA_LOADED ? SAMPLE_DATA.customers : [];
  const exploreDemo = async () => {
    setDemoLoading(true);
    setDemoError("");
    try {
      await loadDemoData();
      await navigate({ to: "/overview" });
    } catch (error) {
      setDemoError(error instanceof Error ? error.message : "Could not load demo data.");
    } finally {
      setDemoLoading(false);
    }
  };
  useEffect(() => {
    if (location.pathname === "/") {
      return;
    }
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPalette((value) => !value);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [location.pathname]);
  if (welcome) return <>{children}</>;
  return (
    <div className={`app-shell${collapsed ? " collapsed" : ""}`}>
      <aside className={`app-sidebar ${open ? "open" : ""}`}>
        <Link to="/overview" className="brand">
          <BrandIcon size={32} />
          <div className="brand-text">
            Payment Behaviour
            <br />
            Retention Analytics
          </div>
        </Link>
        <nav aria-label="Main navigation">
          <div className="nav-caption">Navigation</div>
          {nav.slice(0, 5).map((n) => (
            <Link
              key={n.path}
              to={n.path}
              className={`nav-link ${current === n ? "current" : ""}`}
              onClick={() => setOpen(false)}
              title={collapsed ? n.label : undefined}
            >
              <n.icon className="nav-icon" />
              <span>{n.label}</span>
            </Link>
          ))}
          <div className="nav-caption nav-caption-secondary">Tools</div>
          {nav.slice(5).map((n) => (
            <Link
              key={n.path}
              to={n.path}
              className={`nav-link ${current === n ? "current" : ""}`}
              onClick={() => setOpen(false)}
              title={collapsed ? n.label : undefined}
            >
              <n.icon className="nav-icon" />
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="dataset-box">
            <Database size={18} />
            <div>
              {DATA_LOADED ? datasetSource(SAMPLE_DATA.summary.data_label) : "No dataset connected"}
              <br />
              <span className="muted">
                {DATA_LOADED
                  ? `${Number(SAMPLE_DATA.summary.total_customers || 0).toLocaleString()} customers · ${Number(SAMPLE_DATA.summary.total_orders || 0).toLocaleString()} transactions`
                  : "Explore demo data or upload your own dataset"}
              </span>
            </div>
          </div>
          <Link to="/">
            Change dataset <ChevronRight size={13} className="inline" />
          </Link>
          {demoError && (
            <p className="welcome-error" role="alert">
              {demoError}
            </p>
          )}
          {!DATA_LOADED && (
            <Button className="mt-3 w-full" onClick={exploreDemo} disabled={demoLoading}>
              {demoLoading ? "Loading demo…" : "Explore Demo"}
            </Button>
          )}
          <Button
            variant="ghost"
            className="sidebar-collapse"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            <span>{collapsed ? "Expand" : "Collapse sidebar"}</span>
          </Button>
          <div className="sidebar-footer">30-day return analysis</div>
        </div>
      </aside>
      {open && <div className="drawer-backdrop" onClick={() => setOpen(false)} />}
      <div className="app-main">
        <header className="topbar">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="mobile-menu"
              aria-label={open ? "Close navigation" : "Open navigation"}
              onClick={() => setOpen(!open)}
            >
              {open ? <X /> : <Menu />}
            </Button>
            <div className="breadcrumb">
              Workspace <ChevronRight className="inline mx-3" size={13} />
              <b>{currentLabel}</b>
            </div>
          </div>
          <div className="top-actions">
            <Button variant="outline" className="workspace-search" onClick={() => setPalette(true)}>
              <Search size={15} />
              <span>Search customers or pages...</span>
              <kbd>Ctrl K</kbd>
            </Button>
            <Link to="/" className="home-nav-link" aria-label="Back to Home">
              ← Home
            </Link>
            {DATA_LOADED ? (
              <span
                className="sample-tag"
                title={SAMPLE_DATA.summary.data_label || "No dataset connected"}
              >
                {datasetSource(SAMPLE_DATA.summary.data_label)}
              </span>
            ) : (
              <span className="sample-tag dataset-status">No dataset connected</span>
            )}
            <Link to="/" className="change-dataset-link">
              Change dataset
            </Link>
            <Button
              variant="ghost"
              size="icon"
              aria-label={aboutOpen ? "Close analysis information" : "About this analysis"}
              title="About this analysis"
              onClick={() => setAboutOpen((value) => !value)}
            >
              <Info className="icon-plain" />
            </Button>
          </div>
        </header>
        {aboutOpen && (
          <div className="about-popover" role="status">
            <b>Analysis context</b>
            <span>
              Dataset: {DATA_LOADED ? SAMPLE_DATA.summary.data_label : "No dataset connected"}
            </span>
            <span>Model: {SAMPLE_DATA.model_info?.model_name || "Not available"}</span>
            <span>Return likelihood is an estimate for the next 30 days.</span>
          </div>
        )}
        <main className="page-content">
          {DATA_LOADED ? (
            children
          ) : (
            <section className="no-dataset-workspace">
              <EmptyState
                title="No dataset connected"
                message="Explore the synthetic demo or upload your own dataset to begin analysis."
                action={
                  <div className="flex justify-center gap-2">
                    <Button onClick={exploreDemo} disabled={demoLoading}>
                      {demoLoading ? "Loading demo…" : "Explore Demo"}
                    </Button>
                    <Button asChild variant="outline">
                      <Link to="/" search={{ upload: true }}>
                        Upload Dataset
                      </Link>
                    </Button>
                  </div>
                }
              />
            </section>
          )}
          <footer className="page-footer">
            <span>Digital Payment Behaviour Analysis</span>
            <span>
              {DATA_LOADED
                ? `${SAMPLE_DATA.summary.data_label || "Active dataset"} · Snapshot: ${SAMPLE_DATA.summary.snapshot_date || "—"}`
                : "No Dataset Connected"}
            </span>
          </footer>
        </main>
      </div>
      <Dialog open={palette} onOpenChange={setPalette}>
        <DialogContent className="command-palette">
          <DialogTitle className="sr-only">Search customers or pages</DialogTitle>
          <DialogDescription className="sr-only">
            Jump to a workspace page or active customer record.
          </DialogDescription>
          <Command>
            <CommandInput placeholder="Search customers or pages..." />
            <CommandList>
              <CommandEmpty>No matching page or customer.</CommandEmpty>
              <CommandGroup heading="Pages">
                {nav.map(({ path, label, icon: Icon }) => (
                  <CommandItem
                    key={path}
                    value={label}
                    onSelect={() => {
                      setPalette(false);
                      void navigate({ to: path });
                    }}
                  >
                    <Icon size={16} />
                    {label}
                    <ChevronRight className="ml-auto" size={14} />
                  </CommandItem>
                ))}
              </CommandGroup>
              {customers.length > 0 && (
                <CommandGroup heading="Customers">
                  {customers.map((customer) => (
                    <CommandItem
                      key={customer.customer_id}
                      value={`${customer.customer_id} ${statusLabel(customer.status)}`}
                      onSelect={() => {
                        setPalette(false);
                        void navigate({
                          to: "/customers/$customerId",
                          params: { customerId: customer.customer_id },
                        });
                      }}
                    >
                      <Users size={16} />
                      {customer.customer_id}
                      <span className="ml-auto">{statusLabel(customer.status)}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              <CommandGroup heading="Actions">
                <CommandItem
                  onSelect={() => {
                    setPalette(false);
                    void navigate({ to: "/outreach" });
                  }}
                >
                  <Activity size={16} />
                  Prepare outreach
                </CommandItem>
                <CommandItem
                  onSelect={() => {
                    setPalette(false);
                    void navigate({ to: "/" });
                  }}
                >
                  <Database size={16} />
                  Change dataset
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </div>
  );
}
export function PageHeading({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p className="subtitle">{subtitle}</p>
      </div>
      {children && <div className="heading-tools">{children}</div>}
    </div>
  );
}
export const pageMeta = (title: string, description: string) => ({
  meta: [
    { title: `${title} — Digital Payment Behaviour Analysis` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} — Digital Payment Behaviour Analysis` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ],
});
