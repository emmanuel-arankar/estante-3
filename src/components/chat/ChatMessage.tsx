import { useState } from 'react';
import { Check, CheckCheck, MoreVertical, Reply, Copy, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChatMessage as ChatMessageType } from '../../models';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ChatMessageProps {
  message: ChatMessageType;
  isOwn: boolean;
  showAvatar?: boolean;
}

export const ChatMessage = ({ message, isOwn, showAvatar = true }: ChatMessageProps) => {
  const [showActions, setShowActions] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
  };

  const handleReply = () => {
    // TODO: Implementar funcionalidade de resposta
  };

  const handleDelete = () => {
    // TODO: Implementar funcionalidade de deletar
  };

  return (
    <motion.div
      className={cn(
        "flex items-end space-x-2 group",
        isOwn ? "justify-end" : "justify-start"
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      whileHover={{ scale: 1.01 }}
    >
      {/* Avatar do remetente (apenas para mensagens de outros) */}
      {!isOwn && showAvatar && (
        <Avatar className="h-8 w-8 mb-1">
          <AvatarImage 
            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${message.senderId}`} 
            alt="Avatar" 
          />
          <AvatarFallback className="text-xs">
            {message.senderId.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}

      {/* Espaçador quando não há avatar */}
      {!isOwn && !showAvatar && <div className="w-8" />}

      {/* Ações da mensagem (lado esquerdo para mensagens próprias) */}
      {isOwn && (
        <div className={cn(
          "flex items-center space-x-1 opacity-0 transition-opacity",
          showActions && "opacity-100"
        )}>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleReply}>
            <Reply className="h-3 w-3" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleCopy}>
                <Copy className="h-4 w-4 mr-2" />
                Copiar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleReply}>
                <Reply className="h-4 w-4 mr-2" />
                Responder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDelete} className="text-red-600">
                <Trash2 className="h-4 w-4 mr-2" />
                Deletar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Conteúdo da mensagem */}
      <div className={cn(
        "flex flex-col max-w-xs lg:max-w-md",
        isOwn ? "items-end" : "items-start"
      )}>
        {/* Balão da mensagem */}
        <div
          className={cn(
            "px-4 py-2 rounded-2xl shadow-sm",
            isOwn
              ? "bg-emerald-600 text-white rounded-br-md"
              : "bg-white text-gray-900 border border-gray-200 rounded-bl-md"
          )}
        >
          {message.type === 'text' ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {message.content}
            </p>
          ) : message.type === 'image' ? (
            <div className="space-y-2">
              <img
                src={message.content}
                alt="Imagem enviada"
                className="rounded-lg max-w-full h-auto"
              />
            </div>
          ) : (
            <div className="flex items-center space-x-2 p-2 bg-gray-100 rounded-lg">
              <div className="text-sm">
                <p className="font-medium">Livro compartilhado</p>
                <p className="text-gray-600">{message.content}</p>
              </div>
            </div>
          )}
        </div>

        {/* Informações da mensagem */}
        <div className={cn(
          "flex items-center space-x-1 mt-1 text-xs text-gray-500",
          isOwn ? "flex-row-reverse space-x-reverse" : "flex-row"
        )}>
          <span>
            {formatDistanceToNow(message.createdAt, { 
              addSuffix: true, 
              locale: ptBR 
            })}
          </span>
          
          {/* Status de leitura (apenas para mensagens próprias) */}
          {isOwn && (
            <div className="flex items-center">
              {message.readAt ? (
                <CheckCheck className="h-3 w-3 text-blue-500" />
              ) : (
                <Check className="h-3 w-3" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Ações da mensagem (lado direito para mensagens de outros) */}
      {!isOwn && (
        <div className={cn(
          "flex items-center space-x-1 opacity-0 transition-opacity",
          showActions && "opacity-100"
        )}>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleReply}>
            <Reply className="h-3 w-3" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={handleCopy}>
                <Copy className="h-4 w-4 mr-2" />
                Copiar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleReply}>
                <Reply className="h-4 w-4 mr-2" />
                Responder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </motion.div>
  );
};