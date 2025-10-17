import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { uploadImage } from '../../services/storage';
import { LoadingSpinner } from './loading-spinner';
import { toastSuccessClickable, toastErrorClickable } from './toast';

interface ImageUploadProps {
  onUpload: (url: string) => void;
  path: string;
  maxFiles?: number;
  accept?: Record<string, string[]>;
  className?: string;
  preview?: boolean;
}

export const ImageUpload = ({
  onUpload,
  path,
  maxFiles = 1,
  accept = {
    'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
  },
  className = '',
  preview = true
}: ImageUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    setUploading(true);
    
    try {
      const uploadPromises = acceptedFiles.map(async (file) => {
        const url = await uploadImage(file, path);
        return url;
      });

      const urls = await Promise.all(uploadPromises);
      
      if (maxFiles === 1) {
        onUpload(urls[0]);
        setUploadedImages([urls[0]]);
      } else {
        urls.forEach(url => onUpload(url));
        setUploadedImages(prev => [...prev, ...urls]);
      }

      toastSuccessClickable(`${urls.length} imagem(ns) enviada(s) com sucesso!`);
    } catch (error) {
      toastErrorClickable('Erro ao enviar imagem. Tente novamente.');
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
    }
  }, [onUpload, path, maxFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxFiles,
    disabled: uploading
  });

  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <Card className="border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors">
        <CardContent className="p-6">
          <div
            {...getRootProps()}
            className={`cursor-pointer text-center ${
              isDragActive ? 'bg-blue-50 border-blue-300' : ''
            }`}
          >
            <input {...getInputProps()} />
            
            {uploading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <LoadingSpinner size="lg" />
                <p className="mt-4 text-gray-600">Enviando imagem...</p>
              </div>
            ) : (
              <div className="py-8">
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-lg font-medium text-gray-900 mb-2">
                  {isDragActive
                    ? 'Solte as imagens aqui...'
                    : 'Arraste e solte imagens aqui'}
                </p>
                <p className="text-gray-600 mb-4">
                  ou clique para selecionar arquivos
                </p>
                <Button variant="outline" type="button">
                  Selecionar Imagens
                </Button>
                <p className="text-xs text-gray-500 mt-2">
                  PNG, JPG, GIF até 10MB • Máximo {maxFiles} arquivo(s)
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview das imagens */}
      {preview && uploadedImages.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {uploadedImages.map((url, index) => (
            <div key={index} className="relative group">
              <img
                src={url}
                alt={`Upload ${index + 1}`}
                className="w-full h-32 object-cover rounded-lg border border-gray-200"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removeImage(index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};