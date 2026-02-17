/**
 * GET /api/users/:userId
 * Retorna dados públicos do perfil de um usuário
 * Retorna 403 se o usuário solicitante foi bloqueado pelo perfil alvo
 */
export const getUserProfileAPI = async (userId: string) => {
    const response = await fetch(`/api/users/${userId}`, {
        credentials: 'include',
    });

    if (!response.ok) {
        // Propagar o erro com status para tratamento no loader
        const error: any = new Error(`Erro ${response.status}: ${response.statusText}`);
        error.response = { status: response.status };

        try {
            const errorData = await response.json();
            error.message = errorData.error || error.message;
        } catch {
            // Se não conseguir fazer parse do JSON, manter mensagem original
        }

        throw error;
    }

    return await response.json();
};
