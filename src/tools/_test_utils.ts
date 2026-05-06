// Helpers for testing tool registrations without spinning up a real
// MCP transport. Captures the (name, config, callback) tuples passed
// to `registerTool` so we can introspect annotations and invoke
// handlers directly with stubbed clients.

import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

export type CapturedTool = {
  name: string;
  config: {
    title?: string;
    description?: string;
    inputSchema?: unknown;
    outputSchema?: unknown;
    annotations?: ToolAnnotations;
    _meta?: Record<string, unknown>;
  };
  callback: (...args: unknown[]) => unknown;
};

export class CaptureServer {
  tools: CapturedTool[] = [];

  registerTool(
    name: string,
    config: CapturedTool["config"],
    callback: CapturedTool["callback"],
  ) {
    this.tools.push({ name, config, callback });
    return { name } as unknown;
  }

  byName(name: string): CapturedTool {
    const t = this.tools.find((x) => x.name === name);
    if (!t) throw new Error(`tool not registered: ${name}`);
    return t;
  }
}

// Minimal RequestHandlerExtra-shaped object for invoking handlers
// outside an MCP request. The fields here are the only ones the tool
// handlers in this repo actually consume (progress notifications +
// abort signal); other SDK-required fields are stubbed/empty.
export function fakeExtra(progressToken?: string | number) {
  return {
    _meta: progressToken !== undefined ? { progressToken } : undefined,
    sendNotification: async () => undefined,
    sendRequest: async () => undefined,
    signal: new AbortController().signal,
    requestId: "test-req",
  };
}
