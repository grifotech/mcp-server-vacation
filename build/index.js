import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { MCPServer, tokenData } from "./server.js";
import { validateJWT } from "./jwt-utils.js";
// Auth middleware com validação JWT local
async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).send("Unauthorized: Token ausente ou formato inválido");
        return;
    }
    const token = authHeader.split(" ")[1];
    try {
        // Valida o token JWT localmente
        const validationResult = validateJWT(token);
        if (validationResult.success && validationResult.payload && validationResult.secret) {
            // Armazena os dados do token para uso posterior
            tokenData.secret = validationResult.secret;
            tokenData.payload = validationResult.payload;
            console.log("Token JWT validado com sucesso:", {
                vaultId: validationResult.payload.vaultId,
                vaultName: validationResult.payload.vaultName,
                link: validationResult.payload.link
            });
            next();
            return;
        }
        res.status(401).send(`Unauthorized: ${validationResult.error || "Token inválido"}`);
    }
    catch (error) {
        console.error("Token validation error:", error);
        res.status(500).send("Internal Server Error: Falha ao validar token");
    }
}
// Server bootstrap
let PORT = Number(process.env.PORT || 3001);
for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg.startsWith("--port=")) {
        const value = parseInt(arg.split("=")[1], 10);
        if (!isNaN(value))
            PORT = value;
    }
}
const server = new MCPServer(new Server({ name: "mcp-server-vacation", version: "1.0.0" }, { capabilities: { tools: {}, logging: {} } }));
const app = express();
app.use(express.json());
// Apply auth on MCP endpoints
const router = express.Router();
const MCP_ENDPOINT = "/mcp";
const MCP_TEST_ENDPOINT = "/mcp-test";
// Endpoint com autenticação
router.post(MCP_ENDPOINT, authMiddleware, async (req, res) => { await server.handlePostRequest(req, res); });
router.get(MCP_ENDPOINT, authMiddleware, async (req, res) => { await server.handleGetRequest(req, res); });
// Endpoint de teste sem autenticação
router.post(MCP_TEST_ENDPOINT, async (req, res) => { await server.handlePostRequest(req, res); });
router.get(MCP_TEST_ENDPOINT, async (req, res) => { await server.handleGetRequest(req, res); });
app.use("/", router);
app.listen(PORT, '0.0.0.0', () => { console.log(`MCP Vacation SSE Server listening on port ${PORT}`); });
process.on("SIGINT", async () => {
    console.log("Shutting down server...");
    await server.cleanup();
    process.exit(0);
});
