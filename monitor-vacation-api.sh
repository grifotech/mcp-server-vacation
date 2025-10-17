#!/bin/bash

# Script para monitorar o vacation-api na EC2
PEM_PATH="/Users/carlossilva/Documents/grifo/connect/grifo.pem"
EC2_HOST="ec2-user@ec2-54-237-29-143.compute-1.amazonaws.com"
VACATION_API_PATH="/home/ec2-user/node-workspace/vacation-api"

echo "🔍 Monitorando vacation-api na EC2..."
echo "📡 Host: $EC2_HOST"
echo "📁 Diretório: $VACATION_API_PATH"
echo ""

# Função para mostrar status do processo
show_status() {
    echo "📊 Status do Processo:"
    ssh -i "$PEM_PATH" "$EC2_HOST" "ps aux | grep 'node server.js' | grep -v grep"
    echo ""
    
    echo "🌐 Portas em Uso:"
    ssh -i "$PEM_PATH" "$EC2_HOST" "netstat -tlnp | grep :3000"
    echo ""
}

# Função para testar endpoints
test_endpoints() {
    echo "🧪 Testando Endpoints:"
    
    echo "• Teste 1 - Endpoint sem autenticação:"
    ssh -i "$PEM_PATH" "$EC2_HOST" "curl -s http://localhost:3000/rest/vacation/me 2>/dev/null || echo 'Erro na requisição'"
    echo ""
    
    echo "• Teste 2 - Endpoint com token inválido:"
    ssh -i "$PEM_PATH" "$EC2_HOST" "curl -s -H 'x-api-token: test' -H 'x-api-id: test' http://localhost:3000/rest/vacation/me 2>/dev/null || echo 'Erro na requisição'"
    echo ""
    
    echo "• Teste 3 - Endpoint admin:"
    ssh -i "$PEM_PATH" "$EC2_HOST" "curl -s -H 'x-admin-token: admin_super_secret_token_2024' http://localhost:3000/admin/users 2>/dev/null || echo 'Erro na requisição'"
    echo ""
}

# Função para monitorar logs em tempo real
monitor_logs() {
    echo "📝 Monitorando logs em tempo real (Ctrl+C para sair):"
    echo "---"
    
    # Monitorar o processo em tempo real
    ssh -i "$PEM_PATH" "$EC2_HOST" "cd $VACATION_API_PATH && tail -f /dev/null & sleep 1 && kill %1 2>/dev/null; echo 'Processo ativo - monitorando requisições...'"
    
    # Loop para monitorar requisições
    while true; do
        echo "$(date '+%H:%M:%S') - Verificando atividade..."
        
        # Verificar se o processo ainda está rodando
        if ! ssh -i "$PEM_PATH" "$EC2_HOST" "ps aux | grep 'node server.js' | grep -v grep" > /dev/null 2>&1; then
            echo "❌ Processo vacation-api não está mais rodando!"
            break
        fi
        
        sleep 5
    done
}

# Menu principal
case "${1:-status}" in
    "status")
        show_status
        ;;
    "test")
        test_endpoints
        ;;
    "monitor")
        monitor_logs
        ;;
    "restart")
        echo "🔄 Reiniciando vacation-api..."
        ssh -i "$PEM_PATH" "$EC2_HOST" "cd $VACATION_API_PATH && pkill -f 'node server.js' && sleep 2 && nohup node server.js > server.log 2>&1 &"
        echo "✅ Servidor reiniciado"
        ;;
    "logs")
        echo "📋 Últimas linhas do log:"
        ssh -i "$PEM_PATH" "$EC2_HOST" "cd $VACATION_API_PATH && tail -20 server.log 2>/dev/null || echo 'Nenhum log encontrado'"
        ;;
    *)
        echo "Uso: $0 {status|test|monitor|restart|logs}"
        echo ""
        echo "Comandos disponíveis:"
        echo "  status  - Mostra status do processo e portas"
        echo "  test    - Testa endpoints da API"
        echo "  monitor - Monitora logs em tempo real"
        echo "  restart - Reinicia o servidor"
        echo "  logs    - Mostra últimas linhas do log"
        ;;
esac
