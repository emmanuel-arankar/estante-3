import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

// Interface para metadata de cache
interface UploadOptions {
  fileName?: string;
  cacheControl?: string;
  contentType?: string;
}

export const uploadImage = async (
  file: File,
  path: string,
  options: UploadOptions = {}
): Promise<string> => {
  const {
    fileName = `${Date.now()}_${file.name}`,
    cacheControl = 'public, max-age=31536000, immutable', // ✅ Cache de 1 ano
    contentType = file.type
  } = options;

  const storageRef = ref(storage, `${path}/${fileName}`);
  
  // Metadata com headers de cache
  const metadata = {
    cacheControl,
    contentType,
    customMetadata: {
      uploadedAt: Date.now().toString(),
      originalName: file.name
    }
  };
  
  // Faz upload com metadata
  const snapshot = await uploadBytes(storageRef, file, metadata);
  const downloadURL = await getDownloadURL(snapshot.ref);
  
  console.log('📸 Imagem salva com cache:', downloadURL);
  return downloadURL;
};

export const uploadProfileImage = async (file: File, userId: string): Promise<string> => {
  const fileName = `avatar_${Date.now()}.jpg`;
  const downloadURL = await uploadImage(file, `profiles/${userId}`, {
    fileName,
    cacheControl: 'public, max-age=31536000, immutable', // ✅ Cache agressivo para avatares
    contentType: 'image/jpeg'
  });
  
  console.log('📸 Foto de perfil salva com cache:', downloadURL);
  return downloadURL;
};

export const uploadBookCover = async (file: File, bookId: string): Promise<string> => {
  return uploadImage(file, `books/${bookId}`, {
    fileName: `cover_${Date.now()}.jpg`,
    cacheControl: 'public, max-age=2592000', // ✅ 30 dias para capas de livros
    contentType: 'image/jpeg'
  });
};

export const uploadPostMedia = async (file: File, postId: string): Promise<string> => {
  return uploadImage(file, `posts/${postId}`, {
    fileName: `media_${Date.now()}.jpg`,
    cacheControl: 'public, max-age=604800', // ✅ 7 dias para mídia de posts
    contentType: 'image/jpeg'
  });
};

// ✅ FUNÇÃO PARA ATUALIZAR IMAGENS EXISTENTES (executar uma vez)
export const updateExistingImagesCache = async (): Promise<void> => {
  try {
    // Esta função requer mais implementação específica
    // Você precisaria listar todos os arquivos e atualizar um por um
    console.log('⚠️ Função de updateExistingImagesCache precisa ser implementada');
    console.log('📝 Para imagens existentes, considere fazer reupload ou usar a versão nova do upload');
  } catch (error) {
    console.error('Erro ao atualizar cache de imagens existentes:', error);
  }
};

export const deleteImage = async (imageUrl: string): Promise<void> => {
  try {
    const imageRef = ref(storage, imageUrl);
    await deleteObject(imageRef);
    console.log('🗑️ Imagem deletada:', imageUrl);
  } catch (error) {
    console.error('Erro ao deletar imagem:', error);
    throw error;
  }
};

export const getImageMetadata = async (): Promise<void> => {
  try {
    console.log('ℹ️  Para ver metadata, você precisa da reference original do arquivo');
  } catch (error) {
    console.error('Erro ao verificar metadata:', error);
  }
};