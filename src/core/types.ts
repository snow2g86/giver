// --- AI Provider 타입 ---

export interface TextContent {
  type: "text";
  text: string;
}

export interface ToolUseContent {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultContent {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export type ContentBlock = TextContent | ToolUseContent;

export interface MessageParam {
  role: "user" | "assistant";
  content: string | ContentBlock[] | ToolResultContent[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface GenerateResponse {
  content: ContentBlock[];
  stopReason: "end_turn" | "tool_use" | "max_tokens";
}

// --- 기존 앱 타입 ---

export interface ToolResult {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export interface AgentConfig {
  model: string;
  maxTokens: number;
  systemPrompt: string;
  maxToolRounds: number;
}

export interface ProviderConfig {
  type: "ollama" | "claude-cli" | "gemini-cli";
  model: string;
  ollamaBaseUrl?: string;
}

export interface GiverConfig {
  allowedPaths: string[];
  blockedCommands: string[];
  maxTokens: number;
  maxToolRounds: number;
  provider: ProviderConfig;
  telegram: {
    allowedUsers: number[];
  };
  setupComplete?: boolean;
}

export interface ConversationEntry {
  id: string;
  timestamp: string;
  role: "user" | "assistant";
  content: string;
}

export interface MemoryEntry {
  key: string;
  value: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  name?: string;
  language?: string;
  [key: string]: string | undefined;
}
