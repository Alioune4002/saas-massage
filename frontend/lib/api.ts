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
      return (body as { detail: string }).detail;
    }

    for (const value of Object.values(body as Record<string, unknown>)) {
      if (typeof value === "string" && value.trim()) {
        return value;
      }

      if (
        Array.isArray(value) &&
        typeof value[0] === "string" &&
        value[0].trim()
      ) {
        return value[0];
      }
    }
  }

  return `Erreur API (${status})`;
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

export function setStoredToken(token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("massage_saas_token", token);
}

export function clearStoredToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("massage_saas_token");
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
  onboarding_completed: boolean;
  professional_slug: string;
  professional_name: string;
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
  duration_minutes: number;
  price_eur: string;
  is_active: boolean;
  sort_order: number;
};

export type CreateServicePayload = {
  title: string;
  short_description: string;
  full_description: string;
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
  client_first_name: string;
  client_last_name: string;
  client_email: string;
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
}) {
  const params = new URLSearchParams();
  if (filters?.city) {
    params.set("city", filters.city);
  }
  if (filters?.q) {
    params.set("q", filters.q);
  }
  const query = params.toString();
  return apiRequest<PublicProfessional[]>(
    `/professionals/${query ? `?${query}` : ""}`,
    {
    method: "GET",
    }
  );
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
  return apiRequest<PublicBookingCreated>("/bookings/", {
    method: "POST",
    body: JSON.stringify(data),
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
