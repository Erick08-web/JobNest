"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  ChevronLeft,
  ClipboardList,
  CreditCard,
  FileText,
  Home,
  LayoutDashboard,
  Menu,
  Search,
  ShieldCheck,
  Store,
  UserRound,
  UsersRound,
  X,
  type LucideIcon
} from "lucide-react";

type Icon = LucideIcon | ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;

const navGroups: { label: string; items: { label: string; href: string; icon: Icon; disabled?: boolean }[] }[] = [
  {
    label: "Operación",
    items: [
      { label: "Inicio", href: "/admin", icon: LayoutDashboard },
      { label: "Publicaciones", href: "/admin/publicaciones", icon: ClipboardList },
      { label: "Quejas", href: "/admin/quejas", icon: AlertTriangle },
      { label: "Usuarios", href: "/admin/usuarios", icon: UsersRound }
    ]
  },
  {
    label: "Seguimiento",
    items: [
      { label: "Solicitudes", href: "/admin/solicitudes", icon: BriefcaseBusiness },
      { label: "Pagos", href: "/admin/pagos", icon: CreditCard },
      { label: "Bitácora", href: "/admin/bitacora", icon: FileText }
    ]
  },
  {
    label: "Sistema",
    items: [
      { label: "Cuenta", href: "/admin/cuenta", icon: UserRound },
      { label: "Marketplace", href: "/buscar", icon: Store },
      { label: "Analítica", href: "/admin/analitica", icon: BarChart3 }
    ]
  }
];

export function formatAdminMoney(value?: number | null) {
  if (value === null || value === undefined) return "Sin monto";
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(value);
}

export function formatAdminDate(value?: string | null, compact = false) {
  if (!value) return "Sin registro";
  const raw = value.trim();
  const legacy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
  const isoDateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  let date: Date;

  if (legacy) {
    const [, day, month, year, hour, minute] = legacy;
    date = hour
      ? new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)))
      : new Date(Number(year), Number(month) - 1, Number(day), 12, 0);
  } else if (isoDateOnly) {
    const [, year, month, day] = isoDateOnly;
    date = new Date(Number(year), Number(month) - 1, Number(day), 12, 0);
  } else {
    const hasExplicitZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(raw);
    const normalized = hasExplicitZone || !raw.includes("T") ? raw : `${raw}Z`;
    date = new Date(normalized);
  }

  if (Number.isNaN(date.getTime())) return "Sin registro";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: compact ? "medium" : "long",
    timeStyle: compact ? "short" : "short",
    timeZone: "America/Mexico_City"
  }).format(date);
}

export function humanizeAdminText(value?: string | null) {
  if (!value) return "Sin dato";
  return value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

export function statusTone(value?: string | boolean | null) {
  if (typeof value === "boolean") return value ? "success" : "danger";
  const normalized = (value || "").toLowerCase();
  if (["activa", "activo", "aprobada", "completado", "resuelta", "aceptada", "pagado"].some((term) => normalized.includes(term))) return "success";
  if (["pendiente", "revision", "revisión", "nueva", "en_revision"].some((term) => normalized.includes(term))) return "warning";
  if (["rechazada", "rechazado", "suspendida", "cancelado", "fallido", "inactiva", "inactivo"].some((term) => normalized.includes(term))) return "danger";
  if (["oculta", "correcciones", "reembolsado"].some((term) => normalized.includes(term))) return "info";
  return "neutral";
}

export function AdminShell({ children, title, description, userName, actions }: { children: ReactNode; title: string; description?: string; userName?: string; actions?: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const initials = useMemo(() => (userName || "Admin").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "AD", [userName]);

  return (
    <main className={`adminShell ${collapsed ? "isCollapsed" : ""}`}>
      <aside className={`adminSidebar ${mobileOpen ? "isOpen" : ""}`} aria-label="Navegación administrativa">
        <div className="adminBrand">
          <span aria-hidden="true">JN</span>
          <strong>Admin</strong>
          <button type="button" className="adminIconButton adminMobileClose" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú"><X size={18} /></button>
        </div>
        <nav className="adminNav">
          {navGroups.map((group) => (
            <section key={group.label} aria-label={group.label}>
              <p>{group.label}</p>
              {group.items.map((item) => {
                const active = item.href !== "#" && (pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href)));
                const IconComponent = item.icon;
                if (item.disabled) {
                  return (
                    <button className="adminNavItem isDisabled" type="button" disabled key={item.label} title={`${item.label} estará disponible después`}>
                      <IconComponent size={18} /><span>{item.label}</span>
                    </button>
                  );
                }
                return (
                  <Link className={`adminNavItem ${active ? "isActive" : ""}`} href={item.href} key={item.href} aria-current={active ? "page" : undefined} title={item.label} onClick={() => setMobileOpen(false)}>
                    <IconComponent size={18} /><span>{item.label}</span>
                  </Link>
                );
              })}
            </section>
          ))}
        </nav>
        <div className="adminSidebarFooter">
          <Link href="/" className="adminNavItem"><Home size={18} /><span>Sitio público</span></Link>
          <button type="button" className="adminCollapseButton" onClick={() => setCollapsed((value) => !value)} aria-pressed={collapsed} aria-label={collapsed ? "Expandir menú" : "Contraer menú"}>
            <ChevronLeft size={18} /><span>{collapsed ? "Expandir" : "Contraer"}</span>
          </button>
        </div>
      </aside>
      {mobileOpen ? <button className="adminOverlay" type="button" aria-label="Cerrar menú" onClick={() => setMobileOpen(false)} /> : null}
      <section className="adminWorkspace">
        <header className="adminTopbar">
          <div>
            <button type="button" className="adminIconButton adminMenuButton" onClick={() => setMobileOpen(true)} aria-label="Abrir menú"><Menu size={20} /></button>
            <div>
              <span>Panel administrativo</span>
              <h1>{title}</h1>
              {description ? <p>{description}</p> : null}
            </div>
          </div>
          <div className="adminTopbarActions">
            {actions}
            <span className="adminHealthPill"><ShieldCheck size={15} /> Operativo</span>
            <Link href="/cuenta" className="adminAvatar" aria-label="Cuenta del administrador"><span>{initials}</span></Link>
          </div>
        </header>
        <div className="adminContent">{children}</div>
      </section>
    </main>
  );
}

export function AdminPageHeader({ eyebrow, title, description, icon: IconComponent = ShieldCheck, actions }: { eyebrow: string; title: string; description: string; icon?: Icon; actions?: ReactNode }) {
  return (
    <section className="adminPageHeader">
      <div className="adminHeaderIcon"><IconComponent size={24} /></div>
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {actions ? <div className="adminHeaderActions">{actions}</div> : null}
    </section>
  );
}

export function AdminButton({ children, tone = "neutral", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "primary" | "neutral" | "danger" | "success" }) {
  return <button {...props} className={`adminButton ${tone} ${props.className ?? ""}`}>{children}</button>;
}

export function AdminCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`adminCard ${className}`}>{children}</section>;
}

export function AdminStatCard({ icon: IconComponent, label, value, context, href, tone = "neutral" }: { icon: Icon; label: string; value: string | number; context?: string; href?: string; tone?: string }) {
  const content = (
    <>
      <span className={`adminStatIcon ${tone}`}><IconComponent size={20} /></span>
      <strong>{value}</strong>
      <span>{label}</span>
      {context ? <small>{context}</small> : null}
    </>
  );
  return href ? <Link className="adminStatCard" href={href}>{content}</Link> : <article className="adminStatCard">{content}</article>;
}

export function AdminBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: string }) {
  return <span className={`adminBadge ${tone}`}>{children}</span>;
}

export function AdminAlert({ children, tone = "danger" }: { children: ReactNode; tone?: "danger" | "info" | "success" }) {
  return <div className={`adminAlert ${tone}`} role="status">{children}</div>;
}

export function AdminEmptyState({ icon: IconComponent = Search, title, description, action }: { icon?: Icon; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="adminEmptyState">
      <span><IconComponent size={28} /></span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function AdminSkeleton({ rows = 4 }: { rows?: number }) {
  return <div className="adminSkeleton" aria-label="Cargando">{Array.from({ length: rows }).map((_, index) => <span key={index} />)}</div>;
}

export function AdminToolbar({ children }: { children: ReactNode }) {
  return <div className="adminToolbar">{children}</div>;
}

export function AdminSearch({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="adminSearchField">
      <Search size={17} />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </label>
  );
}

export function AdminSelect({ value, onChange, children, label }: { value: string; onChange: (value: string) => void; children: ReactNode; label: string }) {
  return (
    <label className="adminSelectField">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>
    </label>
  );
}

export function AdminSectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return (
    <div className="adminSectionTitle">
      <div>{eyebrow ? <span>{eyebrow}</span> : null}<h3>{title}</h3></div>
      {action}
    </div>
  );
}
