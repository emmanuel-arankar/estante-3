import { useState, useCallback, useEffect } from 'react';
import { ArrowLeft, Upload, Save, RotateCcw, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useDropzone } from 'react-dropzone';
import Cropper from 'react-easy-crop';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { LoadingSpinner } from './loading-spinner';
import { uploadProfileImage } from '../../services/storage';
import { useAuth } from '../../hooks/useAuth';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { toastSuccessClickable, toastErrorClickable } from './toast';
import { syncDenormalizedUserData } from '../../services/denormalizedFriendships';
import { saveUserAvatar, getUserAvatars, createAvatarPost } from '../../services/firestore';

interface PhotoEditorProps {
  currentPhotoURL?: string;
  onSave: (newPhotoURL: string) => void;
  onCancel: () => void;
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface UserAvatar {
  id: string;
  originalUrl: string;
  croppedUrl: string;
  uploadedAt: Date;
  isCurrent: boolean;
}

type EditorStep = 'selection' | 'upload' | 'crop' | 'previous';

export const AvatarEditorModal = ({ currentPhotoURL, onSave, onCancel }: PhotoEditorProps) => {
  const { user } = useAuth();
  const [step, setStep] = useState<EditorStep>('selection');
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [originalImage, setOriginalImage] = useState<string>('');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previousAvatars, setPreviousAvatars] = useState<UserAvatar[]>([]);
  const [selectedPreviousAvatar, setSelectedPreviousAvatar] = useState<string>('');
  const [loadingPrevious, setLoadingPrevious] = useState(false);

  useEffect(() => {
    if (currentPhotoURL) {
      setStep('selection');
      loadPreviousAvatars();
    } else {
      setStep('upload');
    }
  }, [currentPhotoURL]);

  const loadPreviousAvatars = async () => {
    if (!user) return;
    
    setLoadingPrevious(true);
    try {
      const avatars = await getUserAvatars(user.uid);
      setPreviousAvatars(avatars);
    } catch (error) {
      console.error('Erro ao carregar avatares anteriores:', error);
    } finally {
      setLoadingPrevious(false);
    }
  };

  const onCropComplete = useCallback((_: any, croppedAreaPixels: CropArea) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const imageUrl = reader.result as string;
        setSelectedImage(imageUrl);
        setOriginalImage(imageUrl);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setStep('crop');
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
  });

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', error => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  const getCroppedImg = async (
    imageSrc: string,
    pixelCrop: CropArea
  ): Promise<{ croppedBlob: Blob; originalBlob: Blob }> => {
    const image = await createImage(imageSrc);
    
    const croppedCanvas = document.createElement('canvas');
    const croppedCtx = croppedCanvas.getContext('2d');
    const originalCanvas = document.createElement('canvas');
    const originalCtx = originalCanvas.getContext('2d');

    if (!croppedCtx || !originalCtx) {
      throw new Error('No 2d context');
    }

    croppedCanvas.width = 300;
    croppedCanvas.height = 300;

    croppedCtx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      300,
      300
    );

    originalCanvas.width = image.width;
    originalCanvas.height = image.height;
    originalCtx.drawImage(image, 0, 0);

    return new Promise((resolve) => {
      croppedCanvas.toBlob((croppedBlob) => {
        originalCanvas.toBlob((originalBlob) => {
          if (!croppedBlob || !originalBlob) {
            throw new Error('Canvas is empty');
          }
          resolve({ croppedBlob, originalBlob });
        }, 'image/jpeg', 0.9);
      }, 'image/jpeg', 0.9);
    });
  };

  const handleSaveNewImage = async () => {
    if (!selectedImage || !croppedAreaPixels || !user) return;
  
    setIsUploading(true);
    try {
      const { croppedBlob, originalBlob } = await getCroppedImg(selectedImage, croppedAreaPixels);
      
      const croppedFile = new File([croppedBlob], 'avatar-cropped.jpg', { type: 'image/jpeg' });
      const originalFile = new File([originalBlob], 'avatar-original.jpg', { type: 'image/jpeg' });
  
      const [croppedUrl, originalUrl] = await Promise.all([
        uploadProfileImage( croppedFile, user.uid), 
        uploadProfileImage(originalFile, user.uid),
      ]);
  
      await saveUserAvatar(user.uid, {
        originalUrl,
        croppedUrl,
        isPublic: true,
        cropData: {
          x: crop.x,
          y: crop.y,
          zoom,
          croppedArea: croppedAreaPixels
        }
      });
  
      await createAvatarPost(user.uid, croppedUrl);
  
      await updateProfile(user, { photoURL: croppedUrl });
      await updateDoc(doc(db, 'users', user.uid), {
        photoURL: croppedUrl,
        updatedAt: new Date(),
      });

      // ✅ Sincronizar dados denormalizados
      await syncDenormalizedUserData(user.uid);

      onSave(croppedUrl);
      toastSuccessClickable('Avatar atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar avatar:', error);
      toastErrorClickable('Erro ao salvar avatar. Tente novamente.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSelectPreviousAvatar = async () => {
    if (!selectedPreviousAvatar || !user) return;

    setIsUploading(true);
    try {
      await updateProfile(user, { photoURL: selectedPreviousAvatar });
      await updateDoc(doc(db, 'users', user.uid), {
        photoURL: selectedPreviousAvatar,
        updatedAt: new Date(),
      });

      // ✅ Sincronizar dados denormalizados
      await syncDenormalizedUserData(user.uid);

      onSave(selectedPreviousAvatar);
      toastSuccessClickable('Avatar atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao selecionar avatar anterior:', error);
      toastErrorClickable('Erro ao atualizar avatar. Tente novamente.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleEditPreviousAvatar = async (avatar: UserAvatar) => {
    setSelectedImage(avatar.originalUrl);
    setOriginalImage(avatar.originalUrl);
    setStep('crop');
  };

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const handleBack = () => {
    if (step === 'crop') {
      setStep(currentPhotoURL ? 'selection' : 'upload');
      setSelectedImage('');
      setOriginalImage('');
    } else if (step === 'previous') {
      setStep('selection');
      setSelectedPreviousAvatar('');
    }
  };

  const renderHeader = () => (
    <div className="flex items-center justify-between p-6 border-b border-gray-200">
      <div className="flex items-center space-x-3">
        {(step === 'crop' || step === 'previous') && (
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <DialogTitle className="text-xl font-semibold">
          {step === 'selection' && 'Editar Avatar'}
          {step === 'upload' && 'Adicionar Foto de Perfil'}
          {step === 'crop' && 'Ajustar Imagem'}
          {step === 'previous' && 'Fotos Anteriores'}
        </DialogTitle>
      </div>
    </div>
  );

  const renderSelectionStep = () => (
    <div className="p-6 space-y-6">
      <div className="text-center">
        <p className="text-gray-600 mb-6">
          Escolha como deseja atualizar sua foto de perfil
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Button
          variant="outline"
          className="h-24 flex flex-col space-y-2 hover:bg-blue-50 hover:border-blue-300"
          onClick={() => setStep('upload')}
        >
          <Upload className="h-8 w-8 text-blue-600" />
          <span className="font-medium">Nova Imagem</span>
          <span className="text-sm text-gray-500">Carregar do dispositivo</span>
        </Button>

        <Button
          variant="outline"
          className="h-24 flex flex-col space-y-2 hover:bg-green-50 hover:border-green-300"
          onClick={() => setStep('previous')}
          disabled={previousAvatars.length === 0}
        >
          <div className="flex -space-x-1">
            {previousAvatars.slice(0, 3).map((avatar, index) => (
              <img
                key={avatar.id}
                src={avatar.croppedUrl}
                alt=""
                className="w-6 h-6 rounded-full border-2 border-white"
                style={{ zIndex: 3 - index }}
              />
            ))}
          </div>
          <span className="font-medium">Fotos Anteriores</span>
          <span className="text-sm text-gray-500">
            {previousAvatars.length} disponíveis
          </span>
        </Button>
      </div>
    </div>
  );

  const renderUploadStep = () => (
    <div className="p-6">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}
        `}
      >
        <input {...getInputProps()} />
        <Upload className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {isDragActive ? 'Solte a imagem aqui' : 'Adicionar foto'}
        </h3>
        <p className="text-gray-600 mb-4">
          Arraste uma imagem ou clique para selecionar
        </p>
        <p className="text-sm text-gray-500">
          PNG, JPG ou WEBP até 5MB
        </p>
      </div>
    </div>
  );

  const renderCropStep = () => (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 200px)' }}>
      {/* Container do cropper com altura dinâmica */}
      <div className="flex-1 relative bg-gray-900 overflow-hidden">
        <Cropper
          image={selectedImage}
          crop={crop}
          zoom={zoom}
          aspect={1}
          onCropChange={setCrop}
          onCropComplete={onCropComplete}
          onZoomChange={setZoom}
          cropShape="rect"
          showGrid={false}
          style={{
            containerStyle: {
              width: '100%',
              height: '100%',
              position: 'relative',
            },
            cropAreaStyle: {
              border: '2px solid rgba(255,255,255,0.8)',
            },
          }}
        />
      </div>
  
      {/* Barra de controles fixa na parte inferior */}
      <div className="p-4 sm:p-6 bg-gray-50 border-t space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">
              Zoom
            </label>
            <span className="text-sm text-gray-500">
              {Math.round(zoom * 100)}%
            </span>
          </div>
          <Slider
            value={[zoom]}
            onValueChange={(value) => setZoom(value[0])}
            min={1}
            max={3}
            step={0.001}
            className="w-full"
          />
        </div>
        
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
          <Button 
            type="button"
            variant="outline" 
            size="sm" 
            onClick={handleReset}
            disabled={zoom === 1 && crop.x === 0 && crop.y === 0}
            className="w-full sm:w-auto"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Resetar
          </Button>
  
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Button 
              type="button"
              variant="outline" 
              onClick={handleBack}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSaveNewImage}
              disabled={!selectedImage || isUploading}
              className="bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto"
            >
              {isUploading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Avatar
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPreviousStep = () => (
    <div className="p-6">
      {loadingPrevious ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="md" />
        </div>
      ) : previousAvatars.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <Upload className="h-16 w-16 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Nenhuma foto anterior
          </h3>
          <p className="text-gray-600">
            Você ainda não tem fotos salvas anteriormente
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {previousAvatars.map((avatar) => (
              <div
                key={avatar.id}
                className={`
                  relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all
                  ${selectedPreviousAvatar === avatar.croppedUrl 
                    ? 'border-emerald-500 ring-2 ring-emerald-200' 
                    : 'border-gray-200 hover:border-gray-300'
                  }
                `}
                onClick={() => setSelectedPreviousAvatar(avatar.croppedUrl)}
              >
                <img
                  src={avatar.croppedUrl}
                  alt="Avatar anterior"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/50">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-white hover:bg-white/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditPreviousAvatar(avatar);
                    }}
                  >
                    Editar
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-white hover:bg-white/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPreviousAvatar(avatar.croppedUrl);
                    }}
                  >
                    Usar Esta
                  </Button>
                </div>
                {avatar.isCurrent && (
                  <div className="absolute top-2 right-2 bg-emerald-600 text-white rounded-full p-1">
                    <Check className="h-3 w-3" />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3">
            <Button 
              type="button"
              variant="outline" 
              onClick={handleBack}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            {selectedPreviousAvatar && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const avatar = previousAvatars.find(a => a.croppedUrl === selectedPreviousAvatar);
                  if (avatar) handleEditPreviousAvatar(avatar);
                }}
                className="w-full sm:w-auto"
              >
                Editar Foto
              </Button>
            )}
            <Button
              type="button"
              onClick={handleSelectPreviousAvatar}
              disabled={!selectedPreviousAvatar || isUploading}
              className="bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto"
            >
              {isUploading ? (
                <LoadingSpinner size="sm" />
              ) : (
                'Usar Esta Foto'
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl p-0 overflow-hidden w-full" style={{ maxHeight: '95vh' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col"
        >
          {renderHeader()}
          
          <div className="overflow-y-auto">
            <AnimatePresence mode="wait">
              {step === 'selection' && (
                <motion.div
                  key="selection"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  {renderSelectionStep()}
                </motion.div>
              )}
              
              {step === 'upload' && (
                <motion.div
                  key="upload"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  {renderUploadStep()}
                </motion.div>
              )}
              
              {step === 'crop' && (
                <motion.div
                  key="crop"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  {renderCropStep()}
                </motion.div>
              )}
              
              {step === 'previous' && (
                <motion.div
                  key="previous"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  {renderPreviousStep()}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};