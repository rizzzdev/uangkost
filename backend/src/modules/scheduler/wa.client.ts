import { env } from "../../config/env.js";

export interface WaState {
  connected: boolean;
  qrCode: null; // no longer used, kept for API compatibility
}

/** Payload API Fonnte (https://api.fonnte.com/send). */
interface FonnteSendPayload {
  target: string;
  message: string;
  countryCode: string;
  url?: string;
}

const waState: WaState = {
  connected: !!env.FONNTE_TOKEN,
  qrCode: null,
};

console.log("[WA] FONNTE_TOKEN", env.FONNTE_TOKEN ? `configured (${env.FONNTE_TOKEN.slice(0, 8)}...)` : "NOT SET");

export function getWaState(): WaState {
  waState.connected = !!env.FONNTE_TOKEN;
  return { ...waState };
}

export function getWASocket(): WaState | null {
  return getWaState().connected ? waState : null;
}

/**
 * Send WhatsApp message via Fonnte REST API.
 * Returns true on success, throws on failure.
 */
export async function sendWaMessage(phone: string, message: string, linkUrl?: string): Promise<void> {
  if (!env.FONNTE_TOKEN) {
    throw new Error("FONNTE_TOKEN not configured");
  }

  const normalizedPhone = phone.startsWith("0")
    ? `62${phone.slice(1)}`
    : phone;

  const body: FonnteSendPayload = {
    target: normalizedPhone,
    message,
    countryCode: "62",
  };

  // Fonnte link preview — URL jadi clickable button di WhatsApp
  if (linkUrl) {
    body.url = linkUrl;
  }

  const res = await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: {
      Authorization: env.FONNTE_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const resBody = await res.text().catch(() => "");
  console.log(`[WA] Fonnte response ${res.status}:`, resBody.slice(0, 200));

  if (!res.ok) {
    throw new Error(`Fonnte API error ${res.status}: ${resBody}`);
  }

  let json: { status?: boolean; detail?: string } = {};
  try { json = JSON.parse(resBody); } catch { /* not JSON */ }

  if (!json.status) {
    throw new Error(`Fonnte gagal: ${json.detail ?? resBody}`);
  }
}

// Stub functions — no longer needed with Fonnte
export async function connectWa(): Promise<void> {
  if (!env.FONNTE_TOKEN) {
    throw new Error("FONNTE_TOKEN not configured in .env");
  }
  waState.connected = true;
}

export async function disconnectWa(): Promise<void> {
  // Fonnte doesn't need disconnection
}
