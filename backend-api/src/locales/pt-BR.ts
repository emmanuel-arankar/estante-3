export const ptBR = {
    common: {
        internalError: 'Ocorreu um erro interno no servidor.',
        validationError: 'Dados inválidos na requisição',
        maintenanceMode: 'O sistema está em manutenção. Por favor, tente novamente mais tarde.',
        rateLimit: 'Muitas requisições. Tente novamente em 15 minutos.',
        timeout: 'A requisição demorou muito para responder.',
        unauthorized: 'Não autorizado. Por favor, faça login.',
        forbidden: 'Você não tem permissão para realizar esta ação.',
        notFound: 'Recurso não encontrado.',
    },
    auth: {
        loginSuccess: 'Login realizado com sucesso.',
        userCreated: 'Usuário criado com sucesso.',
        nicknameTaken: 'Este nickname já está em uso.',
    },
    chat: {
        messageSent: 'Mensagem enviada.',
        messageDeleted: 'Mensagem excluída.',
    },
    users: {
        profileUpdated: 'Perfil atualizado com sucesso.',
        avatarUpdated: 'Avatar atualizado.',
        userNotFound: 'Usuário não encontrado.',
    }
};

export type TranslationKeys = typeof ptBR;
