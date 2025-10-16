#!/usr/bin/env node

// Cliente MCP simples para testar as ferramentas
const http = require('http');

class MCPTestClient {
  constructor(baseUrl = 'http://localhost:8123') {
    this.baseUrl = baseUrl;
    this.sessionId = null;
  }

  async makeRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
      const data = {
        jsonrpc: "2.0",
        id: Math.floor(Math.random() * 1000),
        method,
        params
      };

      const options = {
        hostname: 'localhost',
        port: 8123,
        path: '/mcp',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(JSON.stringify(data))
        }
      };

      if (this.sessionId) {
        options.headers['mcp-session-id'] = this.sessionId;
      }

      const req = http.request(options, (res) => {
        // Capturar session ID do header
        if (res.headers['mcp-session-id']) {
          this.sessionId = res.headers['mcp-session-id'];
        }

        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(responseData);
            resolve(response);
          } catch (e) {
            resolve({ error: 'Invalid JSON', data: responseData });
          }
        });
      });

      req.on('error', reject);
      req.write(JSON.stringify(data));
      req.end();
    });
  }

  async initialize() {
    console.log('🚀 Inicializando cliente MCP...');
    const response = await this.makeRequest('initialize', {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      clientInfo: { name: "test-client", version: "1.0.0" }
    });
    console.log('✅ Inicialização:', response);
    return response;
  }

  async listTools() {
    console.log('🔧 Listando ferramentas disponíveis...');
    const response = await this.makeRequest('tools/list');
    console.log('📋 Ferramentas:', response);
    return response;
  }

  async callTool(name, arguments_ = {}) {
    console.log(`🛠️  Chamando ferramenta: ${name}`);
    const response = await this.makeRequest('tools/call', {
      name,
      arguments: arguments_
    });
    console.log(`📤 Resultado de ${name}:`, response);
    return response;
  }
}

async function runTests() {
  const client = new MCPTestClient();
  
  try {
    // 1. Inicializar
    await client.initialize();
    
    // 2. Listar ferramentas
    await client.listTools();
    
    // 3. Testar ferramentas (sem autenticação - vai falhar)
    console.log('\n🧪 Testando ferramentas (sem auth - deve falhar):');
    await client.callTool('get_my_vacations');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

if (require.main === module) {
  runTests();
}

module.exports = MCPTestClient;
