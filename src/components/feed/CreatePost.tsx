import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Image, BookOpen, Quote, MessageSquare, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImageUpload } from '../ui/image-upload';
import { useAuth } from '../../hooks/useAuth';
import { LoadingSpinner } from '../ui/loading-spinner';
import { useQuery } from '@tanstack/react-query';
import { userQuery } from '@/features/users/user.queries';
import { motion } from 'framer-motion';

const createPostSchema = z.object({
  content: z.string().min(1, 'O conteúdo é obrigatório').max(1000, 'Máximo 1000 caracteres'),
  type: z.enum(['status', 'review', 'quote', 'discussion']),
  bookId: z.string().optional(),
});

type CreatePostForm = z.infer<typeof createPostSchema>;

interface CreatePostProps {
  onSubmit: (data: CreatePostForm) => Promise<void>;
}

export const CreatePost = ({ onSubmit }: CreatePostProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const { user } = useAuth();
  const { data: profile } = useQuery({
    ...userQuery(user?.uid || ''),
    enabled: !!user?.uid,
  });

  const form = useForm<CreatePostForm>({
    resolver: zodResolver(createPostSchema),
    defaultValues: {
      content: '',
      type: 'status',
    },
  });

  const handleSubmit = async (data: CreatePostForm) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
      form.reset();
      setIsExpanded(false);
      setShowImageUpload(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageUpload = () => {
    console.log('Image upload');
  };

  const postTypes = [
    { value: 'status', label: 'Status', icon: MessageSquare },
    { value: 'review', label: 'Resenha', icon: BookOpen },
    { value: 'quote', label: 'Citação', icon: Quote },
    { value: 'discussion', label: 'Discussão', icon: MessageSquare },
  ];

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Compartilhar</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start space-x-4">
          <Avatar className="h-10 w-10">
            <AvatarImage src={profile?.photoURL} alt={profile?.displayName} />
            <AvatarFallback>
              {profile?.displayName?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <Textarea
              placeholder="O que você está lendo hoje?"
              className="min-h-[80px] resize-none border-none shadow-none focus:ring-0 p-0 text-base"
              onFocus={() => setIsExpanded(true)}
              {...form.register('content')}
            />
            {form.formState.errors.content && (
              <p className="text-sm text-red-600 mt-1">
                {form.formState.errors.content.message}
              </p>
            )}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ 
            opacity: isExpanded ? 1 : 0, 
            height: isExpanded ? 'auto' : 0 
          }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="space-y-4 pt-4 border-t border-gray-100">
            <div className="flex items-center space-x-4">
              <Select onValueChange={(value) => form.setValue('type', value as any)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Tipo de post" />
                </SelectTrigger>
                <SelectContent>
                  {postTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center space-x-2">
                        <type.icon className="h-4 w-4" />
                        <span>{type.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Image Upload */}
            {showImageUpload && (
              <ImageUpload
                onUpload={handleImageUpload}
                path={`posts/${Date.now()}`}
                maxFiles={4}
                className="mt-4"
              />
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  type="button"
                  onClick={() => setShowImageUpload(!showImageUpload)}
                  className={showImageUpload ? 'bg-blue-50 text-blue-600' : ''}
                >
                  <Image className="h-4 w-4 mr-2" />
                  Foto
                </Button>
                <Button variant="ghost" size="sm" type="button">
                  <BookOpen className="h-4 w-4 mr-2" />
                  Livro
                </Button>
              </div>
              <Button 
                onClick={form.handleSubmit(handleSubmit)}
                disabled={!form.watch('content') || isSubmitting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Publicar
                  </>
                )}
              </Button>
            </div>
          </div>
        </motion.div>

        {!isExpanded && (
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <div className="flex items-center space-x-2">
              <Button 
                variant="ghost" 
                size="sm" 
                type="button"
                onClick={() => {
                  setIsExpanded(true);
                  setShowImageUpload(true);
                }}
              >
                <Image className="h-4 w-4 mr-2" />
                Foto
              </Button>
              <Button variant="ghost" size="sm" type="button">
                <BookOpen className="h-4 w-4 mr-2" />
                Livro
              </Button>
            </div>
            <Button 
              onClick={form.handleSubmit(handleSubmit)}
              disabled={!form.watch('content') || isSubmitting}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Publicar
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};