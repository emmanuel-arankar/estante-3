import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, MessageCircle } from 'lucide-react';
import { OnlineStatus } from '@/components/chat/OnlineStatus';
import {
  Avatar,
  AvatarFallback,
  AvatarImage
} from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  toastSuccessClickable,
  toastErrorClickable
} from '@/components/ui/toast';
import { useAuth } from '@/hooks/useAuth';
import { searchUsersAPI } from '@/services/api';
import { PATHS } from '@/router/paths';
import { User } from '@estante/common-types';

interface NewConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewConversationModal = ({ isOpen, onClose }: NewConversationModalProps) => {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const searchCacheRef = useRef<Map<string, User[]>>(new Map());

  // Buscar usuários
  const searchUsers = async (searchTerm: string) => { // atualizado
    if (!searchTerm.trim() || searchTerm.length < 2) {
      setUsers([]);
      return;
    }

    // Check cache
    if (searchCacheRef.current.has(searchTerm)) {
      setUsers(searchCacheRef.current.get(searchTerm)!);
      return;
    }

    setLoading(true);
    try {
      const foundUsers = await searchUsersAPI(searchTerm);
      let finalUsers = foundUsers;

      // Sugestão 1: Filtrar o usuário logado dos resultados
      if (currentUser) {
        finalUsers = foundUsers.filter(user => user.id !== currentUser.uid);
      }

      // Update cache and state
      searchCacheRef.current.set(searchTerm, finalUsers);
      setUsers(finalUsers);

    } catch (error) {
      console.error('Erro ao buscar usuários:', error);

      // Sugestão 2: Mostrar um erro mais específico
      let errorMessage = 'Erro ao buscar usuários';
      if (error instanceof Error) {
        // Mostra a mensagem de erro real da API, se disponível
        errorMessage = error.message || errorMessage;
      }
      toastErrorClickable(errorMessage);

    } finally {
      setLoading(false);
    }
  };

  // Debounce da busca
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Iniciar conversa
  const handleStartConversation = (user: User) => {
    onClose();
    navigate(PATHS.CHAT({ receiverId: user.id }));
    toastSuccessClickable(`Conversa iniciada com ${user.displayName}`);
  };

  // Limpar ao fechar
  const handleClose = () => {
    setSearchQuery('');
    setUsers([]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <MessageCircle className="h-5 w-5 text-emerald-600" />
            <span>Nova Conversa</span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Busque um amigo pelo nome ou nickname para iniciar uma nova conversa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Buscar por nome ou @nickname..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-gray-50 border-gray-200 focus:bg-white focus:border-emerald-500"
            />
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto pr-2">
            {loading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="md" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8">
                {searchQuery.length < 2 ? (
                  <div className="text-gray-500">
                    <MessageCircle className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p>Digite pelo menos 2 caracteres para buscar</p>
                  </div>
                ) : (
                  <div className="text-gray-500">
                    <Search className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p>Nenhum usuário encontrado</p>
                    <p className="text-sm">Tente buscar por nome ou @nickname</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {users.map((user, index) => (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent
                        className="p-3"
                        onClick={() => handleStartConversation(user)}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="relative">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={user.photoURL} alt={user.displayName} />
                              <AvatarFallback className="bg-emerald-100 text-emerald-700">
                                {user.displayName.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <OnlineStatus
                              userId={user.id}
                              className="absolute -bottom-1 -right-1"
                            />
                          </div>

                          <div className="flex-1 min-w-0 max-w-full overflow-hidden">
                            <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                              <h3 className="font-semibold text-gray-900 truncate max-w-[150px]">
                                {user.displayName}
                              </h3>
                              {user.nickname && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 h-4 font-medium shrink-0">
                                  @{user.nickname}
                                </Badge>
                              )}
                            </div>
                            {user.bio && (
                              <p className="text-xs text-gray-600 line-clamp-1 break-words">
                                {user.bio.replace(/<[^>]*>/g, '')}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[10px] text-gray-500 font-medium">
                              <span>{user.booksRead || 0} livros lidos</span>
                              <span>{user.followers || 0} seguidores</span>
                            </div>
                          </div>

                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 rounded-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartConversation(user);
                            }}
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-4 border-t border-gray-100">
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};