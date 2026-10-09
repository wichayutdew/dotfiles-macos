# Environment-backed native MCP

A user-level compatibility extension for Pi 1.1.0. Keeps internal endpoint and credential references in configuration while registering resolved servers in memory through native `pi.registerMcpServer()`.

## Configuration

Place your server entries under `mcpServers` in `~/.pi/agent/mcp-env.json` (or `$PI_CODING_AGENT_DIR/mcp-env.json`). Export referenced variables **before starting Pi**.

```json
{
  "mcpServers": {
    "company": {
      "url": "${COMPANY_MCP_ENDPOINT}",
      "headers": { "Authorization": "Bearer ${COMPANY_MCP_TOKEN}" },
      "toolExposure": { "search": "direct" }
    }
  }
}
```

- Keep these entries out of native `mcp.json`: native entries with the same names take precedence.
- The extension reads only the user-level source, not project configurations or dotenv files.
- `/reload` reloads the source and extension. If you changed environment variables outside the running process, restart Pi instead.
- Use `/mcp` to inspect servers, sign in, or reconnect. Native MCP owns transports, OAuth, resources, tools, and shutdown.
- Native shell commands such as `pi mcp list/login` do not load extensions and cannot inspect these registrations.
- Enabled/exposure changes made through `/mcp` are session-only for extension-registered servers. Edit the source to persist changes.
- Native `autoEnableCodemode` is a top-level setting in `mcp.json`, not this extension's source.

## Supported compatibility mappings

| Source field | Native behavior |
| --- | --- |
| `url: "${NAME}"` or a URL containing `${NAME}` | Resolve references in memory; missing/blank variables skip that server. Require HTTP(S). |
| `oauth.clientId: "${NAME}"` | Resolve references in memory. |
| `headers`, stdio `env`, `oauth.clientSecret` | Preserve native variable/whole-value command resolution. |
| `auth: "oauth"` | Remove the legacy field; native automatic OAuth applies. Preserve the `oauth` object. |
| `auth: false` | Remove the legacy field. This is **not** an OAuth-disable switch: native automatic OAuth still applies if required. |
| `auth: { "provider": "name" }` | Preserve native provider-token authentication. |
| `auth: "bearer"` | Require `bearerToken` or a nonempty case-insensitive Authorization header. |
| `bearerToken: "${TOKEN}"` | Convert to `headers.Authorization: "Bearer ${TOKEN}"`; native Pi resolves the token when connecting. |
| `bearerToken: "!command"` | Convert to a deferred native command header; run the original command in `/bin/sh`, prefix successful nonempty output, and propagate failure. |
| `directTools: ["tool"]` | Convert to exact-name `toolExposure: "direct"`; explicit native overrides win. |
| `directTools: false` | Remove the obsolete field; native exposure defaults apply. |
| `protocolVersion: "auto"` | Remove the obsolete field; native protocol negotiation applies. Other explicit legacy versions are rejected. |

Conflicting `bearerToken` and Authorization headers/provider authentication are rejected rather than choosing a credential silently. Stdio arguments and commands are preserved unchanged. Other native fields are validated by Pi's supported registration API.

## Privacy and errors

- The extension never writes resolved configuration or executes credential commands during factory loading.
- Source errors report server name, fixed field name, and missing variable names—not endpoint values, tokens, command text, or raw JSON/native errors.
- One invalid server does not prevent valid servers registering. Missing source is a silent no-op.
- Native connection errors are separate from extension configuration errors. Native OAuth storage and connection diagnostics can contain endpoint metadata or command details; this extension does **not** redact all native runtime artifacts.
- Trust the source like executable configuration: native `!command` header/env/secret values execute with your permissions when needed.
- Keep the source and any backups private. Do not commit literal credentials.

## Installation and migration

1. Place this directory under `~/.pi/agent/extensions/mcp-env/`.
2. Back up the original `mcp.json` with permissions `0600`.
3. Copy server entries to `mcp-env.json`, retaining all `${VARIABLE}` and `!command` references unchanged. Set its permissions to `0600`.
4. Remove only migrated entries from native `mcp.json`; preserve other settings.
5. Run `/reload`, then inspect `/mcp`. Sign in to individual servers when requested.

The install performed with this change preserves the original file at `~/.pi/agent/backups/mcp-before-env-extension.json`. It does not change OAuth credentials or the Atlassian endpoint/timeout. An Atlassian timeout still needs separate connection diagnosis.

### Rollback

- Restore the restricted backup to `mcp.json`.
- Rename `mcp-env/index.ts` to `index.ts.disabled` to disable auto-loading, then `/reload` (or remove the extension directory).
- Keep `mcp-env.json` as a private reference or remove it after restoring the original.
- Restoring the original configuration also restores its original native validation limitations.

## Verification

Node 22.18+ can run the TypeScript regression tests without a new dependency:

```sh
node --test ~/.pi/agent/extensions/mcp-env/*.test.ts
```

To include the actual Pi-loader smoke test, set `PI_PACKAGE_DIR` to the installed `@earendil-works/pi-coding-agent` package directory:

```sh
PI_PACKAGE_DIR=/path/to/pi-coding-agent node --test ~/.pi/agent/extensions/mcp-env/*.test.ts
```

The smoke test skips when that variable is absent. Tests use temporary fixtures and fake endpoints; they start no MCP session/transport and execute no real credential commands. Command-header tests execute only controlled local commands.
