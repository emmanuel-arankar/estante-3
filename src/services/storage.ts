import {
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from 'firebase/storage';
import { storage } from './firebase';

/**
 * Faz o upload de um arquivo para o Firebase Storage
 * @param file O arquivo (Blob ou File) a ser enviado
 * @param path O caminho no storage (ex: 'avatars/uid.png' ou 'chats/chatid/audio.webm')
 * @returns A URL de download do arquivo
 */
export const uploadImage = async (file: Blob | File, path: string): Promise<string> => {
    try {
        const storageRef = ref(storage, path);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        return downloadURL;
    } catch (error) {
        console.error('Error uploading file:', error);
        throw error;
    }
};

/**
 * Faz o upload de foto de perfil
 * @param file O arquivo da imagem
 * @param uid UID do usuário
 * @returns A URL de download
 */
export const uploadProfileImage = async (file: Blob | File, uid: string): Promise<string> => {
    const extension = file.type.split('/')[1] || 'jpg';
    const fileName = `avatar_${Date.now()}.${extension}`;
    const path = `avatars/${uid}/${fileName}`;
    return uploadImage(file, path);
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
