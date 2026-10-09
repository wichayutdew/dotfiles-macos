import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { normalizeConfig } from "./config.ts";

export default async function registerMcpEnv(pi: ExtensionAPI): Promise<void> {
  const configuredDir = process.env.PI_CODING_AGENT_DIR;
  const agentDir = configuredDir === "~" ? homedir()
    : configuredDir?.startsWith("~/") ? join(homedir(), configuredDir.slice(2))
    : configuredDir || join(homedir(), ".pi", "agent");
  const errors: string[] = [];
  let text: string | undefined;
  try {
    text = await readFile(join(agentDir, "mcp-env.json"), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    errors.push("mcp-env.json: unable to read configuration");
  }
  if (text !== undefined) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      errors.push("mcp-env.json: invalid JSON");
    }
    if (!errors.length) {
      const result = normalizeConfig(parsed, process.env);
      errors.push(...result.errors);
      for (const { name, config } of result.servers) {
        try {
          pi.registerMcpServer(name, config);
        } catch {
          // Native validation messages can contain untrusted field names or values.
          errors.push(`${name}: native MCP registration failed; check server configuration`);
        }
      }
    }
  }
  if (errors.length) {
    pi.on("session_start", async (_event, ctx) => {
      for (const error of errors) {
        const message = `MCP environment configuration: ${error}`;
        if (ctx.hasUI) ctx.ui.notify(message, "warning");
        else console.warn(message);
      }
    });
  }
}
