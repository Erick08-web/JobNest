import { backendFetch } from "../../lib/api";

export type AnalyticsPreset =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "last_30_days"
  | "current_week"
  | "previous_week"
  | "current_month"
  | "previous_month"
  | "current_year"
  | "custom";

export type AnalyticsGranularity = "day" | "week" | "month";

export type AnalyticsFilters = {
  preset?: AnalyticsPreset;
  date_from?: string;
  date_to?: string;
  timezone?: string;
  granularity?: AnalyticsGranularity;
  role?: "cliente" | "prestador" | "administrador" | "";
  category?: string;
  status?: string;
  location?: string;
  provider_id?: number | string;
  client_id?: number | string;
  admin_id?: number | string;
  payment_method?: string;
  payment_status?: string;
  limit?: number;
};

export type AnalyticsPeriod = {
  date_from: string;
  date_to: string;
  previous_date_from: string;
  previous_date_to: string;
  granularity: AnalyticsGranularity;
  timezone: string;
};

export type AnalyticsKpi = {
  value: number;
  previous: number;
  change_percentage: number | null;
};

export type AnalyticsSeriesPoint = {
  period: string;
  label: string;
  value?: number;
  amount?: number;
  average?: number;
};

export type AnalyticsDistributionItem = {
  label: string;
  value: number;
  percentage: number;
};

export type AnalyticsResponse<T> = T & {
  success: boolean;
  period: AnalyticsPeriod;
  filters: Required<Omit<AnalyticsFilters, "limit">>;
  generated_at: string;
};

export type AnalyticsFilterOptions = {
  success: boolean;
  options: {
    presets: AnalyticsPreset[];
    granularities: AnalyticsGranularity[];
    roles: string[];
    categories: string[];
    publication_states: string[];
    request_states: string[];
    payment_states: string[];
    payment_methods: string[];
    locations: string[];
    administrators: Array<{ id: number; label: string }>;
  };
};

export type AnalyticsOverview = AnalyticsResponse<{
  kpis: {
    users_new: AnalyticsKpi;
    new_users: AnalyticsKpi;
    active_publications: AnalyticsKpi;
    requests: AnalyticsKpi;
    completed_jobs: AnalyticsKpi;
    payments_amount: AnalyticsKpi;
    average_rating: AnalyticsKpi;
  };
  recent_activity: Array<{ id: number; type: string; entity: string; entity_id: number | null; description: string; created_at: string | null }>;
}>;

export type AnalyticsUsers = AnalyticsResponse<{
  totals: {
    users: number;
    active: number;
    inactive: number;
    new_in_period: AnalyticsKpi;
    providers_with_publications: number;
    providers_without_publications: number;
  };
  series: {
    registrations: AnalyticsSeriesPoint[];
  };
  distributions: {
    by_role: AnalyticsDistributionItem[];
  };
}>;

export type AnalyticsPublications = AnalyticsResponse<{
  totals: {
    publications: number;
    active: number;
    inactive: number;
    with_images: number;
    without_images: number;
    without_requests: number;
    average_moderation_hours: number | null;
    price: { average: number | null; minimum: number | null; maximum: number | null };
  };
  series: {
    created: AnalyticsSeriesPoint[];
  };
  distributions: {
    by_state: AnalyticsDistributionItem[];
    by_category: AnalyticsDistributionItem[];
  };
}>;

export type AnalyticsRequests = AnalyticsResponse<{
  totals: {
    requests: number;
    accepted: number;
    rejected: number;
    completed: number;
    cancelled: number;
    acceptance_rate: number | null;
    completion_rate: number | null;
    average_acceptance_hours: number | null;
    completed_job_definition: string;
  };
  series: {
    created: AnalyticsSeriesPoint[];
  };
  distributions: {
    by_status: AnalyticsDistributionItem[];
    by_category: AnalyticsDistributionItem[];
  };
  rankings: {
    top_publications: Array<{ id: number | null; label: string; value: number }>;
  };
}>;

export type AnalyticsPayments = AnalyticsResponse<{
  totals: {
    payments: number;
    amount: number;
    average_ticket: number | null;
  };
  series: {
    amount: AnalyticsSeriesPoint[];
  };
  distributions: {
    by_state: AnalyticsDistributionItem[];
    by_method: AnalyticsDistributionItem[];
    amount_by_category: AnalyticsDistributionItem[];
  };
}>;

export type AnalyticsReviews = AnalyticsResponse<{
  totals: {
    reviews: number;
    average_rating: number | null;
    completed_jobs_without_review: number;
  };
  series: {
    reviews: AnalyticsSeriesPoint[];
  };
  distributions: {
    by_stars: AnalyticsDistributionItem[];
    average_by_category: AnalyticsDistributionItem[];
  };
}>;

export type AnalyticsMarketplace = AnalyticsResponse<{
  categories: Array<{
    category: string;
    offer: number;
    demand: number;
    demand_offer_ratio: number | null;
    average_price: number | null;
  }>;
  totals: {
    active_providers: number;
    providers_without_publications: number;
    categories_without_offer: number;
    categories_without_demand: number;
  };
}>;

export type AnalyticsModeration = AnalyticsResponse<{
  totals: {
    complaints: number;
    complaints_pending: number;
    complaints_resolved: number;
    alerts_unread: number;
    disabled_users: number;
    moderated_publications: number;
    average_review_hours: number | null;
  };
  series: {
    events: AnalyticsSeriesPoint[];
  };
  distributions: {
    events_by_type: AnalyticsDistributionItem[];
  };
  rankings: {
    actions_by_admin: Array<{ label: string; value: number }>;
  };
}>;

function analyticsQuery(filters: AnalyticsFilters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, String(value));
  });

  const query = params.toString();
  return query ? `?${query}` : "";
}

export function getAdminAnalyticsFilterOptions() {
  return backendFetch<AnalyticsFilterOptions>("/admin/analytics/filter-options");
}

export function getAdminAnalyticsOverview(filters?: AnalyticsFilters) {
  return backendFetch<AnalyticsOverview>(`/admin/analytics/overview${analyticsQuery(filters)}`);
}

export function getAdminAnalyticsUsers(filters?: AnalyticsFilters) {
  return backendFetch<AnalyticsUsers>(`/admin/analytics/users${analyticsQuery(filters)}`);
}

export function getAdminAnalyticsPublications(filters?: AnalyticsFilters) {
  return backendFetch<AnalyticsPublications>(`/admin/analytics/publications${analyticsQuery(filters)}`);
}

export function getAdminAnalyticsRequests(filters?: AnalyticsFilters) {
  return backendFetch<AnalyticsRequests>(`/admin/analytics/requests${analyticsQuery(filters)}`);
}

export function getAdminAnalyticsPayments(filters?: AnalyticsFilters) {
  return backendFetch<AnalyticsPayments>(`/admin/analytics/payments${analyticsQuery(filters)}`);
}

export function getAdminAnalyticsReviews(filters?: AnalyticsFilters) {
  return backendFetch<AnalyticsReviews>(`/admin/analytics/reviews${analyticsQuery(filters)}`);
}

export function getAdminAnalyticsMarketplace(filters?: AnalyticsFilters) {
  return backendFetch<AnalyticsMarketplace>(`/admin/analytics/marketplace${analyticsQuery(filters)}`);
}

export function getAdminAnalyticsModeration(filters?: AnalyticsFilters) {
  return backendFetch<AnalyticsModeration>(`/admin/analytics/moderation${analyticsQuery(filters)}`);
}
