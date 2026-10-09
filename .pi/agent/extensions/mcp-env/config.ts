import type { McpServerConfig } from "@earendil-works/pi-coding-agent";

export interface ConfigResult {
  servers: { name: string; config: McpServerConfig }[];
  errors: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(field: string): never {
  // Only fixed field names and validated environment-variable names reach diagnostics.
  throw new Error(`${field}: invalid configuration`);
}

function resolveTemplate(value: unknown, field: string, env: Record<string, string | undefined>): string {
  if (typeof value !== "string") invalid(field);
  const missing = new Set<string>();
  const resolved = value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_match, name: string) => {
    const replacement = env[name];
    if (!replacement?.trim()) {
      missing.add(name);
      return "";
    }
    return replacement;
  });
  if (missing.size) throw new Error(`${field}: missing environment variables ${[...missing].join(", ")}`);
  if (resolved.includes("${")) invalid(field);
  return resolved;
}

function resolveUrl(value: unknown, env: Record<string, string | undefined>): string {
  const resolved = resolveTemplate(value, "url", env);
  if (!URL.canParse(resolved) || !/^https?:$/.test(new URL(resolved).protocol)) invalid("url");
  return resolved;
}

function bearerHeader(token: unknown): string {
  if (typeof token !== "string" || !token.trim()) invalid("bearerToken");
  if (!token.startsWith("!")) return `Bearer ${token}`;
  const command = token.slice(1);
  if (!command.trim()) invalid("bearerToken");
  // Native Pi executes command headers via a POSIX shell on this machine. Keep
  // the original command in a separate shell, propagate failure, reject empty output.
  const quoted = `'${command.replace(/'/g, `'"'"'`)}'`;
  return `!token=$(/bin/sh -c ${quoted}) || exit $?; case "$token" in *[![:space:]]*) ;; *) exit 1 ;; esac; printf 'Bearer %s' "$token"`;
}

function normalizeEntry(raw: Record<string, unknown>, env: Record<string, string | undefined>): McpServerConfig {
  const config = structuredClone(raw);
  if (config.url !== undefined) config.url = resolveUrl(config.url, env);
  if (isRecord(config.oauth) && config.oauth.clientId !== undefined) {
    config.oauth.clientId = resolveTemplate(config.oauth.clientId, "oauth.clientId", env);
  }

  if (config.headers !== undefined && (!isRecord(config.headers) ||
    Object.values(config.headers).some((value) => typeof value !== "string"))) invalid("headers");
  const headers = (config.headers ?? {}) as Record<string, string>;
  const authorization = Object.keys(headers).find((key) => key.toLowerCase() === "authorization");

  if (config.auth === "oauth" || config.auth === false) {
    delete config.auth;
  } else if (config.auth === "bearer") {
    if (config.bearerToken === undefined && (!authorization || !headers[authorization].trim())) invalid("auth");
    delete config.auth;
  } else if (config.auth !== undefined && !isRecord(config.auth)) {
    invalid("auth");
  }
  if (config.bearerToken !== undefined) {
    if (config.url === undefined || authorization || config.auth !== undefined) invalid("bearerToken");
    config.headers = { ...headers, Authorization: bearerHeader(config.bearerToken) };
    delete config.bearerToken;
  }

  if (config.directTools !== undefined) {
    if (config.directTools !== false) {
      if (!Array.isArray(config.directTools) || config.directTools.some((tool) => typeof tool !== "string" || !tool)) {
        invalid("directTools");
      }
      if (config.toolExposure !== undefined && !isRecord(config.toolExposure)) invalid("toolExposure");
      const overrides = (config.toolExposure ?? {}) as Record<string, unknown>;
      const patterns = Object.keys(overrides).map((pattern) => new RegExp(`^${pattern.split("*")
        .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`));
      config.toolExposure = {
        ...Object.fromEntries(config.directTools.filter((tool) => !patterns.some((pattern) => pattern.test(tool)))
          .map((tool) => [tool, "direct"])),
        ...overrides,
      };
    }
    delete config.directTools;
  }
  if (config.protocolVersion !== undefined) {
    if (config.protocolVersion !== "auto") invalid("protocolVersion");
    delete config.protocolVersion;
  }
  // The supported registerMcpServer API performs full native validation.
  return config as unknown as McpServerConfig;
}

export function normalizeConfig(input: unknown, env: Record<string, string | undefined>): ConfigResult {
  const result: ConfigResult = { servers: [], errors: [] };
  if (!isRecord(input) || (input.mcpServers !== undefined && !isRecord(input.mcpServers))) {
    result.errors.push("mcp-env.json: expected an object with an mcpServers object");
    return result;
  }
  for (const [name, entry] of Object.entries(input.mcpServers ?? {})) {
    if (!/^[A-Za-z0-9_-]+$/.test(name)) {
      result.errors.push("mcp-env.json: invalid server name");
      continue;
    }
    if (!isRecord(entry)) {
      result.errors.push(`${name}: server entry must be an object`);
      continue;
    }
    try {
      result.servers.push({ name, config: normalizeEntry(entry, env) });
    } catch (error) {
      // normalizeEntry throws only our safe messages, never native/JSON errors.
      result.errors.push(`${name}: ${error instanceof Error ? error.message : "invalid configuration"}`);
    }
  }
  return result;
}
