#!/bin/bash

# Script para deploy do mcp-server-vacation para EC2
# Configurações
PEM_PATH="/Users/carlossilva/Documents/grifo/connect/grifo.pem"
EC2_HOST="ec2-user@ec2-54-237-29-143.compute-1.amazonaws.com"
REMOTE_PATH="/home/ec2-user/node-workspace/mcp-server-vacation"
LOCAL_PATH="/Users/carlossilva/Documents/grifo/workspace/mcp-server-vacation"

echo "🚀 Iniciando deploy do mcp-server-vacation para EC2..."
echo "📁 Origem: $LOCAL_PATH"
echo "🎯 Destino: $EC2_HOST:$REMOTE_PATH"
echo ""

# 1. Criar diretório remoto se não existir
echo "📂 Criando diretório remoto..."
ssh -i "$PEM_PATH" "$EC2_HOST" "mkdir -p $REMOTE_PATH"

# 2. Remover conteúdo anterior (exceto node_modules se existir)
echo "🧹 Limpando diretório remoto..."
ssh -i "$PEM_PATH" "$EC2_HOST" "cd $REMOTE_PATH && find . -maxdepth 1 -not -name 'node_modules' -not -name '.' -exec rm -rf {} + 2>/dev/null || true"

# 3. Copiar arquivos do projeto (excluindo node_modules)
echo "📦 Copiando arquivos do projeto..."
rsync -avz --progress \
  --exclude 'node_modules/' \
  --exclude '.git/' \
  --exclude '*.log' \
  --exclude '.DS_Store' \
  -e "ssh -i $PEM_PATH" \
  "$LOCAL_PATH/" \
  "$EC2_HOST:$REMOTE_PATH/"

# 4. Instalar dependências no servidor
echo "📥 Instalando dependências no servidor..."
ssh -i "$PEM_PATH" "$EC2_HOST" "cd $REMOTE_PATH && npm install --production"

# 5. Compilar o projeto
echo "🔨 Compilando projeto..."
ssh -i "$PEM_PATH" "$EC2_HOST" "cd $REMOTE_PATH && npm run build"

# 6. Dar permissões de execução
echo "🔐 Configurando permissões..."
ssh -i "$PEM_PATH" "$EC2_HOST" "chmod +x $REMOTE_PATH/build/index.js"

# 7. Atualizar arquivo de serviço systemd
echo "⚙️  Atualizando arquivo de serviço systemd..."
ssh -i "$PEM_PATH" "$EC2_HOST" "sudo tee /etc/systemd/system/mcp.service > /dev/null << 'EOF'
[Unit]
Description=MCP Server System
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=$REMOTE_PATH
ExecStart=/usr/bin/node $REMOTE_PATH/build/index.js
Restart=always
RestartSec=5
Environment=BEARER_TOKEN=grifo@123321 PORT=3001
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF"

# 8. Recarregar systemd
echo "🔄 Recarregando systemd..."
ssh -i "$PEM_PATH" "$EC2_HOST" "sudo systemctl daemon-reload"

# 9. Reiniciar o serviço
echo "🔄 Reiniciando serviço mcp..."
ssh -i "$PEM_PATH" "$EC2_HOST" "sudo systemctl restart mcp"

# 10. Verificar status do serviço
echo "📊 Verificando status do serviço..."
ssh -i "$PEM_PATH" "$EC2_HOST" "sudo systemctl status mcp --no-pager"

echo ""
echo "✅ Deploy concluído com sucesso!"
echo "🎯 Projeto disponível em: $EC2_HOST:$REMOTE_PATH"
echo "🔧 Serviço systemd atualizado e reiniciado"
echo ""
echo "📋 Comandos úteis para gerenciar o serviço:"
echo "   • Parar serviço: ssh -i $PEM_PATH $EC2_HOST 'sudo systemctl stop mcp'"
echo "   • Iniciar serviço: ssh -i $PEM_PATH $EC2_HOST 'sudo systemctl start mcp'"
echo "   • Reiniciar serviço: ssh -i $PEM_PATH $EC2_HOST 'sudo systemctl restart mcp'"
echo "   • Status do serviço: ssh -i $PEM_PATH $EC2_HOST 'sudo systemctl status mcp'"
echo "   • Ver logs: ssh -i $PEM_PATH $EC2_HOST 'sudo journalctl -u mcp -f'"
echo ""
echo "🌐 Aplicação configurada para rodar na porta 3001"
echo "🔗 URL: http://$(echo $EC2_HOST | cut -d'@' -f2 | cut -d'.' -f1-4):3001"
