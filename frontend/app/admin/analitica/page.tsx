"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardList,
  CreditCard,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Star,
  Store,
  UsersRound
} from "lucide-react";
import {
  AdminAlert,
  AdminButton,
  AdminEmptyState,
  AdminPageHeader,
  AdminSelect,
  AdminShell,
  formatAdminDate,
  humanizeAdminText
} from "../components/AdminUI";
import {
  AnalyticsChartCard,
  AnalyticsDataTable,
  AnalyticsEmptyChart,
  AnalyticsKpiCard,
  AnalyticsSection,
  AnalyticsSkeleton,
  BarChart,
  DonutChart,
  DoubleBarChart,
  LineChart,
  distributionTotal,
  formatAnalyticsMoney,
  formatAnalyticsNumber,
  formatAnalyticsPercent,
  hasDistributionData,
  hasSeriesData,
  seriesTotal
} from "../components/AnalyticsUI";
import {
  getAdminAnalyticsFilterOptions,
  getAdminAnalyticsMarketplace,
  getAdminAnalyticsModeration,
  getAdminAnalyticsOverview,
  getAdminAnalyticsPayments,
  getAdminAnalyticsPublications,
  getAdminAnalyticsRequests,
  getAdminAnalyticsReviews,
  getAdminAnalyticsUsers,
  type AnalyticsFilterOptions,
  type AnalyticsFilters,
  type AnalyticsGranularity,
  type AnalyticsMarketplace,
  type AnalyticsModeration,
  type AnalyticsOverview,
  type AnalyticsPayments,
  type AnalyticsPreset,
  type AnalyticsPublications,
  type AnalyticsRequests,
  type AnalyticsReviews,
  type AnalyticsUsers
} from "../lib/analytics";
import { fetchCurrentUser, type CurrentUser } from "../../lib/api";

type SectionKey = "usuarios" | "publicaciones" | "solicitudes" | "pagos" | "resenas" | "marketplace" | "moderacion";
type ModuleData = {
  usuarios?: AnalyticsUsers;
  publicaciones?: AnalyticsPublications;
  solicitudes?: AnalyticsRequests;
  pagos?: AnalyticsPayments;
  resenas?: AnalyticsReviews;
  marketplace?: AnalyticsMarketplace;
  moderacion?: AnalyticsModeration;
};

const presetLabels: Record<AnalyticsPreset, string> = {
  today: "Hoy",
  yesterday: "Ayer",
  last_7_days: "Últimos 7 días",
  last_30_days: "Últimos 30 días",
  current_week: "Semana actual",
  previous_week: "Semana anterior",
  current_month: "Mes actual",
  previous_month: "Mes anterior",
  current_year: "Año actual",
  custom: "Rango personalizado"
};

const granularityLabels: Record<AnalyticsGranularity, string> = {
  day: "Día",
  week: "Semana",
  month: "Mes"
};

const sectionLabels: Record<SectionKey, string> = {
  usuarios: "Usuarios",
  publicaciones: "Publicaciones",
  solicitudes: "Solicitudes",
  pagos: "Pagos",
  resenas: "Reseñas",
  marketplace: "Marketplace",
  moderacion: "Moderación"
};

const sectionOrder: SectionKey[] = ["usuarios", "publicaciones", "solicitudes", "pagos", "resenas", "marketplace", "moderacion"];

const defaultFilters: AnalyticsFilters = {
  preset: "last_30_days",
  granularity: "day",
  timezone: "America/Mexico_City"
};

function cleanFilters(filters: AnalyticsFilters) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && value !== "")) as AnalyticsFilters;
}

function filtersFromUrl() {
  if (typeof window === "undefined") return defaultFilters;
  const params = new URLSearchParams(window.location.search);
  const filters: AnalyticsFilters = { ...defaultFilters };
  params.forEach((value, key) => {
    if (key in filters || ["role", "category", "status", "location", "provider_id", "client_id", "admin_id", "payment_method", "payment_status", "date_from", "date_to", "limit"].includes(key)) {
      (filters as Record<string, string>)[key] = value;
    }
  });
  return cleanFilters(filters);
}

function syncUrl(filters: AnalyticsFilters) {
  const params = new URLSearchParams();
  Object.entries(cleanFilters(filters)).forEach(([key, value]) => params.set(key, String(value)));
  const query = params.toString();
  window.history.replaceState(null, "", query ? `/admin/analitica?${query}` : "/admin/analitica");
}

function friendlyError(error: unknown) {
  return error instanceof Error ? error.message : "No pudimos cargar esta sección. Inténtalo nuevamente.";
}

function activeFilterChips(filters: AnalyticsFilters) {
  const chips: string[] = [];
  Object.entries(cleanFilters(filters)).forEach(([key, value]) => {
    if (key === "timezone" || key === "granularity" || key === "preset") return;
    chips.push(`${humanizeAdminText(key)}: ${value}`);
  });
  chips.unshift(`Periodo: ${presetLabels[(filters.preset as AnalyticsPreset) || "last_30_days"]}`);
  chips.push(`Agrupado por: ${granularityLabels[(filters.granularity as AnalyticsGranularity) || "day"]}`);
  return chips;
}

function periodLabel(overview?: AnalyticsOverview) {
  if (!overview?.period) return "Periodo seleccionado";
  return `${overview.period.date_from} a ${overview.period.date_to}`;
}

function sectionSummary(section: SectionKey, data: ModuleData) {
  if (section === "usuarios") return `Usuarios registrados: ${data.usuarios?.totals.users ?? 0}.`;
  if (section === "publicaciones") return `Publicaciones del periodo: ${data.publicaciones?.totals.publications ?? 0}.`;
  if (section === "solicitudes") return `Solicitudes del periodo: ${data.solicitudes?.totals.requests ?? 0}.`;
  if (section === "pagos") return `Monto procesado: ${formatAnalyticsMoney(data.pagos?.totals.amount ?? 0)}.`;
  if (section === "resenas") return `Reseñas del periodo: ${data.resenas?.totals.reviews ?? 0}.`;
  if (section === "marketplace") return `Categorías analizadas: ${data.marketplace?.categories.length ?? 0}.`;
  return `Eventos administrativos: ${seriesTotal(data.moderacion?.series.events ?? [])}.`;
}

async function downloadPdf({ overview, modules, filters, user }: { overview: AnalyticsOverview | null; modules: ModuleData; filters: AnalyticsFilters; user: CurrentUser | null }) {
  const { default: jsPDF } = await import("jspdf");
  const autoTableModule = await import("jspdf-autotable");
  const autoTable = autoTableModule.default;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const today = new Date();
  const fileDate = today.toISOString().slice(0, 10);
  let y = 44;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("JobNest", 40, y);
  doc.setFontSize(14);
  doc.text("Reporte de analítica administrativa", 40, y + 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Generado: ${today.toLocaleString("es-MX")}`, 40, y + 44);
  doc.text(`Administrador: ${user?.correo || user?.nombres || "Administrador"}`, 40, y + 58);
  doc.text(`Dominio: https://jobnestservices.com`, 40, y + 72);
  y += 96;

  autoTable(doc, {
    startY: y,
    head: [["Periodo", "Filtros aplicados"]],
    body: [[periodLabel(overview ?? undefined), activeFilterChips(filters).join(" | ")]],
    styles: { fontSize: 8, cellPadding: 6 },
    headStyles: { fillColor: [39, 84, 245] }
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;

  const kpis = overview ? [
    ["Usuarios nuevos", formatAnalyticsNumber(overview.kpis.new_users.value), formatAnalyticsPercent(overview.kpis.new_users.change_percentage)],
    ["Publicaciones activas", formatAnalyticsNumber(overview.kpis.active_publications.value), formatAnalyticsPercent(overview.kpis.active_publications.change_percentage)],
    ["Solicitudes", formatAnalyticsNumber(overview.kpis.requests.value), formatAnalyticsPercent(overview.kpis.requests.change_percentage)],
    ["Trabajos concluidos", formatAnalyticsNumber(overview.kpis.completed_jobs.value), formatAnalyticsPercent(overview.kpis.completed_jobs.change_percentage)],
    ["Monto procesado", formatAnalyticsMoney(overview.kpis.payments_amount.value), formatAnalyticsPercent(overview.kpis.payments_amount.change_percentage)],
    ["Calificación promedio", formatAnalyticsNumber(overview.kpis.average_rating.value, 2), "Sin comparación"]
  ] : [];
  autoTable(doc, {
    startY: y,
    head: [["KPI", "Valor", "Comparación"]],
    body: kpis.length ? kpis : [["Sin datos", "0", "Sin comparación"]],
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [24, 34, 48] }
  });

  const sections = [
    ["Usuarios", [["Total", modules.usuarios?.totals.users ?? 0], ["Activos", modules.usuarios?.totals.active ?? 0], ["Inactivos", modules.usuarios?.totals.inactive ?? 0]]],
    ["Publicaciones", [["Total", modules.publicaciones?.totals.publications ?? 0], ["Activas", modules.publicaciones?.totals.active ?? 0], ["Sin solicitudes", modules.publicaciones?.totals.without_requests ?? 0]]],
    ["Solicitudes", [["Total", modules.solicitudes?.totals.requests ?? 0], ["Aceptadas", modules.solicitudes?.totals.accepted ?? 0], ["Concluidas", modules.solicitudes?.totals.completed ?? 0]]],
    ["Pagos", [["Pagos", modules.pagos?.totals.payments ?? 0], ["Monto", formatAnalyticsMoney(modules.pagos?.totals.amount ?? 0)], ["Ticket promedio", formatAnalyticsMoney(modules.pagos?.totals.average_ticket ?? 0)]]],
    ["Reseñas", [["Total", modules.resenas?.totals.reviews ?? 0], ["Promedio", modules.resenas?.totals.average_rating ?? "Sin dato"], ["Servicios sin reseña", modules.resenas?.totals.completed_jobs_without_review ?? 0]]],
    ["Moderación", [["Quejas", modules.moderacion?.totals.complaints ?? 0], ["Pendientes", modules.moderacion?.totals.complaints_pending ?? 0], ["Alertas", modules.moderacion?.totals.alerts_unread ?? 0]]]
  ];

  sections.forEach(([title, rows]) => {
    autoTable(doc, {
      head: [[String(title), "Valor"]],
      body: rows as Array<[string, string | number]>,
      styles: { fontSize: 8, cellPadding: 5 },
      headStyles: { fillColor: [16, 166, 160] },
      margin: { top: 36 }
    });
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.text(`JobNest · Página ${page} de ${pageCount}`, 40, 820);
  }
  doc.save(`jobnest-analytics-${fileDate}.pdf`);
}

async function downloadExcel({ overview, modules, filters }: { overview: AnalyticsOverview | null; modules: ModuleData; filters: AnalyticsFilters }) {
  const ExcelJS = await import("exceljs");
  const fileSaverModule = await import("file-saver");
  const saveAs = fileSaverModule.saveAs ?? fileSaverModule.default.saveAs;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "JobNest";
  workbook.created = new Date();

  const addSheet = (name: string, rows: Array<Array<string | number | null | undefined>>) => {
    const sheet = workbook.addWorksheet(name);
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.addRows(rows.length ? rows : [["Sin datos", "No hay datos para este periodo"]]);
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2754F5" } };
    sheet.autoFilter = { from: "A1", to: `${String.fromCharCode(64 + Math.max(rows[0]?.length ?? 2, 2))}1` };
    sheet.columns.forEach((column) => { column.width = 24; });
    return sheet;
  };

  addSheet("Resumen", [
    ["Métrica", "Valor", "Comparación"],
    ["Periodo", periodLabel(overview ?? undefined), ""],
    ["Usuarios nuevos", overview?.kpis.new_users.value ?? 0, formatAnalyticsPercent(overview?.kpis.new_users.change_percentage)],
    ["Publicaciones activas", overview?.kpis.active_publications.value ?? 0, formatAnalyticsPercent(overview?.kpis.active_publications.change_percentage)],
    ["Solicitudes", overview?.kpis.requests.value ?? 0, formatAnalyticsPercent(overview?.kpis.requests.change_percentage)],
    ["Monto procesado", overview?.kpis.payments_amount.value ?? 0, formatAnalyticsPercent(overview?.kpis.payments_amount.change_percentage)]
  ]);
  addSheet("Usuarios", [["Grupo", "Valor", "Porcentaje"], ...(modules.usuarios?.distributions.by_role ?? []).map((item) => [item.label, item.value, item.percentage])]);
  addSheet("Publicaciones", [["Categoría", "Publicaciones", "Porcentaje"], ...(modules.publicaciones?.distributions.by_category ?? []).map((item) => [item.label, item.value, item.percentage])]);
  addSheet("Solicitudes", [["Estado", "Solicitudes", "Porcentaje"], ...(modules.solicitudes?.distributions.by_status ?? []).map((item) => [item.label, item.value, item.percentage])]);
  addSheet("Pagos", [["Grupo", "Valor", "Porcentaje"], ...(modules.pagos?.distributions.by_state ?? []).map((item) => [item.label, item.value, item.percentage])]);
  addSheet("Reseñas", [["Estrellas", "Reseñas", "Porcentaje"], ...(modules.resenas?.distributions.by_stars ?? []).map((item) => [item.label, item.value, item.percentage])]);
  addSheet("Marketplace", [["Categoría", "Oferta", "Demanda", "Relación", "Precio promedio"], ...(modules.marketplace?.categories ?? []).map((item) => [item.category, item.offer, item.demand, item.demand_offer_ratio, item.average_price])]);
  addSheet("Moderación", [["Evento", "Total", "Porcentaje"], ...(modules.moderacion?.distributions.events_by_type ?? []).map((item) => [item.label, item.value, item.percentage])]);
  addSheet("Filtros", [["Filtro", "Valor"], ...activeFilterChips(filters).map((chip) => {
    const [key, ...rest] = chip.split(":");
    return [key, rest.join(":").trim()];
  })]);

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `jobnest-analytics-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export default function AdminAnalyticsPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [filters, setFilters] = useState<AnalyticsFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<AnalyticsFilters>(defaultFilters);
  const [options, setOptions] = useState<AnalyticsFilterOptions["options"] | null>(null);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [modules, setModules] = useState<ModuleData>({});
  const [activeSection, setActiveSection] = useState<SectionKey>("usuarios");
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingSections, setLoadingSections] = useState<Record<SectionKey, boolean>>({} as Record<SectionKey, boolean>);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);

  const chips = useMemo(() => activeFilterChips(appliedFilters), [appliedFilters]);

  const loadSection = async (section: SectionKey, nextFilters = appliedFilters) => {
    setLoadingSections((current) => ({ ...current, [section]: true }));
    setErrors((current) => ({ ...current, [section]: "" }));
    try {
      const loaders = {
        usuarios: getAdminAnalyticsUsers,
        publicaciones: getAdminAnalyticsPublications,
        solicitudes: getAdminAnalyticsRequests,
        pagos: getAdminAnalyticsPayments,
        resenas: getAdminAnalyticsReviews,
        marketplace: getAdminAnalyticsMarketplace,
        moderacion: getAdminAnalyticsModeration
      };
      const data = await loaders[section](nextFilters);
      setModules((current) => ({ ...current, [section]: data }));
    } catch (error) {
      setErrors((current) => ({ ...current, [section]: friendlyError(error) }));
    } finally {
      setLoadingSections((current) => ({ ...current, [section]: false }));
    }
  };

  const loadOverview = async (nextFilters = appliedFilters) => {
    setLoadingOverview(true);
    setErrors((current) => ({ ...current, overview: "" }));
    try {
      const currentUser = await fetchCurrentUser();
      if (!currentUser) throw new Error("Inicia sesión como administrador para ver esta sección.");
      if (currentUser.tipo_usuario !== "administrador") throw new Error("Esta sección está reservada para administradores.");
      setUser(currentUser);
      if (!options) {
        const optionData = await getAdminAnalyticsFilterOptions();
        setOptions(optionData.options);
      }
      setOverview(await getAdminAnalyticsOverview(nextFilters));
    } catch (error) {
      setErrors((current) => ({ ...current, overview: friendlyError(error) }));
    } finally {
      setLoadingOverview(false);
    }
  };

  const applyFilters = async () => {
    const nextFilters = cleanFilters(filters);
    if (nextFilters.preset === "custom" && (!nextFilters.date_from || !nextFilters.date_to)) {
      setErrors((current) => ({ ...current, filters: "Selecciona fecha desde y fecha hasta para usar rango personalizado." }));
      return;
    }
    setErrors((current) => ({ ...current, filters: "" }));
    setAppliedFilters(nextFilters);
    setModules({});
    syncUrl(nextFilters);
    await loadOverview(nextFilters);
    await loadSection(activeSection, nextFilters);
  };

  const resetFilters = async () => {
    setFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    setModules({});
    syncUrl(defaultFilters);
    await loadOverview(defaultFilters);
    await loadSection(activeSection, defaultFilters);
  };

  const ensureAllSections = async () => {
    const loaded: ModuleData = { ...modules };
    for (const section of sectionOrder) {
      if (loaded[section]) continue;
      const loaders = {
        usuarios: getAdminAnalyticsUsers,
        publicaciones: getAdminAnalyticsPublications,
        solicitudes: getAdminAnalyticsRequests,
        pagos: getAdminAnalyticsPayments,
        resenas: getAdminAnalyticsReviews,
        marketplace: getAdminAnalyticsMarketplace,
        moderacion: getAdminAnalyticsModeration
      };
      loaded[section] = await loaders[section](appliedFilters) as never;
    }
    setModules(loaded);
    return loaded;
  };

  useEffect(() => {
    const initialFilters = filtersFromUrl();
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
    void (async () => {
      await loadOverview(initialFilters);
      await loadSection("usuarios", initialFilters);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!modules[activeSection] && !loadingSections[activeSection]) void loadSection(activeSection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);

  const handleExport = async (type: "pdf" | "excel") => {
    setExporting(type);
    setErrors((current) => ({ ...current, export: "" }));
    try {
      const allModules = await ensureAllSections();
      if (type === "pdf") await downloadPdf({ overview, modules: allModules, filters: appliedFilters, user });
      else await downloadExcel({ overview, modules: allModules, filters: appliedFilters });
    } catch (error) {
      setErrors((current) => ({ ...current, export: friendlyError(error) }));
    } finally {
      setExporting(null);
    }
  };

  const activeData = modules[activeSection];
  const activeLoading = loadingSections[activeSection];

  return (
    <AdminShell
      title="Analítica"
      description="KPIs, tendencias, filtros y reportes administrativos."
      userName={user?.nombres}
      actions={<AdminButton onClick={() => void loadOverview(appliedFilters)}><RefreshCw size={16} /> Actualizar</AdminButton>}
    >
      {errors.overview && !overview && !loadingOverview ? (
        <AdminEmptyState icon={ShieldCheck} title={errors.overview} description="La analítica requiere una sesión activa con permisos de administrador." action={<Link className="adminButton primary" href="/login">Iniciar sesión</Link>} />
      ) : null}

      <AdminPageHeader
        eyebrow="Inteligencia operativa"
        title="Analítica administrativa"
        description="Consulta el comportamiento real de usuarios, publicaciones, solicitudes, pagos, reseñas, marketplace y moderación con filtros compartibles."
        icon={BarChart3}
        actions={(
          <>
            <button className="adminButton" type="button" onClick={() => void handleExport("pdf")} disabled={!!exporting}><FileText size={16} /> PDF</button>
            <button className="adminButton primary" type="button" onClick={() => void handleExport("excel")} disabled={!!exporting}><FileSpreadsheet size={16} /> Excel</button>
          </>
        )}
      />

      {errors.export ? <AdminAlert>{errors.export}</AdminAlert> : null}

      <section className="analyticsFilterBar" aria-label="Filtros globales">
        <header>
          <div><Filter size={18} /><strong>Filtros globales</strong><span>La URL se actualiza al aplicar filtros.</span></div>
          <div>
            <button className="adminButton" type="button" onClick={() => void resetFilters()}><RotateCcw size={16} /> Limpiar</button>
            <button className="adminButton primary" type="button" onClick={() => void applyFilters()}><Filter size={16} /> Aplicar</button>
          </div>
        </header>
        {errors.filters ? <AdminAlert>{errors.filters}</AdminAlert> : null}
        <div className="analyticsFilterGrid">
          <AdminSelect label="Periodo" value={filters.preset || "last_30_days"} onChange={(value) => setFilters((current) => ({ ...current, preset: value as AnalyticsPreset }))}>
            {Object.entries(presetLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </AdminSelect>
          <label className="adminSelectField"><span>Desde</span><input type="date" value={filters.date_from || ""} onChange={(event) => setFilters((current) => ({ ...current, date_from: event.target.value }))} /></label>
          <label className="adminSelectField"><span>Hasta</span><input type="date" value={filters.date_to || ""} onChange={(event) => setFilters((current) => ({ ...current, date_to: event.target.value }))} /></label>
          <AdminSelect label="Granularidad" value={filters.granularity || "day"} onChange={(value) => setFilters((current) => ({ ...current, granularity: value as AnalyticsGranularity }))}>
            {Object.entries(granularityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </AdminSelect>
          <AdminSelect label="Rol" value={filters.role || ""} onChange={(value) => setFilters((current) => ({ ...current, role: value as AnalyticsFilters["role"] }))}>
            <option value="">Todos</option>
            {(options?.roles ?? ["cliente", "prestador", "administrador"]).map((role) => <option key={role} value={role}>{humanizeAdminText(role)}</option>)}
          </AdminSelect>
          <AdminSelect label="Categoría" value={filters.category || ""} onChange={(value) => setFilters((current) => ({ ...current, category: value }))}>
            <option value="">Todas</option>
            {(options?.categories ?? []).map((category) => <option key={category} value={category}>{category}</option>)}
          </AdminSelect>
          <AdminSelect label="Estado" value={filters.status || ""} onChange={(value) => setFilters((current) => ({ ...current, status: value }))}>
            <option value="">Todos</option>
            {[...(options?.publication_states ?? []), ...(options?.request_states ?? [])].filter((item, index, list) => item && list.indexOf(item) === index).map((status) => <option key={status} value={status}>{humanizeAdminText(status)}</option>)}
          </AdminSelect>
          <AdminSelect label="Ubicación" value={filters.location || ""} onChange={(value) => setFilters((current) => ({ ...current, location: value }))}>
            <option value="">Todas</option>
            {(options?.locations ?? []).map((location) => <option key={location} value={location}>{location}</option>)}
          </AdminSelect>
          <AdminSelect label="Administrador" value={String(filters.admin_id || "")} onChange={(value) => setFilters((current) => ({ ...current, admin_id: value }))}>
            <option value="">Todos</option>
            {(options?.administrators ?? []).map((admin) => <option key={admin.id} value={admin.id}>{admin.label}</option>)}
          </AdminSelect>
          <AdminSelect label="Método de pago" value={filters.payment_method || ""} onChange={(value) => setFilters((current) => ({ ...current, payment_method: value }))}>
            <option value="">Todos</option>
            {(options?.payment_methods ?? []).map((method) => <option key={method} value={method}>{method}</option>)}
          </AdminSelect>
          <AdminSelect label="Estado de pago" value={filters.payment_status || ""} onChange={(value) => setFilters((current) => ({ ...current, payment_status: value }))}>
            <option value="">Todos</option>
            {(options?.payment_states ?? []).map((state) => <option key={state} value={state}>{state}</option>)}
          </AdminSelect>
        </div>
        <div className="analyticsChips">{chips.map((chip) => <span key={chip}>{chip}</span>)}</div>
      </section>

      {loadingOverview ? <AnalyticsSkeleton /> : overview ? (
        <section className="analyticsKpiGrid" aria-label="Indicadores principales">
          <AnalyticsKpiCard icon={UsersRound} label="Usuarios nuevos" value={formatAnalyticsNumber(overview.kpis.new_users.value)} kpi={overview.kpis.new_users} definition={`Periodo ${periodLabel(overview)}`} tone="blue" />
          <AnalyticsKpiCard icon={Store} label="Publicaciones activas" value={formatAnalyticsNumber(overview.kpis.active_publications.value)} kpi={overview.kpis.active_publications} definition="Oferta visible y operativa" tone="teal" />
          <AnalyticsKpiCard icon={BriefcaseBusiness} label="Solicitudes creadas" value={formatAnalyticsNumber(overview.kpis.requests.value)} kpi={overview.kpis.requests} definition="Demanda recibida en el periodo" tone="purple" />
          <AnalyticsKpiCard icon={ShieldCheck} label="Trabajos concluidos" value={formatAnalyticsNumber(overview.kpis.completed_jobs.value)} kpi={overview.kpis.completed_jobs} definition="Estados concluidos o calificados" tone="green" />
          <AnalyticsKpiCard icon={CreditCard} label="Monto procesado" value={formatAnalyticsMoney(overview.kpis.payments_amount.value)} kpi={overview.kpis.payments_amount} definition="Pagos registrados en el periodo" tone="amber" />
          <AnalyticsKpiCard icon={Star} label="Calificación promedio" value={formatAnalyticsNumber(overview.kpis.average_rating.value, 2)} kpi={overview.kpis.average_rating} definition="Promedio de reseñas recibidas" tone="cyan" />
        </section>
      ) : null}

      <nav className="analyticsTabs" aria-label="Módulos de analítica">
        {sectionOrder.map((section) => (
          <button key={section} type="button" className={activeSection === section ? "active" : ""} onClick={() => setActiveSection(section)}>{sectionLabels[section]}</button>
        ))}
      </nav>

      {activeLoading ? <AnalyticsSkeleton /> : null}
      {!activeLoading && errors[activeSection] ? (
        <AdminAlert>{errors[activeSection]} <button className="inlineRetry" type="button" onClick={() => void loadSection(activeSection)}>Reintentar</button></AdminAlert>
      ) : null}

      {!activeLoading && !errors[activeSection] ? (
        <>
          {activeSection === "usuarios" && (
            <AnalyticsSection id="usuarios" title="Usuarios" description="Altas, actividad y composición por tipo de cuenta." actions={<span>{sectionSummary("usuarios", modules)}</span>}>
              <div className="analyticsGrid two">
                <AnalyticsChartCard title="Registros por periodo" description="Usuarios creados según el filtro aplicado." summary={`Total de registros: ${formatAnalyticsNumber(seriesTotal(modules.usuarios?.series.registrations ?? []))}.`}>
                  <LineChart data={modules.usuarios?.series.registrations ?? []} label="Registros por periodo" />
                </AnalyticsChartCard>
                <AnalyticsChartCard title="Distribución por rol" description="Clientes, prestadores y administradores." summary={`Total distribuido: ${formatAnalyticsNumber(distributionTotal(modules.usuarios?.distributions.by_role ?? []))}.`}>
                  <DonutChart data={modules.usuarios?.distributions.by_role ?? []} label="Distribución por rol" />
                </AnalyticsChartCard>
              </div>
              <AnalyticsDataTable columns={["Métrica", "Valor"]} rows={[
                ["Usuarios", modules.usuarios?.totals.users ?? 0],
                ["Activos", modules.usuarios?.totals.active ?? 0],
                ["Inactivos", modules.usuarios?.totals.inactive ?? 0],
                ["Prestadores con publicaciones", modules.usuarios?.totals.providers_with_publications ?? 0],
                ["Prestadores sin publicaciones", modules.usuarios?.totals.providers_without_publications ?? 0]
              ]} />
            </AnalyticsSection>
          )}

          {activeSection === "publicaciones" && (
            <AnalyticsSection id="publicaciones" title="Publicaciones" description="Creación, estados, categorías e indicadores de moderación." actions={<span>{sectionSummary("publicaciones", modules)}</span>}>
              <div className="analyticsGrid two">
                <AnalyticsChartCard title="Publicaciones creadas" description="Tendencia de publicaciones en el periodo." summary={`Publicaciones creadas: ${formatAnalyticsNumber(seriesTotal(modules.publicaciones?.series.created ?? []))}.`}>
                  <LineChart data={modules.publicaciones?.series.created ?? []} label="Publicaciones creadas" />
                </AnalyticsChartCard>
                <AnalyticsChartCard title="Estados de publicación" description="Distribución del estado de revisión." summary={`Estados con datos: ${(modules.publicaciones?.distributions.by_state ?? []).length}.`}>
                  <DonutChart data={modules.publicaciones?.distributions.by_state ?? []} label="Estados de publicación" />
                </AnalyticsChartCard>
                <AnalyticsChartCard title="Categorías con mayor oferta" description="Publicaciones agrupadas por categoría." summary={`Categorías visibles: ${(modules.publicaciones?.distributions.by_category ?? []).length}.`}>
                  <BarChart data={modules.publicaciones?.distributions.by_category ?? []} horizontal label="Publicaciones por categoría" />
                </AnalyticsChartCard>
                <AnalyticsChartCard title="Con y sin solicitudes" description="Publicaciones que ya recibieron demanda frente a publicaciones sin solicitudes." summary={`${formatAnalyticsNumber(modules.publicaciones?.totals.without_requests ?? 0)} publicaciones sin solicitudes.`}>
                  <BarChart data={[
                    { label: "Con solicitudes", value: Math.max((modules.publicaciones?.totals.publications ?? 0) - (modules.publicaciones?.totals.without_requests ?? 0), 0), percentage: 0 },
                    { label: "Sin solicitudes", value: modules.publicaciones?.totals.without_requests ?? 0, percentage: 0 }
                  ]} horizontal label="Publicaciones con y sin solicitudes" />
                </AnalyticsChartCard>
              </div>
            </AnalyticsSection>
          )}

          {activeSection === "solicitudes" && (
            <AnalyticsSection id="solicitudes" title="Solicitudes y trabajos" description="Demanda, aceptación, conclusión y rankings de publicaciones." actions={<span>{sectionSummary("solicitudes", modules)}</span>}>
              <div className="analyticsGrid two">
                <AnalyticsChartCard title="Solicitudes por periodo" description="Demanda registrada con el filtro aplicado." summary={`Solicitudes: ${formatAnalyticsNumber(seriesTotal(modules.solicitudes?.series.created ?? []))}.`}>
                  <LineChart data={modules.solicitudes?.series.created ?? []} label="Solicitudes por periodo" />
                </AnalyticsChartCard>
                <AnalyticsChartCard title="Embudo operativo" description="Creadas, aceptadas y concluidas." summary={`Tasa de conclusión: ${formatAnalyticsPercent(modules.solicitudes?.totals.completion_rate ?? null)}.`}>
                  <BarChart data={[
                    { label: "Creadas", value: modules.solicitudes?.totals.requests ?? 0, percentage: 0 },
                    { label: "Aceptadas", value: modules.solicitudes?.totals.accepted ?? 0, percentage: 0 },
                    { label: "Concluidas", value: modules.solicitudes?.totals.completed ?? 0, percentage: 0 }
                  ]} horizontal label="Embudo de solicitudes" />
                </AnalyticsChartCard>
                <AnalyticsChartCard title="Estados de solicitud" description="Solicitudes agrupadas por estado." summary={`Estados: ${(modules.solicitudes?.distributions.by_status ?? []).length}.`}>
                  <DonutChart data={modules.solicitudes?.distributions.by_status ?? []} label="Estados de solicitud" />
                </AnalyticsChartCard>
                <AnalyticsChartCard title="Categorías con mayor demanda" description="Solicitudes agrupadas por categoría." summary={`Categorías: ${(modules.solicitudes?.distributions.by_category ?? []).length}.`}>
                  <BarChart data={modules.solicitudes?.distributions.by_category ?? []} horizontal label="Demanda por categoría" />
                </AnalyticsChartCard>
              </div>
              <AnalyticsDataTable columns={["Publicación", "Solicitudes"]} rows={(modules.solicitudes?.rankings.top_publications ?? []).map((item) => [item.label, item.value])} />
            </AnalyticsSection>
          )}

          {activeSection === "pagos" && (
            <AnalyticsSection id="pagos" title="Pagos" description="Monto procesado, estados, métodos y ticket promedio." actions={<span>{sectionSummary("pagos", modules)}</span>}>
              <div className="analyticsGrid two">
                <AnalyticsChartCard title="Monto procesado" description="Suma de pagos por periodo." summary={`Monto total: ${formatAnalyticsMoney(modules.pagos?.totals.amount ?? 0)}.`}>
                  <LineChart data={modules.pagos?.series.amount ?? []} valueKey="value" label="Monto procesado" />
                </AnalyticsChartCard>
                <AnalyticsChartCard title="Métodos de pago" description="Distribución de pagos por método." summary={`Métodos usados: ${(modules.pagos?.distributions.by_method ?? []).length}.`}>
                  <DonutChart data={modules.pagos?.distributions.by_method ?? []} label="Métodos de pago" />
                </AnalyticsChartCard>
                <AnalyticsChartCard title="Estados de pago" description="Pagos agrupados por estado." summary={`Ticket promedio: ${formatAnalyticsMoney(modules.pagos?.totals.average_ticket ?? 0)}.`}>
                  <BarChart data={modules.pagos?.distributions.by_state ?? []} horizontal label="Estados de pago" />
                </AnalyticsChartCard>
                <AnalyticsChartCard title="Monto por categoría" description="Importe acumulado por categoría." summary={`Categorías con monto: ${(modules.pagos?.distributions.amount_by_category ?? []).length}.`}>
                  <BarChart data={modules.pagos?.distributions.amount_by_category ?? []} horizontal label="Monto por categoría" />
                </AnalyticsChartCard>
              </div>
            </AnalyticsSection>
          )}

          {activeSection === "resenas" && (
            <AnalyticsSection id="resenas" title="Reseñas" description="Calificaciones, volumen y servicios pendientes de reseña." actions={<span>{sectionSummary("resenas", modules)}</span>}>
              <div className="analyticsGrid two">
                <AnalyticsChartCard title="Reseñas por periodo" description="Cantidad de reseñas registradas." summary={`Reseñas: ${formatAnalyticsNumber(seriesTotal(modules.resenas?.series.reviews ?? []))}.`}>
                  <LineChart data={modules.resenas?.series.reviews ?? []} label="Reseñas por periodo" />
                </AnalyticsChartCard>
                <AnalyticsChartCard title="Distribución de estrellas" description="Calificaciones agrupadas por número de estrellas." summary={`Promedio: ${formatAnalyticsNumber(modules.resenas?.totals.average_rating ?? null, 2)}.`}>
                  <BarChart data={modules.resenas?.distributions.by_stars ?? []} label="Distribución de estrellas" />
                </AnalyticsChartCard>
                <AnalyticsChartCard title="Promedio por categoría" description="Categorías ordenadas por calificación promedio." summary={`${formatAnalyticsNumber(modules.resenas?.totals.completed_jobs_without_review ?? 0)} servicios concluidos sin reseña.`}>
                  <BarChart data={modules.resenas?.distributions.average_by_category ?? []} horizontal label="Promedio por categoría" />
                </AnalyticsChartCard>
                <AnalyticsChartCard title="Servicios sin reseña" description="Trabajos concluidos que aún no fueron calificados." summary="Este indicador ayuda a detectar cierres incompletos.">
                  {(modules.resenas?.totals.completed_jobs_without_review ?? 0) > 0 ? <BarChart data={[{ label: "Sin reseña", value: modules.resenas?.totals.completed_jobs_without_review ?? 0, percentage: 100 }]} horizontal label="Servicios sin reseña" /> : <AnalyticsEmptyChart />}
                </AnalyticsChartCard>
              </div>
            </AnalyticsSection>
          )}

          {activeSection === "marketplace" && (
            <AnalyticsSection id="marketplace" title="Marketplace" description="Relación entre oferta, demanda, precio promedio y categorías." actions={<span>{sectionSummary("marketplace", modules)}</span>}>
              <div className="analyticsGrid two">
                <AnalyticsChartCard title="Oferta vs demanda" description="Publicaciones activas comparadas con solicitudes por categoría." summary={`${formatAnalyticsNumber(modules.marketplace?.totals.categories_without_offer ?? 0)} categorías sin oferta.`}>
                  <DoubleBarChart data={modules.marketplace?.categories ?? []} leftKey="offer" rightKey="demand" leftLabel="Oferta" rightLabel="Demanda" />
                </AnalyticsChartCard>
                <AnalyticsChartCard title="Relación demanda/oferta" description="Categorías con mayor presión de demanda." summary={`${formatAnalyticsNumber(modules.marketplace?.totals.categories_without_demand ?? 0)} categorías sin demanda.`}>
                  <BarChart data={(modules.marketplace?.categories ?? []).map((item) => ({ label: item.category, value: item.demand_offer_ratio ?? 0, percentage: 0 }))} horizontal label="Relación demanda/oferta" />
                </AnalyticsChartCard>
              </div>
              <AnalyticsDataTable columns={["Categoría", "Oferta", "Demanda", "Relación", "Precio promedio"]} rows={(modules.marketplace?.categories ?? []).map((item) => [item.category, item.offer, item.demand, item.demand_offer_ratio ?? "Sin dato", item.average_price ? formatAnalyticsMoney(item.average_price) : "Sin dato"])} />
            </AnalyticsSection>
          )}

          {activeSection === "moderacion" && (
            <AnalyticsSection id="moderacion" title="Moderación" description="Eventos administrativos, quejas, alertas y tiempos de revisión." actions={<span>{sectionSummary("moderacion", modules)}</span>}>
              <div className="analyticsGrid two">
                <AnalyticsChartCard title="Eventos administrativos" description="Actividad operativa por periodo." summary={`Eventos: ${formatAnalyticsNumber(seriesTotal(modules.moderacion?.series.events ?? []))}.`}>
                  <LineChart data={modules.moderacion?.series.events ?? []} label="Eventos administrativos" />
                </AnalyticsChartCard>
                <AnalyticsChartCard title="Acciones por tipo" description="Eventos agrupados por tipo de acción." summary={`Tipos de evento: ${(modules.moderacion?.distributions.events_by_type ?? []).length}.`}>
                  <BarChart data={modules.moderacion?.distributions.events_by_type ?? []} horizontal label="Acciones por tipo" />
                </AnalyticsChartCard>
              </div>
              <AnalyticsDataTable columns={["Administrador", "Acciones"]} rows={(modules.moderacion?.rankings.actions_by_admin ?? []).map((item) => [item.label, item.value])} />
            </AnalyticsSection>
          )}
        </>
      ) : null}
    </AdminShell>
  );
}
