/** The MCP result shape the Agent SDK expects back from a tool. */
export type CallToolResult = {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
};

export const ok = (text: string): CallToolResult => ({ content: [{ type: 'text', text }] });

export const fail = (text: string): CallToolResult => ({
  content: [{ type: 'text', text }],
  isError: true,
});
