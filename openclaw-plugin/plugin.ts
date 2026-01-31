/**
 * OpenClaw plugin: hooks into message/tool flow and runs AgentSmith scan.
 * Block or sanitize on detection.
 */

import { AgentSmith, type ScanResult } from "../core/detector";
import { hashForLog } from "../core/privacy";

export type AgentSmithPluginOptions = {
  mode?: "warn" | "block";
};

export class AgentSmithPlugin {
  private smith = new AgentSmith();
  private mode: "warn" | "block" = "block";

  constructor(options: AgentSmithPluginOptions = {}) {
    this.mode = options.mode ?? "block";
  }

  async onMessage(text: string): Promise<string | null> {
    const result = await this.smith.scan(text);
    if (result.blocked) {
      const hash = await hashForLog(text);
      console.warn(`[AgentSmith] blocked message (${result.reason}) hash=${hash}`);
      return this.mode === "block" ? null : text;
    }
    return text;
  }

  async onToolResult(_toolName: string, result: unknown): Promise<unknown> {
    const text = typeof result === "string" ? result : JSON.stringify(result);
    const scan = await this.smith.scan(text);
    if (scan.blocked) {
      const hash = await hashForLog(text);
      console.warn(`[AgentSmith] sanitizing tool result (${scan.reason}) hash=${hash}`);
      return "[AgentSmith: content sanitized]";
    }
    return result;
  }
}
