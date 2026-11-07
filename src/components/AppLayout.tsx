import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  BookOpen,
  CalendarCheck,
  ClipboardList,
  GraduationCap,
  HardDrive,
  LayoutDashboard,
  Menu,
  School,
  ScrollText,
  Settings,
  Users,
  X,
  BarChart3,
  UserCog,
} from "lucide-react";
import { useSession } from "../lib/session";
import { useMeta } from "../lib/useMeta";
import { cn } from "../lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
  match?: string[];
}

const NAV: { title: string; items: NavItem[] }[] = [
  {
    title: "ទូទៅ",
    items: [
      { to: "/dashboard", label: "ផ្ទាំងគ្រប់គ្រង", icon: LayoutDashboard },
      { to: "/students", label: "សិស្សានុសិស្ស", icon: Users, match: ["/students", "/report-card", "/transcript"] },
    ],
  },
  {
    title: "ការសិក្សា",
    items: [
      { to: "/scores", label: "បញ្ចូលពិន្ទុ", icon: ClipboardList },
      { to: "/results", label: "លទ្ធផលសិក្សា", icon: BarChart3 },
      { to: "/attendance", label: "វត្តមាន", icon: CalendarCheck },
      { to: "/classes", label: "ថ្នាក់រៀន", icon: School },
      { to: "/subjects", label: "មុខវិជ្ជា", icon: BookOpen },
    ],
  },
  {
    title: "រដ្ឋបាល",
    items: [
      { to: "/teachers", label: "គ្រូបង្រៀន", icon: UserCog, adminOnly: true },
      { to: "/settings", label: "ការកំណត់", icon: Settings, adminOnly: true },
      { to: "/audit", label: "កំណត់ត្រាប្រព័ន្ធ", icon: ScrollText, adminOnly: true },
    ],
  },
];

const TITLES: Record<string, { title: string; crumb: string }> = {
  "/dashboard": { title: "ផ្ទាំងគ្រប់គ្រង", crumb: "ទូទៅ" },
  "/students": { title: "សិស្សានុសិស្ស", crumb: "ទូទៅ" },
  "/scores": { title: "បញ្ចូលពិន្ទុ", crumb: "ការសិក្សា" },
  "/results": { title: "លទ្ធផលសិក្សា", crumb: "ការសិក្សា" },
  "/attendance": { title: "វត្តមានសិស្ស", crumb: "ការសិក្សា" },
  "/classes": { title: "ថ្នាក់រៀន", crumb: "ការសិក្សា" },
  "/subjects": { title: "មុខវិជ្ជា", crumb: "ការសិក្សា" },
  "/teachers": { title: "គ្រូបង្រៀន", crumb: "រដ្ឋបាល" },
  "/settings": { title: "ការកំណត់ប្រព័ន្ធ", crumb: "រដ្ឋបាល" },
  "/audit": { title: "កំណត់ត្រាប្រព័ន្ធ", crumb: "រដ្ឋបាល" },
};

export function AppLayout({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const { data: meta } = useMeta();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const meta0 = location.pathname.startsWith("/students/")
    ? { title: "ព័ត៌មានលម្អិតសិស្ស", crumb: "ទូទៅ" }
    : location.pathname.startsWith("/report-card")
      ? { title: "សៀវភៅពិន្ទុសិស្ស", crumb: "របាយការណ៍" }
      : location.pathname.startsWith("/transcript")
        ? { title: "សញ្ញាបត្រសិក្សា", crumb: "របាយការណ៍" }
        : undefined;
  const page = TITLES[location.pathname] ?? meta0 ?? { title: "ប្រព័ន្ធគ្រប់គ្រងពិន្ទុសិស្ស", crumb: "" };

  const nav = (
    <div className="flex h-full flex-col bg-ink-950 text-white">
      <div className="flex items-center gap-3 px-5 pb-5 pt-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-sky-400 text-lg font-bold shadow-lg shadow-brand-900/40">
          ក
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold leading-tight">គ្រប់គ្រងពិន្ទុសិស្ស</p>
          <p className="truncate text-[11px] text-ink-400">KrobKrorng Pontuk Sers</p>
        </div>
        <button
          className="ml-auto rounded-lg p-1 text-ink-400 hover:bg-white/10 hover:text-white lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="បិទម៉ឺនុយ"
        >
          <X size={18} />
        </button>
      </div>

      <div className="mx-4 mb-4 rounded-xl border border-white/10 bg-white/5 p-3">
        <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-ink-400">
          <GraduationCap size={12} /> ឆ្នាំសិក្សាបច្ចុប្បន្ន
        </p>
        <p className="mt-1 truncate text-[13px] font-semibold text-white">
          {meta?.settings?.academic_year_id
            ? meta.years.find((y) => y.id === meta.settings.academic_year_id)?.name ?? "—"
            : "—"}
        </p>
      </div>

      <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {NAV.map((group) => {
          const items = group.items.filter((i) => !i.adminOnly || user?.role === "admin");
          if (!items.length) return null;
          return (
            <div key={group.title}>
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        "nav-link",
                        (isActive || item.match?.some((m) => location.pathname.startsWith(m))) &&
                          "nav-link-active",
                      )
                    }
                  >
                    <item.icon size={17} className="shrink-0 opacity-90" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2.5 rounded-xl px-2 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-ink-200">
            <HardDrive size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-medium text-white">ទិន្នន័យក្នុងឧបករណ៍</p>
            <p className="truncate text-[10.5px] text-ink-400">មិនត្រូវការចូលគណនី</p>
          </div>
        </div>
        <p className="px-2 pb-1 text-center text-[9.5px] leading-relaxed text-ink-600">
          © {new Date().getFullYear()} វណ្ណា វណ្ណឆៃ · រក្សាសិទ្ធិគ្រប់យ៉ាង
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-ink-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] lg:block no-print">{nav}</aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden no-print">
          <div className="absolute inset-0 bg-ink-950/50 animate-fade-in" onClick={() => setMobileOpen(false)} />
          <div className="relative h-full w-[268px] shadow-pop animate-slide-in">{nav}</div>
        </div>
      ) : null}

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-30 border-b border-ink-200/80 bg-white/85 backdrop-blur-md no-print">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              className="btn-icon lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="បើកម៉ឺនុយ"
            >
              <Menu size={20} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] text-ink-400">
                <span>{page.crumb}</span>
                <span className="text-ink-300">/</span>
                <span className="font-medium text-ink-500">{page.title}</span>
              </div>
              <h1 className="truncate text-[17px] font-semibold leading-tight text-ink-950">
                {page.title}
              </h1>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-600 md:flex">
                <CalendarCheck size={14} className="text-brand-500" />
                <span className="max-w-[190px] truncate">
                  {meta?.settings
                    ? `${meta.years.find((y) => y.id === meta.settings.academic_year_id)?.name ?? ""} · ${
                        meta.terms.find((t) => t.id === meta.settings.term_id)?.name ?? ""
                      }`
                    : "កំពុងផ្ទុក…"}
                </span>
              </div>
              <div className="hidden items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-medium text-emerald-700 sm:flex">
                <HardDrive size={13} />
                <span>ទិន្នន័យរក្សាទុកក្នុងឧបករណ៍</span>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 sm:py-6">{children}</main>

        <footer className="mx-auto mt-4 max-w-[1600px] px-4 pb-8 text-center text-[11px] leading-relaxed text-ink-400 no-print sm:px-6">
          <p>
            {meta?.settings.school_name ? `${meta.settings.school_name} · ` : ""}
            ប្រព័ន្ធគ្រប់គ្រងពិន្ទុសិស្ស v1.0
          </p>
          <p className="mt-1">
            © {new Date().getFullYear()} រក្សាសិទ្ធិគ្រប់យ៉ាងដោយ{" "}
            <span className="font-semibold text-ink-600">វណ្ណា វណ្ណឆៃ</span>
          </p>
        </footer>
      </div>
    </div>
  );
}
