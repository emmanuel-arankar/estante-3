import {
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject,
    UploadMetadata
} from 'firebase/storage';
import { storage } from './firebase';
import { CACHE_CONFIGS } from '@/lib/cdn';

/**
 * Faz o upload de um arquivo para o Firebase Storage com cache headers
 * @param file O arquivo (Blob ou File) a ser enviado
 * @param path O caminho no storage (ex: 'avatars/uid.png' ou 'chats/chatid/audio.webm')
 * @param cacheControl Configuração de cache (padrão: 1 dia)
 * @returns A URL de download do arquivo
 */
export const uploadImage = async (
    file: Blob | File,
    path: string,
    cacheControl: string = CACHE_CONFIGS.POST_IMAGE
): Promise<string> => {
    try {
        const storageRef = ref(storage, path);

        // Configurar metadata com cache headers
        const metadata: UploadMetadata = {
            contentType: file.type,
            cacheControl, // Cache otimizado para CDN
        };

        const snapshot = await uploadBytes(storageRef, file, metadata);
        const downloadURL = await getDownloadURL(snapshot.ref);
        return downloadURL;
    } catch (error) {
        console.error('Error uploading file:', error);
        throw error;
    }
};

/**
 * Faz o upload de foto de perfil com cache otimizado
 * @param file O arquivo da imagem
 * @param uid UID do usuário
 * @returns A URL de download
 */
export const uploadProfileImage = async (file: Blob | File, uid: string): Promise<string> => {
    const extension = file.type.split('/')[1] || 'jpg';
    // Incluir timestamp no nome para cache-busting quando trocar foto
    const fileName = `avatar_${Date.now()}.${extension}`;
    const path = `avatars/${uid}/${fileName}`;

    // Cache de 1 dia para fotos de perfil (podem mudar ocasionalmente)
    return uploadImage(file, path, CACHE_CONFIGS.PROFILE_PHOTO);
};

/**
 * Remove um arquivo do Firebase Storage
 * @param path O caminho/URL do arquivo a ser removido
 */
export const deleteFile = async (path: string): Promise<void> => {
    try {
        // Se for uma URL completa, precisamos extrair o path ou criar o ref a partir dela
        // O firebase/storage permite criar ref a partir de URL
        const storageRef = ref(storage, path);
        await deleteObject(storageRef);
    } catch (error) {
        console.error('Error deleting file:', error);
        // Não lançamos erro aqui para não quebrar o fluxo se o arquivo já não existir
    }
};
