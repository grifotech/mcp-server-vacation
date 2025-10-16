import jwt from 'jsonwebtoken';
/**
 * Valida um token JWT localmente
 * @param token - O token JWT a ser validado
 * @param secret - O segredo para verificar a assinatura (opcional, se não fornecido, apenas decodifica)
 * @returns Resultado da validação
 */
export function validateJWT(token, secret) {
    try {
        // Primeiro, decodifica o token sem verificar a assinatura para obter o payload
        const decoded = jwt.decode(token);
        if (!decoded) {
            return {
                success: false,
                error: 'Token inválido ou malformado'
            };
        }
        // Verifica se o token não expirou
        const currentTime = Math.floor(Date.now() / 1000);
        if (decoded.exp && decoded.exp < currentTime) {
            return {
                success: false,
                error: 'Token expirado'
            };
        }
        // Se um segredo foi fornecido, verifica a assinatura
        if (secret) {
            try {
                jwt.verify(token, secret);
            }
            catch (verifyError) {
                return {
                    success: false,
                    error: 'Assinatura do token inválida'
                };
            }
        }
        // Gera um "secret" baseado no payload para compatibilidade com o sistema existente
        const generatedSecret = generateSecretFromPayload(decoded);
        return {
            success: true,
            payload: decoded,
            secret: generatedSecret
        };
    }
    catch (error) {
        return {
            success: false,
            error: `Erro ao validar token: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
        };
    }
}
/**
 * Gera um secret baseado no payload do JWT para compatibilidade com o sistema existente
 * @param payload - O payload do JWT
 * @returns Secret gerado
 */
function generateSecretFromPayload(payload) {
    // Usa uma combinação de campos do payload para gerar um secret único
    const secretData = {
        vaultId: payload.vaultId,
        vaultName: payload.vaultName,
        link: payload.link,
        iat: payload.iat
    };
    return Buffer.from(JSON.stringify(secretData)).toString('base64');
}
/**
 * Extrai informações do token para uso nas requisições da API
 * @param payload - O payload do JWT
 * @returns Objeto com informações extraídas
 */
export function extractTokenInfo(payload) {
    return {
        vaultId: payload.vaultId,
        vaultName: payload.vaultName,
        link: payload.link,
        key: payload.key,
        accessTime: payload.accessTime
    };
}
