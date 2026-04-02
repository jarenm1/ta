// Tool system for model-agnostic tool execution
// Supports OpenAI function calling, Anthropic tool use, and generic providers

export type ToolParameterType = 'string' | 'number' | 'boolean' | 'array' | 'object';

export interface ToolParameter {
  name: string;
  type: ToolParameterType;
  description: string;
  required?: boolean;
  items?: ToolParameter; // For array type
  properties?: Record<string, ToolParameter>; // For object type
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  result: unknown;
  error?: string;
}

export type ToolExecutor = (args: Record<string, unknown>) => Promise<unknown>;

export interface ToolRegistryEntry {
  definition: ToolDefinition;
  executor: ToolExecutor;
}

// Tool registry
const toolRegistry = new Map<string, ToolRegistryEntry>();

export function registerTool(definition: ToolDefinition, executor: ToolExecutor): void {
  toolRegistry.set(definition.name, { definition, executor });
}

export function getTool(name: string): ToolRegistryEntry | undefined {
  return toolRegistry.get(name);
}

export function getAllTools(): ToolDefinition[] {
  return Array.from(toolRegistry.values()).map((entry) => entry.definition);
}

export function getAvailableToolNames(): string[] {
  return Array.from(toolRegistry.keys());
}

export async function executeTool(call: ToolCall): Promise<ToolResult> {
  const entry = getTool(call.name);
  
  if (!entry) {
    return {
      toolCallId: call.id,
      name: call.name,
      result: null,
      error: `Tool "${call.name}" not found`,
    };
  }

  try {
    const result = await entry.executor(call.arguments);
    return {
      toolCallId: call.id,
      name: call.name,
      result,
    };
  } catch (error) {
    return {
      toolCallId: call.id,
      name: call.name,
      result: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Convert tools to OpenAI function format
export function toOpenAIFunctions(tools: ToolDefinition[]): Array<{
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required: string[];
    };
  };
}> {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object' as const,
        properties: tool.parameters.reduce((acc, param) => {
          acc[param.name] = {
            type: param.type,
            description: param.description,
            ...(param.items && { items: convertParameter(param.items) }),
            ...(param.properties && { 
              properties: Object.fromEntries(
                Object.entries(param.properties).map(([k, v]) => [k, convertParameter(v)])
              ) 
            }),
          };
          return acc;
        }, {} as Record<string, unknown>),
        required: tool.parameters.filter((p) => p.required).map((p) => p.name),
      },
    },
  }));
}

function convertParameter(param: ToolParameter): Record<string, unknown> {
  const result: Record<string, unknown> = {
    type: param.type,
    description: param.description,
  };
  
  if (param.items) {
    result.items = convertParameter(param.items);
  }
  
  if (param.properties) {
    result.properties = Object.fromEntries(
      Object.entries(param.properties).map(([k, v]) => [k, convertParameter(v)])
    );
  }
  
  return result;
}

// Convert tools to Anthropic tool format
export function toAnthropicTools(tools: ToolDefinition[]): Array<{
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}> {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: 'object' as const,
      properties: tool.parameters.reduce((acc, param) => {
        acc[param.name] = convertParameter(param);
        return acc;
      }, {} as Record<string, unknown>),
      required: tool.parameters.filter((p) => p.required).map((p) => p.name),
    },
  }));
}

// Parse tool calls from different provider formats
export function parseToolCalls(provider: string, response: unknown): ToolCall[] {
  if (provider === 'openai' || provider === 'fireworks') {
    return parseOpenAIToolCalls(response);
  } else if (provider === 'anthropic') {
    return parseAnthropicToolCalls(response);
  }
  return [];
}

function parseOpenAIToolCalls(response: unknown): ToolCall[] {
  const payload = response as { 
    choices?: Array<{ 
      message?: { 
        tool_calls?: Array<{ 
          id: string; 
          function: { 
            name: string; 
            arguments: string 
          } 
        }> 
      } 
    }> 
  };
  const toolCalls = payload?.choices?.[0]?.message?.tool_calls;
  
  if (!toolCalls) return [];
  
  return toolCalls.map((tc) => ({
    id: tc.id,
    name: tc.function.name,
    arguments: JSON.parse(tc.function.arguments),
  }));
}

function parseAnthropicToolCalls(response: unknown): ToolCall[] {
  const payload = response as { 
    content?: Array<{ 
      type: string; 
      id?: string; 
      name?: string; 
      input?: Record<string, unknown> 
    }> 
  };
  const content = payload?.content;
  
  if (!content) return [];
  
  return content
    .filter((item) => item.type === 'tool_use')
    .map((item) => ({
      id: item.id!,
      name: item.name!,
      arguments: item.input || {},
    }));
}
