# MCP Vacation Server SSE

Servidor MCP (Model Context Protocol) para gerenciamento de férias com autenticação JWT e transporte HTTP streamable.

## 🚀 Como executar

### 1. Instalar dependências
```bash
npm install
```

### 2. Build do projeto
```bash
npm run build
```

### 3. Executar servidor
```bash
npm start
# ou
node build/index.js --port=8123
```

O servidor estará disponível em `http://localhost:8123`

## 🧪 Como testar

### Teste básico (sem autenticação)
```bash
node test-server.js
```

### Teste com cliente MCP
```bash
node test-client.js
```

### Teste com curl
```bash
# Inicializar conexão MCP
curl -X POST http://localhost:8123/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {"tools": {}},
      "clientInfo": {"name": "test-client", "version": "1.0.0"}
    }
  }'
```

## 🔐 Autenticação

O servidor requer autenticação JWT via header `Authorization: Bearer <token>`.

### Variáveis de ambiente
```bash
VACATION_API_URL=http://localhost:3000  # URL da API de férias
USER_SECRET=your-secret                 # Secret do usuário
USER_ID=user-id                         # ID do usuário
PORT=8123                               # Porta do servidor
```

## 🛠️ Ferramentas disponíveis

1. **get_my_vacations** - Busca dados das férias do usuário
2. **create_vacation_flow** - Inicia novo fluxo de férias
   - `diasParaGozo`: número de dias
   - `inicioFerias`: data no formato dd-mm-yyyy
3. **get_vacation_requirements** - Verifica requisitos da próxima etapa
4. **advance_vacation_wflow** - Avança o fluxo de férias
   - `data`: objeto com dados necessários

## 📡 Endpoints

- `POST /mcp` - Endpoint principal MCP (requer autenticação)
- `GET /mcp` - SSE stream para notificações (requer autenticação)

## 🔧 Desenvolvimento

```bash
# Modo desenvolvimento (watch)
npm run dev

# Build
npm run build

# Executar
npm start
```
