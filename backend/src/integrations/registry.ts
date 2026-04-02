/**
 * Adapter registry — maps provider keys to adapter instances.
 *
 * Adapter mode can be configured per provider via env vars:
 *   - FAUKE_FORTNOX_ADAPTER=mock|real
 *   - FAUKE_VISMA_ADAPTER=mock|real
 *   - FAUKE_PE_ACCOUNTING_ADAPTER=mock|real
 *
 * Until real adapters are implemented, any `real` selection falls back to mock
 * with an informational console warning.
 */

import { IntegrationAdapter, ProviderKey } from "./types.js";
import { FortnoxAdapter } from "./adapters/fortnox.js";
import { FortnoxMockAdapter } from "./adapters/fortnox.mock.js";
import { VismaMockAdapter } from "./adapters/visma.mock.js";
import { PEAccountingMockAdapter } from "./adapters/pe-accounting.mock.js";

type AdapterMode = "mock" | "real";

function resolveAdapterMode(envValue: string | undefined): AdapterMode {
  if (!envValue) return "mock";
  return envValue.trim().toLowerCase() === "real" ? "real" : "mock";
}

function buildFortnoxAdapter(): IntegrationAdapter {
  const mode = resolveAdapterMode(process.env.FAUKE_FORTNOX_ADAPTER);
  if (mode === "real") {
    return new FortnoxAdapter();
  }
  return new FortnoxMockAdapter();
}

function buildVismaAdapter(): IntegrationAdapter {
  const mode = resolveAdapterMode(process.env.FAUKE_VISMA_ADAPTER);
  if (mode === "real") {
    console.warn("[Integrations] FAUKE_VISMA_ADAPTER=real requested, but real adapter is not implemented yet. Falling back to mock.");
  }
  return new VismaMockAdapter();
}

function buildPEAccountingAdapter(): IntegrationAdapter {
  const mode = resolveAdapterMode(process.env.FAUKE_PE_ACCOUNTING_ADAPTER);
  if (mode === "real") {
    console.warn("[Integrations] FAUKE_PE_ACCOUNTING_ADAPTER=real requested, but real adapter is not implemented yet. Falling back to mock.");
  }
  return new PEAccountingMockAdapter();
}

const adapters: Record<ProviderKey, IntegrationAdapter> = {
  fortnox: buildFortnoxAdapter(),
  visma: buildVismaAdapter(),
  pe_accounting: buildPEAccountingAdapter(),
};

export function getAdapter(provider: ProviderKey): IntegrationAdapter {
  const adapter = adapters[provider];
  if (!adapter) {
    throw new Error(`Unknown integration provider: ${provider}`);
  }
  return adapter;
}

/** All supported provider keys. */
export const PROVIDERS: { key: ProviderKey; label: string; description: string }[] = [
  {
    key: "fortnox",
    label: "Fortnox",
    description: "Sweden's most popular cloud accounting platform. OAuth 2.0 auth, JSON REST API.",
  },
  {
    key: "visma",
    label: "Visma",
    description:
      "Visma eEkonomi / Lön Smart — payroll or invoicing integration. OAuth 2.0 auth, JSON REST API.",
  },
  {
    key: "pe_accounting",
    label: "PE Accounting",
    description:
      "Cloud accounting for consultancies & agencies. API token auth, XML REST API.",
  },
];

/** Returns the config field schema for a provider (used by the admin UI). */
export function getConfigFields(
  provider: ProviderKey
): { key: string; label: string; type: "text" | "password" | "select"; options?: string[]; required: boolean }[] {
  switch (provider) {
    case "fortnox":
      return [
        { key: "clientId", label: "Client ID", type: "text", required: true },
        { key: "clientSecret", label: "Client Secret", type: "password", required: true },
        { key: "accessToken", label: "Access Token", type: "password", required: false },
        { key: "refreshToken", label: "Refresh Token", type: "password", required: false },
      ];
    case "visma":
      return [
        { key: "clientId", label: "Client ID", type: "text", required: true },
        { key: "clientSecret", label: "Client Secret", type: "password", required: true },
        { key: "accessToken", label: "Access Token", type: "password", required: false },
        { key: "refreshToken", label: "Refresh Token", type: "password", required: false },
        {
          key: "targetApi",
          label: "Target API",
          type: "select",
          options: ["payroll", "bookkeeping"],
          required: true,
        },
      ];
    case "pe_accounting":
      return [
        { key: "apiToken", label: "API Token", type: "password", required: true },
        { key: "companyId", label: "Company ID", type: "text", required: true },
      ];
  }
}
