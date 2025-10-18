#!/bin/bash

# Script para deploy do mcp-server-vacation para EC2
# Configurações
PEM_PATH="/Users/carlossilva/Documents/grifo/connect/grifo.pem"
EC2_HOST="ec2-user@ec2-54-237-29-143.compute-1.amazonaws.com"
REMOTE_PATH="/home/ec2-user/node-workspace/mcp-server-vacation"
LOCAL_PATH="/Users/carlossilva/Documents/grifo/workspace/mcp-server-vacation"

echo "🚀 Iniciando deploy para EC2..."
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

echo ""
echo "✅ Deploy concluído com sucesso!"
echo "🎯 Projeto disponível em: $EC2_HOST:$REMOTE_PATH"
echo ""
echo "📋 Comandos úteis para gerenciar o servidor:"
echo "   • Iniciar servidor: ssh -i $PEM_PATH $EC2_HOST 'cd $REMOTE_PATH && npm start'"
echo "   • Parar servidor: ssh -i $PEM_PATH $EC2_HOST 'pkill -f \"node build/index.js\"'"
echo "   • Ver logs: ssh -i $PEM_PATH $EC2_HOST 'cd $REMOTE_PATH && npm start'"
echo "   • Acessar diretório: ssh -i $PEM_PATH $EC2_HOST 'cd $REMOTE_PATH'"
