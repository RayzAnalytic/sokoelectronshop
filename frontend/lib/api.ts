// lib/api.ts

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

/* ─────────────────────────────────────────────
 * Types
 * ───────────────────────────────────────────── */

export type RegisterPayload = {
  full_name: string;
  email: string;
  phone: string;
  password1: string;
  password2: string;
  terms_accepted: boolean;
};

export type User = {
  id: number;
  email: string;
  full_name: string;
  phone_number: string;
  is_staff?: boolean;
  date_joined?: string;
};

export type RegisterResponse = {
  access: string;
  refresh: string;
  user: User;
};

export class ApiError extends Error {
  status: number;
  errors: Record<string, string[]>;

  constructor(
    message: string,
    status = 0,
    errors: Record<string, string[]> = {}
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

/* ─────────────────────────────────────────────
 * Internal: normalize Django / DRF errors
 * ───────────────────────────────────────────── */

function normalizeError(
  status: number,
  json: any
): ApiError {
  const errors: Record<string, string[]> = {};
  let message = "Something went wrong. Please try again.";

  if (json && typeof json === "object") {
    // Collect field errors
    Object.entries(json).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        errors[key] = value.map(String);
      } else if (typeof value === "string") {
        errors[key] = [value];
      }
    });

    // Preferred top-level messages
    if (Array.isArray(json.non_field_errors) && json.non_field_errors.length) {
      message = String(json.non_field_errors[0]);
    } else if (typeof json.detail === "string") {
      message = json.detail;
    } else if (typeof json.message === "string") {
      message = json.message;
    } else {
      // First available field error as fallback message
      const first = Object.values(errors)[0];
      if (first && first.length) message = first[0];
    }
  }

  return new ApiError(message, status, errors);
}

/* ─────────────────────────────────────────────
 * Internal: JSON fetch wrapper
 * ───────────────────────────────────────────── */

async function request<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const { auth, headers, ...rest } = options;

  const finalHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(headers as Record<string, string> | undefined),
  };

  if (auth) {
    const token = getAccessToken();
    if (token) finalHeaders["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
  });

  // 204 No Content
  if (res.status === 204) return undefined as unknown as T;

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw normalizeError(res.status, json);
  }

  return json as T;
}

/* ─────────────────────────────────────────────
 * Auth — Register
 * ───────────────────────────────────────────── */

export async function registerAdmin(
  data: RegisterPayload
): Promise<RegisterResponse> {
  return request<RegisterResponse>("/api/auth/registration/", {
    method: "POST",
    body: JSON.stringify({
      full_name: data.full_name,
      email: data.email,
      phone: data.phone,
      password1: data.password1,
      password2: data.password2,
      terms_accepted: data.terms_accepted,
    }),
  });
}

/* ─────────────────────────────────────────────
 * Auth — Login / Logout / Me / Refresh
 * ───────────────────────────────────────────── */

export type LoginPayload = { email: string; password: string };

export async function login(
  data: LoginPayload
): Promise<RegisterResponse> {
  return request<RegisterResponse>("/api/auth/login/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function logout(): Promise<void> {
  const refresh = getRefreshToken();
  if (!refresh) {
    clearTokens();
    return;
  }

  try {
    await request<void>("/api/auth/logout/", {
      method: "POST",
      body: JSON.stringify({ refresh }),
      auth: true,
    });
  } finally {
    clearTokens();
  }
}

export async function getMe(): Promise<User> {
  return request<User>("/api/auth/user/", { method: "GET", auth: true });
}

export async function refreshAccessToken(): Promise<{ access: string }> {
  const refresh = getRefreshToken();
  if (!refresh) throw new ApiError("No refresh token available.", 401);

  return request<{ access: string }>("/api/auth/token/refresh/", {
    method: "POST",
    body: JSON.stringify({ refresh }),
  });
}

/* ─────────────────────────────────────────────
 * Auth — Password reset
 * ───────────────────────────────────────────── */

export async function requestPasswordReset(email: string): Promise<void> {
  await request<void>("/api/auth/password/reset/", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function confirmPasswordReset(payload: {
  uid: string;
  token: string;
  new_password1: string;
  new_password2: string;
}): Promise<void> {
  await request<void>("/api/auth/password/reset/confirm/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/* ─────────────────────────────────────────────
 * Token storage helpers
 * ───────────────────────────────────────────── */

export function saveTokens(access: string, refresh: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("access_token", access);
  localStorage.setItem("refresh_token", refresh);
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("refresh_token");
}

export function clearTokens() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}