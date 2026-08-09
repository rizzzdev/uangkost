import { env } from "../../config/env.js";
import { isError } from "../../utils/type-guards.js";

export interface WaState {
  connected: boolean;
  qrCode: null;
}

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

export function getWaState(): WaState {
  waState.connected = !!env.FONNTE_TOKEN;
  return { ...waState };
}

/**
 * Send WhatsApp message via Fonnte REST API with AbortController timeout resilience.
 */
export async function sendWaMessage(
  phone: string,
  message: string,
  linkUrl?: string,
  timeoutMs = 10000,
): Promise<void> {
  if (!env.FONNTE_TOKEN) {
    throw new Error("FONNTE_TOKEN not configured");
  }

  const normalizedPhone = phone.startsWith("0") ? `62${phone.slice(1)}` : phone;

  const body: FonnteSendPayload = {
    target: normalizedPhone,
    message,
    countryCode: "62",
  };

  if (linkUrl) {
    body.url = linkUrl;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        Authorization: env.FONNTE_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const resBody = await res.text().catch(() => "");

    if (!res.ok) {
      throw new Error(`Fonnte API error ${res.status}: ${resBody}`);
    }

    let json: { status?: boolean; detail?: string } = {};
    try {
      json = JSON.parse(resBody) as { status?: boolean; detail?: string };
    } catch {
      /* not JSON */
    }

    if (!json.status) {
      throw new Error(`Fonnte gagal: ${json.detail ?? resBody}`);
    }
  } catch (err) {
    if (isError(err) && err.name === "AbortError") {
      throw new Error(`Fonnte API request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
