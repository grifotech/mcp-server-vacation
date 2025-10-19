import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  Notification,
  CallToolRequestSchema,
  ListToolsRequestSchema,
  LoggingMessageNotification,
  ToolListChangedNotification,
  JSONRPCNotification,
  JSONRPCError,
  InitializeRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "crypto";
import { Request, Response } from "express";
import axios from "axios";
import { z } from "zod";

// Shared token data set by auth middleware in index.ts
export const tokenData: { secret: string | null; payload: any } = { secret: null, payload: null };

function createAxiosInstance() {
  const payload = tokenData.payload;
  const secret = tokenData.secret;
  const API_BASE_URL = process.env.VACATION_API_URL || payload?.link || "http://localhost:3000";
  const USER_SECRET = secret || process.env.USER_SECRET || "default-secret";
  const USER_ID = process.env.USER_ID || payload?.key?.identifier || "default-user";
  
  console.log("🔧 VACATION API CONFIGURATION:");
  console.log("  📡 API_BASE_URL:", API_BASE_URL);
  console.log("  🔐 USER_SECRET:", USER_SECRET);
  console.log("  👤 USER_ID:", USER_ID);
  console.log("  📦 Payload:", JSON.stringify(payload, null, 2));
  console.log("  🔑 Secret from token:", secret);
  
  return axios.create({
    baseURL: API_BASE_URL,
    headers: {
      "Content-Type": "application/json",
      "x-api-token": USER_SECRET,
      "x-api-id": USER_ID,
    },
    timeout: 10000,
  });
}

export class MCPServer {
  server: Server;
  transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};
  private toolInterval: NodeJS.Timeout | undefined;

  constructor(server: Server) {
    this.server = server;
    this.setupTools();
  }

  async handleGetRequest(req: Request, res: Response) {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !this.transports[sessionId]) {
      res.status(400).json(this.createErrorResponse("Bad Request: invalid session ID or method."));
      return;
    }
    const transport = this.transports[sessionId];
    await transport.handleRequest(req, res);
    await this.streamMessages(transport);
  }

  async handlePostRequest(req: Request, res: Response) {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport: StreamableHTTPServerTransport;
    try {
      if (sessionId && this.transports[sessionId]) {
        transport = this.transports[sessionId];
        await transport.handleRequest(req, res, req.body);
        return;
      }
      if (!sessionId && this.isInitializeRequest(req.body)) {
        const newTransport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID() });
        await this.server.connect(newTransport);
        await newTransport.handleRequest(req, res, req.body);
        const newSessionId = newTransport.sessionId;
        if (newSessionId) {
          this.transports[newSessionId] = newTransport;
        }
        return;
      }
      res.status(400).json(this.createErrorResponse("Bad Request: invalid session ID or method."));
    } catch (error) {
      console.error("Error handling MCP request:", error);
      res.status(500).json(this.createErrorResponse("Internal server error."));
    }
  }

  async cleanup() {
    this.toolInterval?.close();
    await this.server.close();
  }

  private setupTools() {
    const setToolSchema = () =>
      this.server.setRequestHandler(ListToolsRequestSchema, async () => {
        const tools = [
          {
            name: "get_my_vacations",
            description: "Busca dados das férias do usuário, incluindo férias planejadas e períodos disponíveis",
            inputSchema: { type: "object", properties: {}, required: [] },
          },
          {
            name: "create_vacation_flow",
            description: "Inicia um novo fluxo de férias com dias para gozo e data de início",
            inputSchema: {
              type: "object",
              properties: {
                diasParaGozo: { type: "number", description: "Número de dias de férias para gozo" },
                inicioFerias: { type: "string", description: "Data de início das férias no formato dd-mm-yyyy" },
              },
              required: ["diasParaGozo", "inicioFerias"],
            },
          },
          {
            name: "get_vacation_requirements",
            description: "Verifica campos necessários para próxima etapa do fluxo de férias",
            inputSchema: { type: "object", properties: {}, required: [] },
          },
          {
            name: "advance_vacation_wflow",
            description: "Avança o fluxo de férias para a próxima etapa com os dados fornecidos",
            inputSchema: {
              type: "object",
              properties: { data: { type: "object", description: "Dados necessários para avançar" } },
              required: [],
            },
          },
        ];
        return { tools };
      });

    setToolSchema();
    this.toolInterval = setInterval(() => {
      setToolSchema();
      Object.values(this.transports).forEach((transport) => {
        const notification: ToolListChangedNotification = { method: "notifications/tools/list_changed" };
        this.sendNotification(transport, notification);
      });
    }, 5000);

    this.server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
      const args = request.params.arguments as any;
      const toolName = request.params.name;
      if (!toolName) throw new Error("tool name undefined");

      if (toolName === "get_my_vacations") {
        const api = createAxiosInstance();
        const response = await api.get("/rest/vacation/me");
        const { plannedVacations, availablePeriods } = response.data;
        let result = "📅 **SUAS FÉRIAS**\n\n";
        if (plannedVacations.length > 0) {
          result += "🏖️ **Férias Planejadas:**\n";
          plannedVacations.forEach((v: any, i: number) => {
            result += `${i + 1}. **${v.days} dias** - ${v.startDate} a ${v.endDate} (Status: ${v.status})\n`;
          });
          result += "\n";
        } else {
          result += "🏖️ **Férias Planejadas:** Nenhuma planejada\n\n";
        }
        if (availablePeriods.length > 0) {
          result += "💰 **Períodos Disponíveis:**\n";
          availablePeriods.forEach((p: any, i: number) => {
            result += `${i + 1}. **${p.availableDays} dias disponíveis**\n`;
            result += `   • Período aquisitivo: ${p.acquisitivePeriodStart} a ${p.acquisitivePeriodEnd}\n`;
            result += `   • Vencimento: ${p.expirationDate}\n\n`;
          });
        } else {
          result += "💰 **Períodos Disponíveis:** Nenhum\n";
        }
        return { content: [{ type: "text", text: result }] };
      }

      if (toolName === "create_vacation_flow") {
        const schema = z.object({
          diasParaGozo: z.number(),
          inicioFerias: z.string().regex(/^\d{2}-\d{2}-\d{4}$/),
        });
        const parsed = schema.parse(args || {});
        const api = createAxiosInstance();
        const response = await api.post("/rest/vacation", parsed);
        const { message, fluxoId, step, data } = response.data;
        const result = `✅ **FLUXO DE FÉRIAS INICIADO**\n\n` +
          `📋 **Detalhes:**\n` +
          `• ${message}\n` +
          `• ID do Fluxo: ${fluxoId}\n` +
          `• Etapa Atual: ${step}\n` +
          `• Dias para Gozo: ${data.diasParaGozo}\n` +
          `• Início das Férias: ${data.inicioFerias}\n\n` +
          `🚀 Use 'get_vacation_requirements' para ver o que falta.`;
        return { content: [{ type: "text", text: result }] };
      }

      if (toolName === "get_vacation_requirements") {
        const api = createAxiosInstance();
        const response = await api.post("/rest/vacation/requirements");
        const { step, requirements } = response.data;
        let result = `📋 **REQUISITOS PARA PRÓXIMA ETAPA**\n\n🎯 Etapa: ${step}\n\n📝 Campos:\n`;
        requirements.forEach((r: any, i: number) => {
          const tipo = typeof r.tipo === "string" ? r.formato : JSON.stringify(r.tipo);
          const formato = typeof r.formato === "string" ? r.formato : JSON.stringify(r.formato);
          result += `${i + 1}. **${r.nome}**\n`;
          result += `   • Tipo: ${tipo}\n`;
          result += `   • Formato: ${formato}\n\n`;
        });
        result += `🚀 Use 'advance_vacation_wflow' com os dados para continuar.`;
        return { content: [{ type: "text", text: result }] };
      }

      if (toolName === "advance_vacation_wflow") {
        const api = createAxiosInstance();
        const dataArg = (args && (args as any).data) || {};
        const response = await api.post("/rest/vacation/next", dataArg);
        const { hasNext, currentStep, message, data: flowData } = response.data;
        let result = `✅ **FLUXO AVANÇADO**\n\n📋 ${message}\n• Etapa Atual: ${currentStep}\n• Tem Próxima Etapa: ${hasNext ? "Sim" : "Não"}\n\n`;
        if (flowData) {
          result += `📊 **Dados:**\n`;
          Object.entries(flowData).forEach(([key, val]) => {
            if (!["createdAt", "updatedAt"].includes(key)) {
              result += `• ${key}: ${val}\n`;
            }
          });
        }
        result += hasNext ? "\n🚀 Use 'get_vacation_requirements' para a próxima etapa." : "\n🏁 Fluxo finalizado com sucesso!";
        return { content: [{ type: "text", text: result }] };
      }

      throw new Error("Tool not found");
    });
  }

  private async streamMessages(transport: StreamableHTTPServerTransport) {
    try {
      const message: LoggingMessageNotification = { method: "notifications/message", params: { level: "info", data: "SSE Connection established" } };
      this.sendNotification(transport, message);
      let messageCount = 0;
      const interval = setInterval(() => {
        messageCount++;
        const data = `Message ${messageCount} at ${new Date().toISOString()}`;
        const msg: LoggingMessageNotification = { method: "notifications/message", params: { level: "info", data } };
        this.sendNotification(transport, msg);
        if (messageCount === 2) {
          clearInterval(interval);
          const done: LoggingMessageNotification = { method: "notifications/message", params: { level: "info", data: "Streaming complete!" } };
          this.sendNotification(transport, done);
        }
      }, 1000);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }

  private async sendNotification(transport: StreamableHTTPServerTransport, notification: Notification) {
    const rpcNotificaiton: JSONRPCNotification = { ...notification, jsonrpc: "2.0" };
    await transport.send(rpcNotificaiton);
  }

  private createErrorResponse(message: string): JSONRPCError {
    return { jsonrpc: "2.0", error: { code: -32000, message }, id: randomUUID() };
  }

  private isInitializeRequest(body: any): boolean {
    const isInitial = (data: any) => InitializeRequestSchema.safeParse(data).success;
    if (Array.isArray(body)) return body.some((request) => isInitial(request));
    return isInitial(body);
  }
}


