import { apiClient } from '@/services/apiClient';

/**
 * Faz o upload de um arquivo usando Signed URLs do backend.
 * @description Mais seguro: as credenciais do storage ficam apenas no servidor.
 * 
 * @param file O arquivo (Blob ou File) a ser enviado
 * @param folder Pasta destino ('avatars', 'chats', 'posts')
 * @returns A URL pública de download do arquivo
 */
export const uploadFile = async (
    file: Blob | File,
    folder: 'avatars' | 'chats' | 'posts' = 'posts'
): Promise<string> => {
    try {
        // 1. Solicitar URL assinada ao Backend
        const fileName = (file as File).name || `file_${Date.now()}`;
        const { uploadUrl, fileUrl } = await apiClient<{ uploadUrl: string; fileUrl: string }>(
            '/storage/signed-url',
            {
                method: 'POST',
                data: {
                    fileName,
                    contentType: file.type,
                    folder,
                },
            }
        );

        // 2. Upload direto via PUT (browser -> Google Cloud Storage)
        const response = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': file.type,
            },
            body: file,
        });

        if (!response.ok) {
            throw new Error(`Erro no upload direto: ${response.statusText}`);
        }

        return fileUrl;
    } catch (error) {
        console.error('Error in secure upload:', error);
        throw error;
    }
};

/**
 * Legado/Compatibilidade: Faz o upload de imagem (adaptado para usar a nova lógica)
 */
export const uploadImage = async (
    file: Blob | File,
    path: string, // Ignorado na nova lógica, folder é inferido se possível
    _cacheControl?: string
): Promise<string> => {
    const folder = path.startsWith('avatars') ? 'avatars' :
        path.startsWith('chats') ? 'chats' : 'posts';
    return uploadFile(file, folder as any);
};

/**
 * Faz o upload de foto de perfil com segurança via backend
 * @param file O arquivo da imagem
 * @param _uid UID do usuário (não mais necessário, backend usa token)
 * @returns A URL de download
 */
export const uploadProfileImage = async (file: Blob | File, _uid?: string): Promise<string> => {
    return uploadFile(file, 'avatars');
};

/**
 * Remove um arquivo do Firebase Storage via Backend
 * @param path O caminho do arquivo a ser removido
 */
export const deleteFile = async (path: string): Promise<void> => {
    try {
        await apiClient('/storage', {
            method: 'DELETE',
            data: { path },
        });
    } catch (error) {
        console.error('Error deleting file:', error);
    }
};
