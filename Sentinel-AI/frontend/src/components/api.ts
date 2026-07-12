// src/components/api.ts
const API_BASE = "http://localhost:8000/api/v1";

export async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    return await res.json() as T;
  } catch (err) {
    console.warn(`API fetch to ${endpoint} failed, using fallback mock data.`, err);
    throw err;
  }
}
