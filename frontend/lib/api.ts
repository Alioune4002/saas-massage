function resolveApiBase() {
  const configuredBase = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configuredBase) {
    return configuredBase;
  }

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;

    if (
      hostname === "www.nuadyx.com" ||
      hostname === "nuadyx.com" ||
      hostname.endsWith(".nuadyx.com")
    ) {
      return "https://api.nuadyx.com/api";
    }
  }

  return "http://127.0.0.1:8000/api";
}

export const API_STATUS_EVENT = "nuadyx:api-status";
const API_STATUS_STORAGE_KEY = "nuadyx-api-status";
const GUEST_FAVORITES_TOKEN_KEY = "nuadyx-guest-favorites-token";

export type ApiAvailabilityState = {
  available: boolean;
  checkedAt: string;
  reason: string;
};

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export class ApiUnavailableError extends ApiError {
  constructor(
    message = "Service temporairement indisponible.",
    status = 503,
    body: unknown = null
  ) {
    super(message, status, body);
    this.name = "ApiUnavailableError";
  }
}

function extractApiErrorMessage(body: unknown, status: number) {
  if (typeof body === "object" && body !== null) {
    if ("detail" in body && typeof (body as { detail?: unknown }).detail === "string") {
      return humanizeApiMessage((body as { detail: string }).detail);
    }

    for (const value of Object.values(body as Record<string, unknown>)) {
      if (typeof value === "string" && value.trim()) {
        return humanizeApiMessage(value);
      }

      if (
        Array.isArray(value) &&
        typeof value[0] === "string" &&
        value[0].trim()
      ) {
        return humanizeApiMessage(value[0]);
      }
    }
  }

  return status >= 500
    ? "Le serveur a rencontré un problème temporaire. Réessaie dans quelques instants."
    : "L’action n’a pas pu être enregistrée. Vérifie les informations saisies puis réessaie.";
}

function humanizeApiMessage(message: string) {
  const normalized = message.trim();
  if (!normalized) {
    return "Une erreur est survenue. Réessaie dans quelques instants.";
  }

  const replacements: Record<string, string> = {
    "La valeur doit être un JSON valide.":
      "Le contenu de ce champ n’a pas pu être enregistré. Vérifie sa mise en forme puis réessaie.",
    "Not a valid string.":
      "La valeur saisie n’est pas reconnue.",
    "This field is required.":
      "Ce champ est obligatoire.",
    "A valid integer is required.":
      "La valeur attendue doit être un nombre entier.",
    "A valid number is required.":
      "La valeur attendue doit être un nombre valide.",
  };

  return replacements[normalized] || normalized;
}

export function getApiFieldErrors(error: unknown) {
  if (!(error instanceof ApiError) || typeof error.body !== "object" || error.body === null) {
    return {} as Record<string, string>;
  }

  const body = error.body as Record<string, unknown>;
  const fieldErrors: Record<string, string> = {};

  for (const [key, value] of Object.entries(body)) {
    if (key === "detail" || key === "non_field_errors") {
      continue;
    }

    if (typeof value === "string" && value.trim()) {
      fieldErrors[key] = humanizeApiMessage(value);
      continue;
    }

    if (Array.isArray(value)) {
      const firstMessage = value.find(
        (item): item is string => typeof item === "string" && item.trim().length > 0
      );
      if (firstMessage) {
        fieldErrors[key] = humanizeApiMessage(firstMessage);
      }
    }
  }

  return fieldErrors;
}

export function getApiFormError(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : fallback;
  }

  const body = error.body;
  if (typeof body === "object" && body !== null) {
    if (
      "non_field_errors" in body &&
      Array.isArray((body as { non_field_errors?: unknown }).non_field_errors)
    ) {
      const first = (body as { non_field_errors?: unknown[] }).non_field_errors?.find(
        (item): item is string => typeof item === "string" && item.trim().length > 0
      );
      if (first) {
        return humanizeApiMessage(first);
      }
    }

    if ("detail" in body && typeof (body as { detail?: unknown }).detail === "string") {
      return humanizeApiMessage((body as { detail: string }).detail);
    }
  }

  return humanizeApiMessage(error.message || fallback);
}

function broadcastApiAvailability(
  available: boolean,
  reason = ""
): ApiAvailabilityState {
  const state = {
    available,
    checkedAt: new Date().toISOString(),
    reason,
  };

  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(API_STATUS_STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(
      new CustomEvent<ApiAvailabilityState>(API_STATUS_EVENT, {
        detail: state,
      })
    );
  }

  return state;
}

export function getStoredApiAvailabilityState(): ApiAvailabilityState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(API_STATUS_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as ApiAvailabilityState;
  } catch {
    return null;
  }
}

export function isApiUnavailableError(
  error: unknown
): error is ApiUnavailableError {
  return error instanceof ApiUnavailableError;
}

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("massage_saas_token");
}

function getStoredGuestFavoritesToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(GUEST_FAVORITES_TOKEN_KEY);
}

function setStoredGuestFavoritesToken(token: string) {
  if (typeof window === "undefined" || !token) return;
  window.localStorage.setItem(GUEST_FAVORITES_TOKEN_KEY, token);
}

export function setStoredToken(token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("massage_saas_token", token);
  document.cookie = `massage_saas_token=${encodeURIComponent(token)}; Path=/; Max-Age=2592000; SameSite=Lax`;
}

export function clearStoredToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("massage_saas_token");
  document.cookie = "massage_saas_token=; Path=/; Max-Age=0; SameSite=Lax";
}

export function getApiBase() {
  return resolveApiBase().replace(/\/$/, "");
}

export function getApiOrigin() {
  return getApiBase().replace(/\/api$/, "");
}

export async function probeBackendAvailability() {
  try {
    const response = await fetch(`${getApiOrigin()}/health/`, {
      cache: "no-store",
    });

    if (!response.ok) {
      broadcastApiAvailability(
        false,
        "Le service répond, mais son état n'est pas encore exploitable."
      );
      return false;
    }

    broadcastApiAvailability(true);
    return true;
  } catch (error) {
    const reason =
      error instanceof Error
        ? error.message
        : "Connexion impossible avec le serveur.";
    broadcastApiAvailability(false, reason);
    return false;
  }
}

async function isBackendReachable() {
  try {
    const response = await fetch(`${getApiOrigin()}/health/`, {
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

type RequestOptions = RequestInit & {
  auth?: boolean;
};

export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { auth = false, headers, body, ...rest } = options;
  const isFormData = body instanceof FormData;

  const finalHeaders = new Headers(headers || {});
  if (!isFormData && !finalHeaders.has("Content-Type")) {
    finalHeaders.set("Content-Type", "application/json");
  }

  if (auth) {
    const token = getStoredToken();
    if (!token) {
      throw new ApiError("Session introuvable.", 401);
    }
    finalHeaders.set("Authorization", `Token ${token}`);
  }

  let response: Response;

  try {
    response = await fetch(`${getApiBase()}${endpoint}`, {
      ...rest,
      body,
      headers: finalHeaders,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("La requête a été interrompue.", 0, null);
    }

    const reason =
      error instanceof Error
        ? error.message
        : "Connexion impossible avec le serveur.";

    const backendReachable = await isBackendReachable();
    if (backendReachable) {
      broadcastApiAvailability(true);
      throw new ApiError(
        "La requête n’a pas pu aboutir correctement. Réessaie dans quelques instants.",
        0,
        { reason }
      );
    }

    broadcastApiAvailability(false, reason);
    throw new ApiUnavailableError(
      "Service temporairement indisponible. Réessaie dans quelques instants.",
      503,
      { reason }
    );
  }

  if (response.status >= 500) {
    broadcastApiAvailability(
      false,
      "Le serveur rencontre une indisponibilité temporaire."
    );
  } else {
    broadcastApiAvailability(true);
  }

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  let responseBody: unknown = null;
  if (isJson) {
    responseBody = await response.json().catch(() => null);
  } else {
    responseBody = await response.text().catch(() => null);
  }

  if (!response.ok) {
    const message = extractApiErrorMessage(responseBody, response.status);

    if (response.status >= 500) {
      throw new ApiUnavailableError(message, response.status, responseBody);
    }

    throw new ApiError(message, response.status, responseBody);
  }

  return responseBody as T;
}

export type AuthLoginResponse = {
  token: string;
  user: MeResponse;
};

export type MeResponse = {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  role: string;
  admin_role: "" | "admin" | "moderator" | "support" | "ops";
  admin_capabilities: {
    dashboard?: boolean;
    ops?: boolean;
    users?: boolean;
    moderation?: boolean;
    campaigns?: boolean;
    support?: boolean;
    analytics?: boolean;
    ranking?: boolean;
    settings?: boolean;
    super_admin?: boolean;
  };
  onboarding_completed: boolean;
  professional_slug: string;
  professional_name: string;
};

export type AdminSupportUser = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: "admin" | "professional";
  admin_role?: "" | "admin" | "moderator" | "support" | "ops";
  is_active: boolean;
  professional_slug: string;
  professional_name: string;
  city?: string;
  bookings_count?: number;
  average_rating?: string;
  incidents_count?: number;
  payments_total_eur?: string;
  public_profile_url?: string;
  date_joined: string;
};

export type PlatformMessageRecord = {
  id: string;
  recipient_user: string;
  recipient_email: string;
  recipient_name: string;
  category: "support" | "billing" | "moderation" | "product" | "system";
  title: string;
  body: string;
  display_mode: "inbox" | "notice" | "popup";
  reply_allowed: boolean;
  is_read: boolean;
  is_active: boolean;
  sent_at: string;
  read_at: string | null;
  created_by: string | null;
  created_by_email: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AdminAnnouncementRecord = {
  id: string;
  title: string;
  body: string;
  audience_role: "all" | "professional" | "admin";
  display_mode: "notice" | "popup";
  is_active: boolean;
  starts_at: string;
  ends_at: string | null;
  created_by: string | null;
  created_by_email: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type MyPlatformMessagesResponse = {
  messages: Array<{
    id: string;
    category: "support" | "billing" | "moderation" | "product" | "system";
    title: string;
    body: string;
    display_mode: "inbox" | "notice" | "popup";
    reply_allowed: boolean;
    is_read: boolean;
    is_active: boolean;
    sent_at: string;
    read_at: string | null;
  }>;
  announcements: AdminAnnouncementRecord[];
};

export type ModerationIncidentRecord = {
  id: string;
  booking_id: string;
  reporter_type: "client" | "practitioner" | "admin" | "system";
  reported_party_type: "client" | "practitioner" | "platform" | "unknown";
  professional_name: string;
  client_name: string;
  client_email: string;
  category: string;
  description: string;
  status: "open" | "in_review" | "resolved" | "rejected";
  severity: "low" | "medium" | "high" | "critical";
  payout_frozen: boolean;
  admin_notes: string;
  resolution: string;
  resolved_at: string | null;
  created_at: string;
  evidences_count: number;
  restrictions: RestrictionRecord[];
  decisions: Array<{
    id: string;
    decision_type: string;
    notes: string;
    amount_eur: string;
    created_at: string;
    created_by_email: string;
  }>;
};

export type RestrictionRecord = {
  id: string;
  incident: string | null;
  subject_type: "practitioner" | "client_email" | "client_phone" | "user";
  user: string | null;
  professional: string | null;
  professional_name: string;
  client_email: string;
  client_phone: string;
  restriction_type:
    | "warning"
    | "booking_review"
    | "booking_blocked"
    | "payout_suspended"
    | "account_suspended"
    | "banned";
  status: "active" | "expired" | "revoked";
  reason: string;
  notes: string;
  starts_at: string;
  ends_at: string | null;
  created_by: string | null;
  created_by_email: string;
  revoked_by: string | null;
  revoked_by_email: string;
  revoked_at: string | null;
  created_at: string;
};

export type RiskEntryRecord = {
  id: string;
  subject_type: "practitioner" | "client_email" | "client_phone";
  professional: string | null;
  professional_name: string;
  booking: string | null;
  client_email: string;
  client_phone: string;
  risk_level: "none" | "low" | "medium" | "high" | "blocked";
  booking_restriction_status: "none" | "review_required" | "blocked";
  practitioner_trust_status: "none" | "watch" | "restricted" | "suspended";
  reason: string;
  details: string;
  is_active: boolean;
  reviewed_by: string | null;
  reviewed_by_email: string;
  reviewed_at: string | null;
  expires_at: string | null;
  resolved_at: string | null;
  created_at: string;
};

export type ModerationOverview = {
  open_incidents: number;
  in_review_incidents: number;
  critical_incidents: number;
  active_restrictions: number;
  active_risk_entries: number;
};

export type AdminAnalyticsOverview = {
  snapshot_at: string;
  filters?: {
    city?: string;
    visitor_type?: string;
    days?: number;
  };
  kpis: Record<string, number | string>;
  ratios: Record<string, number>;
  tracking_notes: Record<string, string>;
  charts: {
    traffic: Array<{ date: string; value: number }>;
    bookings: Array<{ date: string; value: number }>;
    activation: Array<{ date: string; value: number }>;
  };
  top_cities: Array<{
    city_slug: string;
    city_label: string;
    coverage_percent: number;
    claimed_profiles: number;
    active_profiles: number;
    priority_level: "low" | "medium" | "high" | "critical";
    recommended_action: string;
  }>;
  top_profiles: Array<{
    id: string;
    name: string;
    slug: string;
    city: string;
    average_rating: number;
    bookings_count: number;
  }>;
  traffic_by_city: Array<{
    city_slug: string;
    city_label: string;
    pageviews: number;
  }>;
};

export type AdminDashboardOverview = {
  snapshot_at: string;
  widgets: {
    practitioners_total: number;
    new_signups_day: number;
    new_signups_week: number;
    bookings_total: number;
    bookings_last_week: number;
    revenue_total_eur: string;
    revenue_last_month_eur: string;
    conversion_visit_to_booking: number;
    open_incidents: number;
    growing_cities: number;
    activated_practitioners: number;
  };
  charts: {
    traffic: Array<{ date: string; value: number }>;
    bookings: Array<{ date: string; value: number }>;
    activation: Array<{ date: string; value: number }>;
  };
  top_cities: Array<{
    city_slug: string;
    city_label: string;
    active_profiles: number;
    claimed_profiles: number;
    objective_profiles_total: number;
    coverage_percent: number;
    recommended_action: string;
  }>;
  top_profiles: Array<{
    id: string;
    name: string;
    slug: string;
    city: string;
    average_rating: number;
    bookings_count: number;
    is_public: boolean;
  }>;
};

export type AdminUserDirectoryRecord = AdminSupportUser & {
  city: string;
  bookings_count: number;
  average_rating: string;
  incidents_count: number;
  payments_total_eur: string;
  public_profile_url: string;
};

export type AdminCampaignOverview = {
  summary: {
    total_campaigns: number;
    active_campaigns: number;
    sent_messages: number;
    failed_messages: number;
  };
};

export type AdminRankingRow = {
  id: string;
  slug: string;
  business_name: string;
  city: string;
  is_public: boolean;
  verification_badge_status: "none" | "pending" | "verified" | "suspended" | "expired";
  manual_visibility_boost: number;
  profile_completeness_score: number;
  profile_visibility_score: number;
  ranking_signals: {
    services_count: number;
    open_slots_count: number;
    reviews_count: number;
    bookings_count: number;
    completed_bookings_count: number;
    manual_visibility_boost: number;
    low_quality_signals: number;
    accepts_online_booking: boolean;
    verification_badge_status: "none" | "pending" | "verified" | "suspended" | "expired";
  };
};

export type AdminPlatformSettingsSnapshot = {
  platform: {
    frontend_app_url: string;
    stripe_live_enabled: boolean;
    stripe_internal_test_mode: boolean;
    cookie_consent_enabled: boolean;
    practitioner_verification_enabled: boolean;
    review_replies_enabled: boolean;
  };
  defaults: Record<string, string | number>;
  support: Record<string, string | number>;
  safety: Record<string, string | number | boolean>;
};

export type DashboardProfileRankingSignals = {
  services_count: number;
  open_slots_count: number;
  reviews_count: number;
  bookings_count: number;
  completed_bookings_count: number;
  low_quality_signals: number;
  verification_badge_status: "none" | "pending" | "verified" | "suspended" | "expired";
  accepts_online_booking: boolean;
  completeness_signals: {
    bio: boolean;
    headline: boolean;
    city: boolean;
    photos: boolean;
    services: boolean;
    availabilities: boolean;
    specialties: boolean;
    contact: boolean;
    booking_rules: boolean;
  };
};

export type DashboardProfile = {
  id: string;
  business_name: string;
  slug: string;
  owner_first_name: string;
  owner_last_name: string;
  login_email: string;
  activity_type: "solo" | "studio" | "spa" | "team";
  practice_mode: "studio" | "home" | "mobile" | "corporate" | "mixed";
  city: string;
  service_area: string;
  venue_details: string;
  access_details: string;
  ambience_details: string;
  equipment_provided: string;
  client_preparation: string;
  ideal_for: string;
  highlight_points: string[];
  bio: string;
  public_headline: string;
  specialties: string[];
  visual_theme: "epure" | "chaleur" | "prestige";
  phone: string;
  public_email: string;
  website_url: string;
  instagram_url: string;
  facebook_url: string;
  tiktok_url: string;
  is_public: boolean;
  accepts_online_booking: boolean;
  reservation_payment_mode: "none" | "deposit" | "full";
  deposit_value_type: "fixed" | "percentage";
  deposit_value: string;
  free_cancellation_notice_hours: number;
  keep_payment_after_deadline: boolean;
  payment_message: string;
  payment_account: PaymentAccount | null;
  verification: PractitionerVerification;
  profile_completeness_score: number;
  profile_visibility_score: number;
  ranking_signals: DashboardProfileRankingSignals;
  profile_photo_url: string;
  cover_photo_url: string;
  onboarding_step:
    | "welcome"
    | "activity"
    | "services"
    | "setting"
    | "slots"
    | "ready";
  onboarding_completed: boolean;
};

export type PublicProfessional = {
  id: string;
  business_name: string;
  slug: string;
  activity_type: DashboardProfile["activity_type"];
  practice_mode: DashboardProfile["practice_mode"];
  city: string;
  service_area: string;
  venue_details: string;
  access_details: string;
  ambience_details: string;
  equipment_provided: string;
  client_preparation: string;
  ideal_for: string;
  highlight_points: string[];
  bio: string;
  public_headline: string;
  specialties: string[];
  visual_theme: "epure" | "chaleur" | "prestige";
  phone: string;
  public_email: string;
  website_url: string;
  instagram_url: string;
  facebook_url: string;
  tiktok_url: string;
  accepts_online_booking: boolean;
  reservation_payment_mode: DashboardProfile["reservation_payment_mode"];
  deposit_value_type: DashboardProfile["deposit_value_type"];
  deposit_value: string;
  free_cancellation_notice_hours: number;
  keep_payment_after_deadline: boolean;
  payment_message: string;
  payment_account: PaymentAccount | null;
  profile_photo_url: string;
  cover_photo_url: string;
  practice_information: string;
  before_session: string;
  after_session: string;
  booking_policy: string;
  contact_information: string;
  faq_items: AssistantFaqItem[];
  reviews: ReviewPublicItem[];
  review_average: number | null;
  review_count: number;
  verification_badge: VerificationBadge | null;
};

export type DirectoryListing = {
  id: string;
  listing_kind: "claimed" | "unclaimed";
  listing_url: string;
  business_name: string;
  slug: string;
  city: string;
  service_area: string;
  public_headline: string;
  bio: string;
  specialties: string[];
  massage_categories: string[];
  visual_theme: string;
  profile_photo_url: string;
  cover_photo_url: string;
  accepts_online_booking: boolean;
  verification_badge: VerificationBadge | null;
  claim_notice: string;
};

export type DirectoryCandidate = {
  id: string;
  status: string;
  business_name: string;
  slug: string;
  city: string;
  service_area: string;
  public_headline: string;
  bio: string;
  specialties: string[];
  massage_categories: string[];
  source_label: string;
  source_url: string;
  imported_at: string;
  claim_notice: string;
};

export type ImportedPublicProfile = {
  id: string;
  listing_kind: "unclaimed";
  listing_url: string;
  slug: string;
  public_name: string;
  business_name: string;
  city: string;
  region: string;
  phone_public: string;
  email_public: string;
  website_url: string;
  instagram_url: string;
  service_tags_json: string[];
  practice_modes_json: string[];
  bio_short: string;
  address_public_text: string;
  has_public_booking_link: boolean;
  public_status_note: string;
  claim_notice: string;
};

export type UnifiedPublicPractitioner = {
  kind: "claimed" | "unclaimed";
  claimed_profile: PublicProfessional | null;
  imported_profile: ImportedPublicProfile | null;
};

export type SourceRegistryRecord = {
  id: string;
  name: string;
  base_url: string;
  source_type:
    | "manual_csv"
    | "manual_form"
    | "api"
    | "rss"
    | "parser_custom";
  is_active: boolean;
  legal_status: "pending_review" | "approved" | "blocked" | "retired";
  tos_url: string;
  robots_url: string;
  notes_internal: string;
  import_policy_json: Record<string, unknown>;
  allowed_fields_json: string[];
  requires_manual_review_before_publish: boolean;
  can_contact_imported_profiles: boolean;
  default_visibility_mode: "private_draft" | "unclaimed_public";
  reviewed_by_email: string;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SourceImportJobRecord = {
  id: string;
  source: string;
  source_name: string;
  trigger_type: "manual" | "scheduled" | "api_push";
  status:
    | "queued"
    | "running"
    | "completed"
    | "partial_failed"
    | "failed"
    | "cancelled";
  started_at: string | null;
  finished_at: string | null;
  created_by_email: string;
  total_seen: number;
  total_created: number;
  total_updated: number;
  total_skipped: number;
  total_flagged: number;
  error_log_text: string;
  raw_report_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ImportedProfileRecord = {
  id: string;
  source: string;
  source_name: string;
  source_job: string | null;
  external_id: string;
  source_url: string;
  source_snapshot_json: Record<string, unknown>;
  imported_at: string;
  last_seen_at: string;
  import_status:
    | "draft_imported"
    | "pending_review"
    | "approved_internal"
    | "published_unclaimed"
    | "claimed"
    | "rejected"
    | "removed";
  dedupe_key: string;
  confidence_score: string;
  review_notes: string;
  reviewed_by_email: string;
  reviewed_at: string | null;
  slug: string;
  public_name: string;
  business_name: string;
  city: string;
  postal_code: string;
  region: string;
  country: string;
  phone_public: string;
  email_public: string;
  website_url: string;
  instagram_url: string;
  service_tags_json: string[];
  practice_modes_json: string[];
  bio_short: string;
  address_public_text: string;
  has_public_booking_link: boolean;
  public_status_note: string;
  contains_personal_data: boolean;
  contact_allowed_based_on_source_policy: boolean;
  publishable_minimum_ok: boolean;
  removal_requested: boolean;
  claimable: boolean;
  is_public: boolean;
  duplicate_signals: string[];
  created_at: string;
  updated_at: string;
};

export type ContactCampaignRecord = {
  id: string;
  name: string;
  source: string | null;
  campaign_type:
    | "claim_invite"
    | "incomplete_profile_nudge"
    | "source_recontact"
    | "seo"
    | "boost"
    | "acquisition"
    | "email";
  status: "draft" | "ready" | "sending" | "paused" | "completed" | "cancelled";
  campaign_scope_type: "global" | "city" | "department" | "region" | "source";
  campaign_scope_value: string;
  city: string;
  department_code: string;
  region: string;
  audience_filter_json: Record<string, unknown>;
  email_template_key: string;
  campaign_message: string;
  budget_eur: string | null;
  created_by_email: string;
  approved_by_email: string;
  approved_at: string | null;
  total_targets: number;
  total_sent: number;
  total_failed: number;
  created_at: string;
  updated_at: string;
};

export type RemovalRequestRecord = {
  id: string;
  imported_profile: string | null;
  imported_profile_name: string;
  requester_email: string;
  requester_name: string;
  reason: string;
  status: "received" | "pending_review" | "completed" | "rejected";
  created_at: string;
  resolved_at: string | null;
  notes: string;
};

export type ClaimVerificationResponse = {
  status: "verified";
  claim: { token: string; email: string };
  profile: ImportedPublicProfile;
};

export type ClaimCompletionResponse = {
  status: "approved";
  token: string;
  user: {
    email: string;
    role: "admin" | "professional";
    professional_slug: string;
    professional_name: string;
    onboarding_completed: boolean;
  };
};

export type MeClaimStatus = {
  has_import_origin: boolean;
  imported_profile_id: string;
  imported_profile_status: string;
  imported_profile_slug: string;
};

export type VerificationBadge = {
  label: string;
  verified_at: string | null;
  expires_at: string | null;
  tooltip: string;
};

export type PaymentAccount = {
  provider: "stripe_connect";
  onboarding_status: "not_started" | "pending" | "active" | "restricted";
  stripe_account_id: string;
  account_email: string;
  country: string;
  default_currency: string;
  details_submitted: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
};

export type PractitionerVerification = {
  status:
    | "not_started"
    | "pending"
    | "in_review"
    | "verified"
    | "rejected"
    | "expired";
  siren: string;
  siret: string;
  beneficiary_name: string;
  iban_last4: string;
  identity_document_url: string;
  selfie_document_url: string;
  activity_document_url: string;
  liability_insurance_document_url: string;
  iban_document_url: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  verified_at: string | null;
  expires_at: string | null;
  rejection_reason: string;
  internal_notes: string;
  badge_is_active: boolean;
  badge_tooltip: string;
  decisions: Array<{
    id: string;
    from_status: string;
    to_status: string;
    reason: string;
    decided_by_email: string;
    created_at: string;
  }>;
};

export type AssistantFaqItem = {
  question: string;
  answer: string;
};

export type AssistantProfile = {
  id: string;
  assistant_enabled: boolean;
  welcome_message: string;
  activity_overview: string;
  general_guidance: string;
  support_style: string;
  practice_information: string;
  faq_items: AssistantFaqItem[];
  before_session: string;
  after_session: string;
  service_information: string;
  booking_policy: string;
  contact_information: string;
  business_rules: string;
  guardrails: string;
  avoid_topics: string;
  assistant_notes: string;
  internal_context: string;
  response_tone:
    | "rassurant"
    | "apaisant"
    | "chaleureux"
    | "professionnel"
    | "premium"
    | "sobre";
  public_assistant_enabled: boolean;
};

export type AssistantReply = {
  answer: string;
  cautious: boolean;
};

export type PublicAssistant = {
  assistant_enabled: boolean;
  public_assistant_enabled: boolean;
  welcome_message: string;
  response_tone: AssistantProfile["response_tone"];
  starter_questions: string[];
};

export type Service = {
  id: string;
  title: string;
  short_description: string;
  full_description: string;
  service_category: "" | "relaxant" | "deep_tissue" | "tantrique";
  duration_minutes: number;
  price_eur: string;
  is_active: boolean;
  sort_order: number;
};

export type CreateServicePayload = {
  title: string;
  short_description: string;
  full_description: string;
  service_category?: "" | "relaxant" | "deep_tissue" | "tantrique";
  duration_minutes: number;
  price_eur: string;
  is_active?: boolean;
  sort_order?: number;
};

export type PublicService = {
  id: string;
  professional_slug: string;
  professional_name: string;
  title: string;
  short_description: string;
  full_description: string;
  service_category: "" | "relaxant" | "deep_tissue" | "tantrique";
  duration_minutes: number;
  price_eur: string;
};

export type Availability = {
  id: string;
  service: string | null;
  service_title: string;
  start_at: string;
  end_at: string;
  slot_type: "open" | "blocked";
  label: string;
  is_active: boolean;
  booking_status: BookingStatus | "";
  booking_client_name: string;
  agenda_state: AgendaState;
};

export type PublicAvailability = {
  id: string;
  start_at: string;
  end_at: string;
  service: string | null;
  service_title: string;
};

export type CreateAvailabilityPayload = {
  service: string | null;
  start_at: string;
  end_at: string;
  slot_type?: "open" | "blocked";
  label?: string;
  is_active?: boolean;
};

export type BookingStatus = "pending" | "confirmed" | "canceled";
export type PaymentStatus =
  | "none_required"
  | "payment_required"
  | "deposit_required"
  | "payment_pending"
  | "payment_authorized"
  | "payment_captured"
  | "partially_refunded"
  | "refunded"
  | "canceled";
export type PayoutStatus =
  | "not_applicable"
  | "payout_pending"
  | "payout_ready"
  | "payout_released"
  | "payout_blocked";
export type FulfillmentStatus =
  | "scheduled"
  | "client_arrived"
  | "in_progress"
  | "completed_by_practitioner"
  | "completed_validated_by_client"
  | "disputed"
  | "auto_completed";
export type AgendaState =
  | "free"
  | "pending"
  | "confirmed"
  | "canceled"
  | "blocked"
  | "inactive";

export type Booking = {
  id: string;
  status: BookingStatus;
  payment_status: PaymentStatus;
  payment_mode: DashboardProfile["reservation_payment_mode"];
  payment_collection_method: "none" | "platform" | "on_site";
  payment_channel:
    | "none"
    | "platform"
    | "cash"
    | "bank_transfer"
    | "card_reader"
    | "other";
  payout_status: PayoutStatus;
  fulfillment_status: FulfillmentStatus;
  service: string;
  service_title: string;
  slot: string;
  start_at: string;
  end_at: string;
  client_first_name: string;
  client_last_name: string;
  client_email: string;
  client_phone: string;
  client_note: string;
  total_price_eur: string;
  amount_due_now_eur: string;
  amount_received_eur: string;
  amount_remaining_eur: string;
  amount_refunded_eur: string;
  platform_fee_eur: string;
  payout_amount_eur: string;
  payment_message: string;
  payment_due_expires_at: string | null;
  payment_authorized_at: string | null;
  payment_captured_at: string | null;
  payout_ready_at: string | null;
  payout_released_at: string | null;
  service_validation_requested_at: string | null;
  client_arrived_at: string | null;
  service_started_at: string | null;
  service_completed_at: string | null;
  client_validated_at: string | null;
  auto_completed_at: string | null;
  issue_opened_at: string | null;
  issue_opened_by_role: "client" | "practitioner" | "platform" | "system";
  issue_reason: string;
  client_no_show_at: string | null;
  practitioner_no_show_at: string | null;
  canceled_by_role: "client" | "practitioner" | "platform" | "system";
  cancellation_reason: string;
  refund_decision_source: "none" | "automatic_policy" | "manual_practitioner" | "support";
  trust_exemption_applied: boolean;
  provider_checkout_session_id: string;
  payment_summary: string;
  payout_summary: string;
  timeline: BookingTimelineItem[];
  created_at: string;
};

export type BookingTimelineItem = {
  id: string;
  created_at: string;
  event_type: string;
  message: string;
  actor_role: "client" | "practitioner" | "platform" | "system";
};

export type AgendaBookingSummary = {
  id: string;
  status: BookingStatus;
  service_title: string;
  start_at: string;
  end_at: string;
  client_name: string;
};

export type AgendaItem = {
  id: string;
  start_at: string;
  end_at: string;
  slot_type: "open" | "blocked";
  label: string;
  service: string | null;
  service_title: string;
  agenda_state: AgendaState;
  booking: AgendaBookingSummary | null;
};

export type AgendaDay = {
  date: string;
  overview: {
    free_slots: number;
    blocked_slots: number;
    pending_bookings: number;
    confirmed_bookings: number;
    total_slots: number;
  };
  timeline: AgendaItem[];
  upcoming_bookings: AgendaBookingSummary[];
  recent_cancellations: AgendaBookingSummary[];
};

export type CreatePublicBookingPayload = {
  professional_slug: string;
  service_id: string;
  slot_id: string;
  client_first_name: string;
  client_last_name: string;
  client_email: string;
  client_phone?: string;
  client_note?: string;
  accept_cgu: boolean;
  accept_cgv: boolean;
  accept_cancellation_policy: boolean;
};

export type PublicBookingVerificationPending = {
  id: string;
  verification_status: "pending" | "verified" | "expired" | "blocked" | "completed" | "canceled";
  masked_email: string;
  expires_at: string | null;
  verification_resend_count: number;
  message: string;
};

export type PublicBookingCreated = {
  id: string;
  status: BookingStatus;
  payment_status: PaymentStatus;
  payment_mode: DashboardProfile["reservation_payment_mode"];
  service_title: string;
  professional_name: string;
  start_at: string;
  end_at: string;
  total_price_eur: string;
  amount_due_now_eur: string;
  amount_received_eur: string;
  amount_remaining_eur: string;
  payment_message: string;
  cancellation_policy_summary: string;
  payment_requires_action: boolean;
  checkout_url: string;
  checkout_session_id: string;
  payment_test_mode: boolean;
  guest_access_token: string;
  client_first_name: string;
  client_last_name: string;
  client_email: string;
};

export type BookingThreadMessage = {
  id: string;
  sender_role: "client" | "practitioner" | "admin" | "system";
  guest_email: string;
  body: string;
  contains_external_link: boolean;
  is_flagged: boolean;
  created_at: string;
};

export type BookingIncident = {
  id: string;
  reporter_type: "client" | "practitioner" | "admin" | "system";
  reported_party_type: "client" | "practitioner" | "platform" | "unknown";
  category: string;
  description: string;
  status: "open" | "in_review" | "resolved" | "rejected";
  severity: "low" | "medium" | "high" | "critical";
  payout_frozen: boolean;
  admin_notes: string;
  resolution: string;
  resolved_at: string | null;
  created_at: string;
  evidences_count: number;
};

export type PaymentOverview = {
  collected_platform_eur: string;
  collected_off_platform_eur: string;
  deposits_captured_eur: string;
  remaining_to_collect_eur: string;
  refunded_eur: string;
  payouts_pending_eur: string;
  payouts_released_eur: string;
  by_channel: Array<{
    channel: Booking["payment_channel"];
    label: string;
    amount_eur: string;
  }>;
  recent_movements: PaymentMovement[];
};

export type PaymentMovement = {
  id: string;
  kind: "deposit" | "full" | "refund" | "manual_collection" | "payout";
  status:
    | "pending"
    | "requires_action"
    | "authorized"
    | "captured"
    | "partially_refunded"
    | "refunded"
    | "released"
    | "failed"
    | "canceled";
  provider: "stripe_connect" | "manual" | "system";
  amount_eur: string;
  currency: string;
  created_at: string;
};

export type TrustedClient = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  waive_deposit: boolean;
  allow_pay_on_site: boolean;
  notes: string;
  is_active: boolean;
  created_at: string;
};

export type ReviewPublicItem = {
  id: string;
  author_name: string;
  rating: number;
  comment: string;
  source: "booking" | "invitation" | "legacy";
  verification_type:
    | "booked_on_platform"
    | "invited_by_practitioner"
    | "imported_legacy_customer";
  verification_label: string;
  experience_date: string | null;
  practitioner_response: string;
  practitioner_responded_at: string | null;
  published_at: string | null;
};

export type ReviewPractitionerItem = ReviewPublicItem & {
  status: "pending" | "approved" | "rejected" | "hidden";
  flag_reason: string;
  moderation_flags: string[];
  created_at: string;
};

export type RuntimeConfig = {
  features: {
    cookie_consent: boolean;
    practitioner_verification: boolean;
    review_replies: boolean;
  };
  cookie_consent_version: string;
  legal_documents: Record<string, { title: string; version: string }>;
};

export type ReviewInvitation = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  source: "manual" | "booking" | "legacy";
  expires_at: string;
  sent_at: string | null;
  used_at: string | null;
  usage_count: number;
  created_at: string;
};

export type DirectoryInterestPayload = {
  kind: "suggest_practitioner" | "recommend_masseur" | "city_waitlist";
  full_name: string;
  email: string;
  city: string;
  practitioner_name: string;
  message: string;
  source_page: string;
};

export type FavoritePractitioner = {
  id: string;
  business_name: string;
  slug: string;
  city: string;
  public_headline: string;
  profile_photo_url: string;
  verification_badge: VerificationBadge | null;
  created_at: string;
};

export type GuestFavoritesResponse = {
  collection_token: string;
  favorites: FavoritePractitioner[];
};

export type LocationSuggestion = {
  kind: "city" | "postal_code" | "department" | "region" | "country";
  label: string;
  slug: string;
  city: string;
  postal_code: string;
  department_name: string;
  region: string;
  country: string;
  directory_url: string;
};

export type PractitionerContactTag = {
  id: string;
  label: string;
  created_at: string;
};

export type PractitionerContact = {
  id: string;
  display_name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  booking_count: number;
  validated_booking_count: number;
  canceled_booking_count: number;
  no_show_count: number;
  disputed_booking_count: number;
  first_booking_at: string | null;
  last_booking_at: string | null;
  last_validated_at: string | null;
  segment:
    | "new"
    | "active"
    | "loyal"
    | "never_seen"
    | "canceled"
    | "no_show"
    | "watch"
    | "dispute"
    | "blocked"
    | "inactive";
  segment_label: string;
  segment_score: number;
  segment_reasons_json: string[];
  risk_level: "none" | "low" | "medium" | "high" | "blocked";
  risk_label: string;
  is_trusted: boolean;
  private_note: string;
  tags: PractitionerContactTag[];
  created_at: string;
  updated_at: string;
};

export type CityCoverageMetric = {
  plan_id: string;
  city_label: string;
  city_slug: string;
  department_code: string;
  region: string;
  objective_profiles_total: number;
  objective_claimed_profiles: number;
  objective_active_profiles: number;
  priority_level: "low" | "medium" | "high" | "critical";
  growth_status:
    | "empty"
    | "seed"
    | "building"
    | "healthy"
    | "saturated"
    | "deprioritized";
  computed_growth_status:
    | "empty"
    | "seed"
    | "building"
    | "healthy"
    | "saturated"
    | "deprioritized";
  is_active: boolean;
  total_profiles: number;
  claimed_profiles: number;
  unclaimed_profiles: number;
  active_profiles: number;
  suggestions_count: number;
  suggestions_unprocessed_count: number;
  campaigns_count: number;
  contacts_sent: number;
  claims_opened: number;
  claims_validated: number;
  claim_rate: number;
  coverage_percent: number;
  recommendations: string[];
  recommended_action: string;
  notes_internal: string;
};

export type CityAcquisitionFunnel = {
  city_label: string;
  city_slug: string;
  suggestions_received: number;
  suggestions_unprocessed: number;
  profiles_imported: number;
  profiles_in_review: number;
  profiles_published_unclaimed: number;
  invitations_sent: number;
  claims_opened: number;
  claims_validated: number;
  profiles_claimed: number;
  profiles_public_active: number;
};

export type DirectoryInterestLeadRecord = {
  id: string;
  kind: DirectoryInterestPayload["kind"];
  kind_label: string;
  full_name: string;
  email: string;
  city: string;
  city_slug: string;
  location_type: "city" | "department" | "region" | "postal_code";
  practitioner_name: string;
  message: string;
  source_page: string;
  ops_status: "new" | "in_review" | "converted" | "ignored" | "contacted";
  converted_to_imported_profile: string | null;
  converted_to_imported_profile_slug: string;
  assigned_to: string | null;
  assigned_to_email: string;
  ops_notes: string;
  processed: boolean;
  created_at: string;
  updated_at: string;
};

export async function loginWithEmailPassword(payload: {
  email: string;
  password: string;
}) {
  return apiRequest<AuthLoginResponse>("/auth/token/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function registerPractitioner(payload: {
  first_name: string;
  last_name: string;
  business_name: string;
  email: string;
  password: string;
  password_confirmation: string;
  accepted_documents: string[];
}) {
  return apiRequest<AuthLoginResponse>("/auth/register/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getMe() {
  return apiRequest<MeResponse>("/auth/me/", {
    method: "GET",
    auth: true,
  });
}

export async function trackPageView(payload: {
  path: string;
  page_group?: string;
  city_slug?: string;
  referrer?: string;
  session_key?: string;
  metadata?: Record<string, unknown>;
}) {
  return apiRequest<{ id: string }>("/analytics/page-views/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getMyPlatformMessages() {
  return apiRequest<MyPlatformMessagesResponse>("/me/platform-messages", {
    method: "GET",
    auth: true,
  });
}

export async function markPlatformMessageRead(id: string) {
  return apiRequest<{ id: string }>(`/me/platform-messages/${id}`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify({ mark_read: true }),
  });
}

export async function getDashboardProfile() {
  return apiRequest<DashboardProfile>("/dashboard/profile/", {
    method: "GET",
    auth: true,
  });
}

export async function getRuntimeConfig() {
  return apiRequest<RuntimeConfig>("/runtime-config/", {
    method: "GET",
  });
}

export async function updateDashboardProfile(data: FormData) {
  return apiRequest<DashboardProfile>("/dashboard/profile/", {
    method: "PATCH",
    auth: true,
    body: data,
  });
}

export async function getPractitionerVerification() {
  return apiRequest<PractitionerVerification>("/dashboard/verification/", {
    method: "GET",
    auth: true,
  });
}

export async function updatePractitionerVerification(data: FormData) {
  return apiRequest<PractitionerVerification>("/dashboard/verification/", {
    method: "PATCH",
    auth: true,
    body: data,
  });
}

export async function getPublicProfessional(slug: string) {
  return apiRequest<PublicProfessional>(`/professionals/${slug}/`, {
    method: "GET",
  });
}

export async function getPublicProfessionals(filters?: {
  city?: string;
  q?: string;
  category?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.city) {
    params.set("city", filters.city);
  }
  if (filters?.q) {
    params.set("q", filters.q);
  }
  if (filters?.category) {
    params.set("category", filters.category);
  }
  const query = params.toString();
  return apiRequest<PublicProfessional[]>(
    `/professionals/${query ? `?${query}` : ""}`,
    {
    method: "GET",
    }
  );
}

export async function getDirectoryListings(filters?: {
  city?: string;
  q?: string;
  category?: string;
  locationType?: string;
  locationSlug?: string;
}) {
  return getPublicDirectoryListings(filters);
}

export async function getPublicDirectoryListings(filters?: {
  city?: string;
  q?: string;
  category?: string;
  locationType?: string;
  locationSlug?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.city) {
    params.set("city", filters.city);
  }
  if (filters?.q) {
    params.set("q", filters.q);
  }
  if (filters?.category) {
    params.set("category", filters.category);
  }
  if (filters?.locationType) {
    params.set("location_type", filters.locationType);
  }
  if (filters?.locationSlug) {
    params.set("location_slug", filters.locationSlug);
  }
  const query = params.toString();
  return apiRequest<DirectoryListing[]>(
    `/public/directory-listings${query ? `?${query}` : ""}`,
    {
      method: "GET",
    }
  );
}

export async function getDirectoryCandidate(slug: string) {
  const data = await getUnifiedPublicPractitioner(slug);
  if (data.kind !== "unclaimed" || !data.imported_profile) {
    throw new Error("Cette fiche candidate n’est pas disponible.");
  }
  return {
    id: data.imported_profile.id,
    status: "published_unclaimed",
    business_name: data.imported_profile.business_name || data.imported_profile.public_name,
    slug: data.imported_profile.slug,
    city: data.imported_profile.city,
    service_area: data.imported_profile.region,
    public_headline: data.imported_profile.public_status_note,
    bio: data.imported_profile.bio_short,
    specialties: data.imported_profile.service_tags_json,
    massage_categories: data.imported_profile.service_tags_json,
    source_label: "",
    source_url: "",
    imported_at: "",
    claim_notice: data.imported_profile.claim_notice,
  } satisfies DirectoryCandidate;
}

export async function submitDirectoryClaimRequest(
  slug: string,
  payload: {
    claimant_name: string;
    claimant_email: string;
    claimant_phone?: string;
    message?: string;
  }
) {
  const candidate = await getDirectoryCandidate(slug);
  const result = await requestImportedProfileClaim(candidate.id, payload.claimant_email);
  return {
    status: result.status,
    message: "La demande de revendication a bien été enregistrée.",
    request_id: result.claim_id,
  };
}

export async function submitDirectoryRemovalRequest(
  slug: string,
  payload: {
    requester_name: string;
    requester_email: string;
    reason?: string;
  }
) {
  const result = await createRemovalRequest({
    slug_or_id: slug,
    requester_email: payload.requester_email,
    requester_name: payload.requester_name,
    reason: payload.reason || "",
  });
  return {
    status: result.status,
    message: "La demande de suppression a bien été enregistrée.",
    request_id: result.request_id,
  };
}

export async function submitDirectoryInterest(payload: DirectoryInterestPayload) {
  return apiRequest<DirectoryInterestPayload>("/directory/interests/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getGuestFavorites() {
  const token = getStoredGuestFavoritesToken();
  const headers = token ? { "X-Guest-Favorites-Token": token } : undefined;
  const response = await apiRequest<GuestFavoritesResponse>("/public/favorites", {
    method: "GET",
    headers,
  });
  if (response.collection_token) {
    setStoredGuestFavoritesToken(response.collection_token);
  }
  return response;
}

export async function addGuestFavorite(professionalSlug: string) {
  const token = getStoredGuestFavoritesToken();
  const headers = token ? { "X-Guest-Favorites-Token": token } : undefined;
  const response = await apiRequest<{
    collection_token: string;
    added: boolean;
    favorite: FavoritePractitioner;
  }>("/public/favorites", {
    method: "POST",
    headers,
    body: JSON.stringify({ professional_slug: professionalSlug, token }),
  });
  if (response.collection_token) {
    setStoredGuestFavoritesToken(response.collection_token);
  }
  return response;
}

export async function removeGuestFavorite(professionalSlug: string) {
  const token = getStoredGuestFavoritesToken();
  const headers = token ? { "X-Guest-Favorites-Token": token } : undefined;
  return apiRequest<void>(`/public/favorites/${professionalSlug}`, {
    method: "DELETE",
    headers,
  });
}

export async function getLocationSuggestions(query: string) {
  const params = new URLSearchParams();
  if (query.trim()) {
    params.set("q", query.trim());
  }
  return apiRequest<LocationSuggestion[]>(
    `/public/location-suggestions${params.toString() ? `?${params.toString()}` : ""}`,
    {
      method: "GET",
    }
  );
}

export async function getUnifiedPublicPractitioner(slug: string) {
  return apiRequest<UnifiedPublicPractitioner>(`/public/practitioners/${slug}`, {
    method: "GET",
  });
}

export async function requestImportedProfileClaim(id: string, email: string) {
  return apiRequest<{ status: string; claim_id: string }>(
    `/public/imported-profiles/${id}/request-claim`,
    {
      method: "POST",
      body: JSON.stringify({ email }),
    }
  );
}

export async function createRemovalRequest(payload: {
  slug_or_id: string;
  requester_email: string;
  requester_name: string;
  reason: string;
}) {
  return apiRequest<{ status: string; request_id: string }>("/public/removal-request", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function verifyClaimToken(token: string) {
  return apiRequest<ClaimVerificationResponse>("/public/claim/verify", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function completeClaimOnboarding(payload: {
  token: string;
  first_name?: string;
  last_name?: string;
  business_name?: string;
  email?: string;
  password?: string;
  password_confirmation?: string;
  accepted_documents?: string[];
}) {
  return apiRequest<ClaimCompletionResponse>("/public/claim/complete-onboarding", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getMeClaimStatus() {
  return apiRequest<MeClaimStatus>("/me/claim-status", {
    auth: true,
  });
}

export async function completeProfileFromImport(payload: {
  imported_profile_id?: string;
  claim_token?: string;
}) {
  return apiRequest<{ status: string; professional_slug: string }>(
    "/me/complete-profile-from-import",
    {
      method: "POST",
      auth: true,
      body: JSON.stringify(payload),
    }
  );
}

export async function getAdminSources() {
  return apiRequest<SourceRegistryRecord[]>("/admin/sources", {
    auth: true,
  });
}

export async function createAdminSource(payload: Partial<SourceRegistryRecord>) {
  return apiRequest<SourceRegistryRecord>("/admin/sources", {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function updateAdminSource(id: string, payload: Partial<SourceRegistryRecord>) {
  return apiRequest<SourceRegistryRecord>(`/admin/sources/${id}`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function runAdminSourceImport(params: {
  sourceId: string;
  file?: File;
  mapping?: Record<string, string>;
  payloadText?: string;
  dryRun?: boolean;
}) {
  const formData = new FormData();
  if (params.file) {
    formData.append("file", params.file);
  }
  if (params.payloadText) {
    formData.append("payload_text", params.payloadText);
  }
  formData.append("mapping", JSON.stringify(params.mapping || {}));
  formData.append("dry_run", params.dryRun ? "true" : "false");
  return apiRequest<{
    job_id: string;
    dry_run: boolean;
    summary: {
      total_seen: number;
      total_created: number;
      total_updated: number;
      total_skipped: number;
      total_flagged: number;
    };
    report: Record<string, unknown>;
  }>(`/admin/sources/${params.sourceId}/run-import`, {
    method: "POST",
    auth: true,
    body: formData,
  });
}

export async function getAdminImportJobs() {
  return apiRequest<SourceImportJobRecord[]>("/admin/import-jobs", {
    auth: true,
  });
}

export async function getAdminImportJob(id: string) {
  return apiRequest<SourceImportJobRecord>(`/admin/import-jobs/${id}`, {
    auth: true,
  });
}

export async function getAdminImportedProfiles(filters?: {
  import_status?: string;
  source?: string;
  city?: string;
  claimable?: string;
  publishable_minimum_ok?: string;
  probable_duplicates?: boolean;
}) {
  const params = new URLSearchParams();
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });
  const query = params.toString();
  return apiRequest<ImportedProfileRecord[]>(
    `/admin/imported-profiles${query ? `?${query}` : ""}`,
    {
      auth: true,
    }
  );
}

export async function createAdminImportedProfile(payload: Partial<ImportedProfileRecord>) {
  return apiRequest<ImportedProfileRecord>("/admin/imported-profiles", {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function bulkActionImportedProfiles(payload: {
  ids: string[];
  action:
    | "approve_internal"
    | "publish_unclaimed"
    | "reject"
    | "mark_removed"
    | "send_claim_invite"
    | "merge"
    | "export_csv";
  target_id?: string;
}) {
  return apiRequest<{ updated: number; details: Array<Record<string, unknown>> }>(
    "/admin/imported-profiles/bulk-action",
    {
      method: "POST",
      auth: true,
      body: JSON.stringify(payload),
    }
  );
}

export async function createContactCampaign(payload: Partial<ContactCampaignRecord>) {
  return apiRequest<ContactCampaignRecord>("/admin/contact-campaigns", {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function getAdminContactCampaigns() {
  return apiRequest<ContactCampaignRecord[]>("/admin/contact-campaigns", {
    auth: true,
  });
}

export async function sendContactCampaign(id: string) {
  return apiRequest<{ sent: number; failed: number; total_targets: number }>(
    `/admin/contact-campaigns/${id}/send`,
    {
      method: "POST",
      auth: true,
    }
  );
}

export async function getRemovalRequests(status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiRequest<RemovalRequestRecord[]>(`/admin/removal-requests${query}`, {
    auth: true,
  });
}

export async function getAdminModerationOverview() {
  return apiRequest<ModerationOverview>("/admin/moderation/overview", {
    auth: true,
  });
}

export async function getAdminModerationIncidents(filters?: {
  status?: string;
  severity?: string;
  category?: string;
  reported_party_type?: string;
  reporter_type?: string;
  q?: string;
}) {
  const params = new URLSearchParams();
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });
  return apiRequest<ModerationIncidentRecord[]>(
    `/admin/moderation/incidents${params.toString() ? `?${params.toString()}` : ""}`,
    { auth: true }
  );
}

export async function getAdminModerationIncident(id: string) {
  return apiRequest<ModerationIncidentRecord>(`/admin/moderation/incidents/${id}`, {
    auth: true,
  });
}

export async function decideAdminModerationIncident(
  id: string,
  payload: { decision_type: "dismiss" | "warn" | "restrict" | "suspend" | "ban"; notes?: string; duration_days?: number | null }
) {
  return apiRequest<{
    incident: ModerationIncidentRecord;
    decision_id: string;
    restriction: RestrictionRecord | null;
  }>(`/admin/moderation/incidents/${id}/decide`, {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function updateAdminModerationIncident(
  id: string,
  payload: Partial<Pick<ModerationIncidentRecord, "status" | "severity" | "admin_notes">>
) {
  return apiRequest<ModerationIncidentRecord>(`/admin/moderation/incidents/${id}`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function getAdminModerationRestrictions(filters?: {
  status?: string;
  restriction_type?: string;
  subject_type?: string;
}) {
  const params = new URLSearchParams();
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });
  return apiRequest<RestrictionRecord[]>(
    `/admin/moderation/restrictions${params.toString() ? `?${params.toString()}` : ""}`,
    { auth: true }
  );
}

export async function getAdminModerationRiskEntries(filters?: {
  is_active?: boolean;
  risk_level?: string;
}) {
  const params = new URLSearchParams();
  if (typeof filters?.is_active === "boolean") {
    params.set("is_active", String(filters.is_active));
  }
  if (filters?.risk_level) {
    params.set("risk_level", filters.risk_level);
  }
  return apiRequest<RiskEntryRecord[]>(
    `/admin/moderation/risk-entries${params.toString() ? `?${params.toString()}` : ""}`,
    { auth: true }
  );
}

export async function getAdminSupportUsers(filters?: { q?: string; role?: string }) {
  const params = new URLSearchParams();
  if (filters?.q) {
    params.set("q", filters.q);
  }
  if (filters?.role) {
    params.set("role", filters.role);
  }
  return apiRequest<AdminSupportUser[]>(
    `/admin/support/users${params.toString() ? `?${params.toString()}` : ""}`,
    { auth: true }
  );
}

export async function getAdminSupportMessages(filters?: {
  recipient_user?: string;
  status?: "read" | "unread";
}) {
  const params = new URLSearchParams();
  if (filters?.recipient_user) {
    params.set("recipient_user", filters.recipient_user);
  }
  if (filters?.status) {
    params.set("status", filters.status);
  }
  return apiRequest<PlatformMessageRecord[]>(
    `/admin/support/messages${params.toString() ? `?${params.toString()}` : ""}`,
    { auth: true }
  );
}

export async function createAdminSupportMessage(payload: {
  recipient_user: string;
  category: PlatformMessageRecord["category"];
  title: string;
  body: string;
  display_mode: PlatformMessageRecord["display_mode"];
  reply_allowed: boolean;
  is_active?: boolean;
  metadata?: Record<string, unknown>;
}) {
  return apiRequest<PlatformMessageRecord>("/admin/support/messages", {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function getAdminAnnouncements() {
  return apiRequest<AdminAnnouncementRecord[]>("/admin/support/announcements", {
    auth: true,
  });
}

export async function createAdminAnnouncement(payload: {
  title: string;
  body: string;
  audience_role: AdminAnnouncementRecord["audience_role"];
  display_mode: AdminAnnouncementRecord["display_mode"];
  is_active?: boolean;
  starts_at?: string;
  ends_at?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return apiRequest<AdminAnnouncementRecord>("/admin/support/announcements", {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function getAdminDashboardOverview() {
  return apiRequest<AdminDashboardOverview>("/admin/dashboard/overview", {
    auth: true,
  });
}

export async function getAdminUsers(filters?: {
  q?: string;
  role?: string;
  status?: "active" | "suspended";
  city?: string;
}) {
  const params = new URLSearchParams();
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });
  return apiRequest<AdminUserDirectoryRecord[]>(
    `/admin/users${params.toString() ? `?${params.toString()}` : ""}`,
    { auth: true }
  );
}

export async function updateAdminUser(
  id: string,
  payload: {
    is_active?: boolean;
    admin_role?: "" | "admin" | "moderator" | "support" | "ops";
  }
) {
  return apiRequest<AdminUserDirectoryRecord>(`/admin/users/${id}`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function getAdminCampaignOverview() {
  return apiRequest<AdminCampaignOverview>("/admin/campaigns/overview", {
    auth: true,
  });
}

export async function getAdminAnalyticsOverview(filters?: {
  city?: string;
  visitor_type?: "anonymous" | "professional" | "admin";
  days?: number;
}) {
  const params = new URLSearchParams();
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });
  return apiRequest<AdminAnalyticsOverview>(
    `/admin/analytics/overview${params.toString() ? `?${params.toString()}` : ""}`,
    {
      auth: true,
    }
  );
}

export async function getAdminRanking(filters?: {
  q?: string;
  city?: string;
}) {
  const params = new URLSearchParams();
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });
  return apiRequest<{ results: AdminRankingRow[] }>(
    `/admin/ranking${params.toString() ? `?${params.toString()}` : ""}`,
    {
      auth: true,
    }
  );
}

export async function updateAdminRankingBoost(profileId: string, manualVisibilityBoost: number) {
  return apiRequest<AdminRankingRow>("/admin/ranking", {
    method: "PATCH",
    auth: true,
    body: JSON.stringify({
      profile_id: profileId,
      manual_visibility_boost: manualVisibilityBoost,
    }),
  });
}

export async function getAdminPlatformSettings() {
  return apiRequest<AdminPlatformSettingsSnapshot>("/admin/settings", {
    auth: true,
  });
}

export async function getAdminAcquisitionCities(filters?: {
  city?: string;
  department_code?: string;
  region?: string;
  growth_status?: CityCoverageMetric["growth_status"];
  priority_level?: CityCoverageMetric["priority_level"];
  processed?: boolean;
}) {
  const params = new URLSearchParams();
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });
  return apiRequest<CityCoverageMetric[]>(
    `/admin/acquisition/cities${params.toString() ? `?${params.toString()}` : ""}`,
    {
      auth: true,
    }
  );
}

export async function createAdminAcquisitionCity(payload: {
  location_slug: string;
  objective_profiles_total?: number;
  objective_claimed_profiles?: number;
  objective_active_profiles?: number;
  priority_level?: CityCoverageMetric["priority_level"];
  growth_status?: CityCoverageMetric["growth_status"];
  notes_internal?: string;
  is_active?: boolean;
}) {
  return apiRequest<CityCoverageMetric>("/admin/acquisition/cities", {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function getAdminAcquisitionCity(citySlug: string) {
  return apiRequest<CityCoverageMetric>(`/admin/acquisition/cities/${citySlug}`, {
    auth: true,
  });
}

export async function updateAdminAcquisitionCity(
  citySlug: string,
  payload: {
    objective_profiles_total?: number;
    objective_claimed_profiles?: number;
    objective_active_profiles?: number;
    priority_level?: CityCoverageMetric["priority_level"];
    growth_status?: CityCoverageMetric["growth_status"];
    notes_internal?: string;
    is_active?: boolean;
  }
) {
  return apiRequest<CityCoverageMetric>(`/admin/acquisition/cities/${citySlug}`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function getAdminAcquisitionCityFunnel(citySlug: string) {
  return apiRequest<CityAcquisitionFunnel>(
    `/admin/acquisition/cities/${citySlug}/funnel`,
    { auth: true }
  );
}

export async function getAdminAcquisitionCityProfiles(
  citySlug: string,
  filters?: {
    import_status?: ImportedProfileRecord["import_status"];
    claimable?: boolean;
  }
) {
  const params = new URLSearchParams();
  if (filters?.import_status) {
    params.set("import_status", filters.import_status);
  }
  if (typeof filters?.claimable === "boolean") {
    params.set("claimable", String(filters.claimable));
  }
  return apiRequest<ImportedProfileRecord[]>(
    `/admin/acquisition/cities/${citySlug}/profiles${
      params.toString() ? `?${params.toString()}` : ""
    }`,
    { auth: true }
  );
}

export async function getAdminAcquisitionCitySuggestions(
  citySlug: string,
  filters?: {
    processed?: boolean;
    ops_status?: DirectoryInterestLeadRecord["ops_status"];
  }
) {
  const params = new URLSearchParams();
  if (typeof filters?.processed === "boolean") {
    params.set("processed", String(filters.processed));
  }
  if (filters?.ops_status) {
    params.set("ops_status", filters.ops_status);
  }
  return apiRequest<DirectoryInterestLeadRecord[]>(
    `/admin/acquisition/cities/${citySlug}/suggestions${
      params.toString() ? `?${params.toString()}` : ""
    }`,
    { auth: true }
  );
}

export async function getAdminAcquisitionCityCampaigns(citySlug: string) {
  return apiRequest<ContactCampaignRecord[]>(
    `/admin/acquisition/cities/${citySlug}/campaigns`,
    { auth: true }
  );
}

export async function getAdminAcquisitionCoverage() {
  return getAdminAcquisitionCities();
}

export async function getAdminAcquisitionSuggestions(filters?: {
  city?: string;
  city_slug?: string;
  kind?: DirectoryInterestPayload["kind"];
  processed?: boolean;
  ops_status?: DirectoryInterestLeadRecord["ops_status"];
}) {
  const params = new URLSearchParams();
  if (filters?.city) {
    params.set("city", filters.city);
  }
  if (filters?.city_slug) {
    params.set("city_slug", filters.city_slug);
  }
  if (filters?.kind) {
    params.set("kind", filters.kind);
  }
  if (typeof filters?.processed === "boolean") {
    params.set("processed", String(filters.processed));
  }
  if (filters?.ops_status) {
    params.set("ops_status", filters.ops_status);
  }
  return apiRequest<DirectoryInterestLeadRecord[]>(
    `/admin/acquisition/suggestions${params.toString() ? `?${params.toString()}` : ""}`,
    {
      auth: true,
    }
  );
}

export async function updateAdminAcquisitionSuggestion(
  id: string,
  payload: Partial<DirectoryInterestLeadRecord>
) {
  return apiRequest<DirectoryInterestLeadRecord>(`/admin/acquisition/suggestions/${id}`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function getDashboardContacts(filters?: {
  segment?: PractitionerContact["segment"];
  q?: string;
  tag?: string;
  trusted?: boolean;
}) {
  const params = new URLSearchParams();
  if (filters?.segment) {
    params.set("segment", filters.segment);
  }
  if (filters?.q) {
    params.set("q", filters.q);
  }
  if (filters?.tag) {
    params.set("tag", filters.tag);
  }
  if (typeof filters?.trusted === "boolean") {
    params.set("trusted", String(filters.trusted));
  }
  return apiRequest<PractitionerContact[]>(
    `/dashboard/contacts/${params.toString() ? `?${params.toString()}` : ""}`,
    {
      auth: true,
    }
  );
}

export async function getDashboardContact(id: string) {
  return apiRequest<PractitionerContact>(`/dashboard/contacts/${id}/`, {
    auth: true,
  });
}

export async function updateDashboardContact(
  id: string,
  payload: {
    private_note?: string;
    tag_labels?: string[];
    is_trusted?: boolean;
  }
) {
  return apiRequest<PractitionerContact>(`/dashboard/contacts/${id}/`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function getDashboardContactTags() {
  return apiRequest<PractitionerContactTag[]>("/dashboard/contact-tags/", {
    auth: true,
  });
}

export async function createDashboardContactTag(label: string) {
  return apiRequest<PractitionerContactTag>("/dashboard/contact-tags/", {
    method: "POST",
    auth: true,
    body: JSON.stringify({ label }),
  });
}

export async function deleteDashboardContactTag(id: string) {
  return apiRequest<void>(`/dashboard/contact-tags/${id}/`, {
    method: "DELETE",
    auth: true,
  });
}

export async function getServices() {
  return apiRequest<Service[]>("/dashboard/services/", { auth: true });
}

export async function getAssistantProfile() {
  return apiRequest<AssistantProfile>("/dashboard/assistant/", {
    method: "GET",
    auth: true,
  });
}

export async function updateAssistantProfile(data: Partial<AssistantProfile>) {
  return apiRequest<AssistantProfile>("/dashboard/assistant/", {
    method: "PATCH",
    auth: true,
    body: JSON.stringify(data),
  });
}

export async function askDashboardAssistant(question: string) {
  return apiRequest<AssistantReply>("/dashboard/assistant/respond/", {
    method: "POST",
    auth: true,
    body: JSON.stringify({ question }),
  });
}

export async function getPublicAssistant(slug: string) {
  return apiRequest<PublicAssistant>(`/assistant/${slug}/`, {
    method: "GET",
  });
}

export async function askPublicAssistant(slug: string, question: string) {
  return apiRequest<AssistantReply>(`/assistant/${slug}/`, {
    method: "POST",
    body: JSON.stringify({ question }),
  });
}

export async function getPublicServices(professionalSlug: string) {
  return apiRequest<PublicService[]>(
    `/services/?professional=${encodeURIComponent(professionalSlug)}`,
    {
      method: "GET",
    }
  );
}

export async function createService(data: CreateServicePayload) {
  return apiRequest<Service>("/dashboard/services/", {
    method: "POST",
    auth: true,
    body: JSON.stringify(data),
  });
}

export async function getAvailabilities() {
  return apiRequest<Availability[]>("/dashboard/availabilities/", {
    auth: true,
  });
}

export async function getAgenda(date?: string) {
  const params = new URLSearchParams();
  if (date) {
    params.set("date", date);
  }
  const query = params.toString();

  return apiRequest<AgendaDay>(`/dashboard/agenda/${query ? `?${query}` : ""}`, {
    auth: true,
  });
}

export async function getPublicAvailabilities(
  professionalSlug: string,
  serviceId?: string
) {
  const params = new URLSearchParams({ professional: professionalSlug });

  if (serviceId) {
    params.set("service", serviceId);
  }

  return apiRequest<PublicAvailability[]>(
    `/availabilities/?${params.toString()}`,
    {
      method: "GET",
    }
  );
}

export async function createAvailability(data: CreateAvailabilityPayload) {
  return apiRequest<Availability>("/dashboard/availabilities/", {
    method: "POST",
    auth: true,
    body: JSON.stringify(data),
  });
}

export async function deleteAvailability(id: string) {
  return apiRequest<void>(`/dashboard/availabilities/${id}/`, {
    method: "DELETE",
    auth: true,
  });
}

export async function getBookings(status?: BookingStatus | "all") {
  const params =
    status && status !== "all"
      ? `?status=${encodeURIComponent(status)}`
      : "";

  return apiRequest<Booking[]>(`/dashboard/bookings/${params}`, { auth: true });
}

export async function getTrustedClients() {
  return apiRequest<TrustedClient[]>("/dashboard/trusted-clients/", {
    auth: true,
  });
}

export async function createTrustedClient(payload: Omit<TrustedClient, "id" | "created_at">) {
  return apiRequest<TrustedClient>("/dashboard/trusted-clients/", {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function getPaymentOverview() {
  return apiRequest<PaymentOverview>("/dashboard/payments/overview/", {
    auth: true,
  });
}

export async function connectPaymentAccount() {
  return apiRequest<{ url: string; mode: "stripe_connect" | "internal_test" }>(
    "/dashboard/payments/connect-account/",
    {
      method: "POST",
      auth: true,
    }
  );
}

export async function confirmBooking(id: string) {
  return apiRequest<Booking>(`/dashboard/bookings/${id}/confirm/`, {
    method: "POST",
    auth: true,
  });
}

export async function cancelBooking(id: string) {
  return apiRequest<Booking>(`/dashboard/bookings/${id}/cancel/`, {
    method: "POST",
    auth: true,
  });
}

export async function markClientArrived(id: string) {
  return apiRequest<Booking>(`/dashboard/bookings/${id}/client-arrived/`, {
    method: "POST",
    auth: true,
  });
}

export async function startService(id: string) {
  return apiRequest<Booking>(`/dashboard/bookings/${id}/start-service/`, {
    method: "POST",
    auth: true,
  });
}

export async function completeService(id: string) {
  return apiRequest<Booking>(`/dashboard/bookings/${id}/complete-service/`, {
    method: "POST",
    auth: true,
  });
}

export async function reportBookingIssue(id: string, reason: string) {
  return apiRequest<Booking>(`/dashboard/bookings/${id}/report-issue/`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({ reason }),
  });
}

export async function markClientNoShow(id: string, reason: string) {
  return apiRequest<Booking>(`/dashboard/bookings/${id}/client-no-show/`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({ reason }),
  });
}

export async function markPractitionerNoShow(id: string, reason: string) {
  return apiRequest<Booking>(`/dashboard/bookings/${id}/practitioner-no-show/`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({ reason }),
  });
}

export async function recordManualPayment(id: string, paymentChannel: Booking["payment_channel"]) {
  return apiRequest<Booking>(`/dashboard/bookings/${id}/record-manual-payment/`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({ payment_channel: paymentChannel }),
  });
}

export async function createPublicBooking(data: CreatePublicBookingPayload) {
  return apiRequest<PublicBookingVerificationPending>("/bookings/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function verifyPublicBookingEmail(guestIdentityId: string, code: string) {
  return apiRequest<PublicBookingCreated>("/bookings/verify-email/", {
    method: "POST",
    body: JSON.stringify({
      guest_identity_id: guestIdentityId,
      code,
    }),
  });
}

export async function resendPublicBookingVerification(
  guestIdentityId: string,
  clientEmail: string
) {
  return apiRequest<PublicBookingVerificationPending>("/bookings/resend-verification/", {
    method: "POST",
    body: JSON.stringify({
      guest_identity_id: guestIdentityId,
      client_email: clientEmail,
    }),
  });
}

export async function confirmTestPayment(bookingId: string, token: string) {
  return apiRequest<PublicBookingCreated>(`/bookings/${bookingId}/payment-test/confirm/`, {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function validateServiceCompletion(
  bookingId: string,
  token: string,
  action: "validate" | "report_issue" = "validate",
  reason = ""
) {
  return apiRequest<{
    id: string;
    status: BookingStatus;
    payment_status: PaymentStatus;
    payout_status: PayoutStatus;
    fulfillment_status: FulfillmentStatus;
  }>(`/bookings/${bookingId}/validate-service/`, {
    method: "POST",
    body: JSON.stringify({ token, action, reason }),
  });
}

export async function getPublicBookingThread(bookingId: string, token: string) {
  return apiRequest<{
    booking_id: string;
    messages: BookingThreadMessage[];
  }>(`/bookings/${bookingId}/thread/?token=${encodeURIComponent(token)}`);
}

export async function sendPublicBookingMessage(
  bookingId: string,
  token: string,
  message: string
) {
  return apiRequest<BookingThreadMessage>(`/bookings/${bookingId}/thread/`, {
    method: "POST",
    body: JSON.stringify({ token, message }),
  });
}

export async function createPublicBookingIncident(
  bookingId: string,
  token: string,
  category: string,
  description: string
) {
  return apiRequest<{
    incident: BookingIncident | null;
  }>(`/bookings/${bookingId}/incident/`, {
    method: "POST",
    body: JSON.stringify({ token, category, description }),
  });
}

export async function getReviews() {
  return apiRequest<ReviewPractitionerItem[]>("/dashboard/reviews/", {
    auth: true,
  });
}

export async function getReviewInvitations() {
  return apiRequest<ReviewInvitation[]>("/dashboard/review-invitations/", {
    auth: true,
  });
}

export async function createReviewInvitation(payload: {
  first_name: string;
  last_name?: string;
  email: string;
  source?: "manual" | "booking" | "legacy";
}) {
  return apiRequest<ReviewInvitation>("/dashboard/review-invitations/", {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function flagReview(id: string, reason: string) {
  return apiRequest<ReviewPractitionerItem>(`/dashboard/reviews/${id}/flag/`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({ reason }),
  });
}

export async function respondToReview(id: string, response: string) {
  return apiRequest<ReviewPractitionerItem>(`/dashboard/reviews/${id}/respond/`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({ response }),
  });
}

export async function getReviewTokenInfo(token: string) {
  return apiRequest<{
    valid: boolean;
    reason?: "missing" | "invalid" | "used" | "expired" | "";
    first_name?: string;
    professional_name?: string;
    expires_at?: string;
    used?: boolean;
  }>(`/reviews/token-info/?token=${encodeURIComponent(token)}`, {
    method: "GET",
  });
}

export async function submitReview(payload: {
  token: string;
  author_name: string;
  rating: number;
  comment: string;
}) {
  return apiRequest<ReviewPublicItem>("/reviews/submit/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function recordCookieConsent(payload: {
  session_key?: string;
  source: "banner" | "preferences" | "support";
  necessary?: boolean;
  analytics: boolean;
  advertising: boolean;
  support: boolean;
  evidence?: Record<string, unknown>;
  revoke?: boolean;
}) {
  return apiRequest<{ id: string }>("/consents/cookies/", {
    method: "POST",
    auth: false,
    body: JSON.stringify(payload),
  });
}

export async function recordLegalAcceptance(payload: {
  document_slug: string;
  document_version: string;
  source: "registration" | "dashboard" | "booking" | "support";
  metadata?: Record<string, unknown>;
}) {
  return apiRequest<{ id: string }>("/consents/legal/", {
    method: "POST",
    auth: false,
    body: JSON.stringify(payload),
  });
}
