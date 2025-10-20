import { useState, useRef } from 'react';
import { Send, Image, Smile, Paperclip, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ImageUpload } from '../ui/image-upload';
import EmojiPicker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { motion } from 'framer-motion';

interface ChatInputProps {
  onSendMessage: (content: string, type?: 'text' | 'image') => Promise<void>;
  disabled?: boolean;
}

export const ChatInput = ({ onSendMessage, disabled = false }: ChatInputProps) => {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    if (!message.trim() || disabled) return;

    try {
      await onSendMessage(message.trim());
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiSelect = (emoji: any) => {
    setMessage(prev => prev + emoji.native);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  };

  const handleImageUpload = async (url: string) => {
    try {
      await onSendMessage(url, 'image');
      setShowImageUpload(false);
    } catch (error) {
      console.error('Erro ao enviar imagem:', error);
    }
  };

  const handleVoiceRecord = () => {
    setIsRecording(!isRecording);
    // TODO: Implementar gravação de áudio
  };

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    
    // Auto-resize
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  };

  return (
    <div className="space-y-3">
      {/* Image Upload */}
      {showImageUpload && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="border border-gray-200 rounded-lg p-3"
        >
          <ImageUpload
            onUpload={handleImageUpload}
            path={`chat/${Date.now()}`}
            maxFiles={1}
            className="border-2 border-dashed border-gray-300 rounded-lg p-4"
          />
        </motion.div>
      )}

      {/* Main Input */}
      <div className="flex items-end space-x-3">
        {/* Actions */}
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowImageUpload(!showImageUpload)}
            className={`h-9 w-9 rounded-full ${showImageUpload ? 'bg-blue-100 text-blue-600' : ''}`}
          >
            <Image className="h-4 w-4" />
          </Button>

          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
            <Paperclip className="h-4 w-4" />
          </Button>
        </div>

        {/* Text Input */}
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={handleTextareaChange}
            onKeyPress={handleKeyPress}
            placeholder="Digite sua mensagem..."
            disabled={disabled}
            className="min-h-[44px] max-h-[120px] resize-none rounded-full border-gray-300 focus:border-emerald-500 focus:ring-emerald-500 pr-12"
            rows={1}
          />
          
          {/* Emoji Picker */}
          <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 rounded-full"
              >
                <Smile className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 border-0 shadow-lg" align="end">
              <EmojiPicker
                data={data}
                onEmojiSelect={handleEmojiSelect}
                theme="light"
                locale="pt"
                previewPosition="none"
                skinTonePosition="none"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Send/Voice Button */}
        {message.trim() ? (
          <Button
            onClick={handleSend}
            disabled={disabled}
            className="h-11 w-11 rounded-full bg-emerald-600 hover:bg-emerald-700 p-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleVoiceRecord}
            disabled={disabled}
            variant={isRecording ? "destructive" : "outline"}
            className={`h-11 w-11 rounded-full p-0 ${
              isRecording ? 'animate-pulse' : ''
            }`}
          >
            <Mic className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};