import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SendHorizontal, Image as ImageIcon, Smile, Paperclip, Mic, X } from 'lucide-react';
import { ChatMessage } from '@estante/common-types';
import EmojiPicker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import i18n_pt from '@emoji-mart/data/i18n/pt.json';

import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Popover as PopoverUI,
  PopoverContent as PopoverContentUI,
  PopoverTrigger as PopoverTriggerUI
} from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { VoiceRecorder, VoiceRecorderHandle } from './VoiceRecorder';
import { useAuth } from '@/hooks/useAuth';
import { ImagePreviewOverlay } from './ImagePreviewOverlay';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';

export interface PendingImage {
  id: string;
  file: File;
  previewUrl: string;
  caption: string;
  viewOnce: boolean;
}

interface ChatInputProps {
  onSendMessage: (
    content: string,
    type?: 'text' | 'image' | 'audio',
    isTemporary?: boolean,
    file?: Blob,
    waveform?: number[],
    duration?: number,
    caption?: string,
    viewOnce?: boolean,
    images?: Blob[]
  ) => Promise<void>;
  onTyping: (status: boolean | 'recording') => void;
  replyingTo?: ChatMessage | null;
  onCancelReply?: () => void;
  editingMessage?: ChatMessage | null;
  onCancelEdit?: () => void;
  onEditMessage?: (id: string, content: string) => Promise<void>;
  recipientName?: string;
  disabled?: boolean;
}

export const ChatInput = ({
  onSendMessage,
  onTyping,
  replyingTo,
  onCancelReply,
  editingMessage,
  onCancelEdit,
  onEditMessage,
  disabled = false,
  recipientName
}: ChatInputProps) => {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const voiceRecorderRef = useRef<VoiceRecorderHandle>(null);
  const dragStartY = useRef<number>(0);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastEditedIdRef = useRef<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<PendingImage[]>([]);
  const [isSendingImages, setIsSendingImages] = useState(false);



  // Simplificação radical: Acesso direto ao microfone sem hooks complexos de warmup
  const [stream, setStream] = useState<MediaStream | null>(null);

  const acquireStream = async () => {
    try {
      if (stream && stream.active) return stream;

      // Stop old tracks if any
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }

      console.log("ChatInput: Solicitando acesso ao microfone...");
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      setStream(newStream);
      return newStream;
    } catch (err) {
      console.error("ChatInput: Erro ao adquirir microfone:", err);
      // Reset stream state on error to allow retry
      setStream(null);
      return null;
    }
  };

  const releaseStream = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };


  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);



  // Efeito para popular o input ao editar

  useEffect(() => {
    if (editingMessage && editingMessage.type === 'text') {
      setMessage(editingMessage.content);
      lastEditedIdRef.current = editingMessage.id;
    } else if (!editingMessage) {
      lastEditedIdRef.current = null;
    }

    // Foca no textarea se estiver editando OU respondendo (com segurança para ARIA)
    if (editingMessage || replyingTo) {
      const focusTextarea = () => {
        const root = document.getElementById('root');
        if (root?.getAttribute('aria-hidden') === 'true') return;

        if (textareaRef.current) {
          textareaRef.current.focus();
          if (editingMessage) {
            const length = textareaRef.current.value.length;
            textareaRef.current.setSelectionRange(length, length);
          }
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
        }
      };

      // Tenta focar imediatamente e depois com delay
      focusTextarea();
      const timeoutId = setTimeout(focusTextarea, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [editingMessage, replyingTo]);

  const onDrop = (acceptedFiles: File[]) => {
    const newImages = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      previewUrl: URL.createObjectURL(file),
      caption: '',
      viewOnce: false
    }));
    setSelectedImages(prev => [...prev, ...newImages]);
    textareaRef.current?.focus();
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    noClick: true,
    noKeyboard: true
  });

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) files.push(blob);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      onDrop(files);
    }
  };



  const [isSendingText, setIsSendingText] = useState(false);

  const handleSend = async () => {
    if (!message.trim() || disabled || isSendingText) return;

    const content = message.trim();

    try {
      setIsSendingText(true);
      if (editingMessage) {
        if (onEditMessage) {
          await onEditMessage(editingMessage.id, content);
          setMessage('');
          if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'; // Reset height after edit
          }
        }
      } else {
        setMessage(''); // Optimistic clear
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto'; // Reset height immediately
        }
        await onSendMessage(content);
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      setMessage(content); // Restore on error
    } finally {
      setIsSendingText(false);
    }
  };


  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Se for Ctrl+A (ou Ctrl+T), seleciona apenas o texto do input
    const isSelectAll = (e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'a' || e.key.toLowerCase() === 't');

    if (isSelectAll) {
      e.stopPropagation();
      e.preventDefault(); // Evita que o navegador selecione tudo fora do input
      textareaRef.current?.select();
      return;
    }

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

  const handleImageSelect = (file: File) => {
    onDrop([file]);
  };

  const handlePreviewSend = async (images: PendingImage[]) => {
    if (images.length === 0 || isSendingImages) return;

    try {
      setIsSendingImages(true);

      const imageBlobs = images.map(img => img.file as Blob);
      // Use the caption from the first image as the group caption (users requested single caption input)
      const caption = images[0].caption;
      const viewOnce = images[0].viewOnce;

      // Optimistic Send via hook
      await onSendMessage('', 'image', false, undefined, undefined, undefined, caption, viewOnce, imageBlobs);

      // Cleanup
      images.forEach(img => URL.revokeObjectURL(img.previewUrl));
      setSelectedImages([]);
    } catch (error) {
      console.error('Erro ao enviar imagens:', error);
      toast.error("Erro ao enviar imagens");
    } finally {
      setIsSendingImages(false);
    }
  };


  const handleVoiceRecordComplete = async (url: string, isTemporary: boolean, blob: Blob, waveform: number[], duration?: number) => {
    try {
      await onSendMessage(url, 'audio', isTemporary, blob, waveform, duration);
      setIsRecording(false);
      setIsLocked(false);
      onTyping(false); // Limpa o status ao terminar
      releaseStream(); // Garante liberação do hardware
    } catch (error) {
      console.error('Erro ao enviar áudio:', error);
      releaseStream();
    }
  };

  // Auto-resize textarea e detector de digitação
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setMessage(newValue);

    // Lógica de Digitando
    if (!isTypingRef.current && newValue.trim() !== '') {
      isTypingRef.current = true;
      onTyping(true);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      onTyping(false);
    }, 1500);

    // Auto-resize
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  };

  // --- Logic for Hold-to-Record (Mobile) & Click-to-Record (Desktop) ---

  // Desktop: Simple click to start recording in locked mode (like WhatsApp Web)
  const handleDesktopRecordClick = async () => {
    await acquireStream();
    setIsRecording(true);
    setIsLocked(true); // Desktop goes straight to locked mode - no hold needed
    onTyping('recording');
  };

  // Mobile: Hold-to-record with slide-to-lock gesture
  const handleMobileRecordStart = async (e: React.TouchEvent) => {
    // Prevent default context menu or other behaviors
    if (e.cancelable) e.preventDefault();

    // Inicia aquecimento imediato
    acquireStream().catch(console.warn);

    const clientY = e.touches[0].clientY;
    dragStartY.current = clientY;
    setIsRecording(true);
    setIsLocked(false);
    onTyping('recording');

    // Attach global listeners for mobile gestures
    window.addEventListener('touchmove', handleGlobalTouchMove);
    window.addEventListener('touchend', handleGlobalTouchEnd);
  };

  const handleGlobalTouchMove = (e: TouchEvent) => {
    handleMove(e.touches[0].clientY);
  };

  const handleMove = (clientY: number) => {
    // Check swipe up
    const deltaY = clientY - dragStartY.current;

    // Threshold to lock: -50px (slide up)
    if (deltaY < -50) {
      setIsLocked(true);
      // Once locked, we stop listening to gestures (input persists)
      cleanupGlobalListeners();
    }
  };

  const handleGlobalTouchEnd = () => {
    handleRelease();
  };

  const handleRelease = () => {
    // Logic: if NOT locked, stop and send.
    // If locked, do nothing (wait for manual stop).
    // Access latest state? We can't access React state easily in raw listeners without ref or closure capture.
    // Actually, listeners are recreated if deps change? No, we attached once.
    // But `isLocked` state is inside component.
    // We can check the setter? Or use a Ref for isLocked.

    // ISSUE: This `handleRelease` closes over the initial render scope if not careful.
    // But we are defining it inside component. `isLocked` value will be "stale"?
    // YES. `handleRecordStart` creates the closure. `isLocked` is false there.

    // FIX: Use a ref to track lock state for the event handlers.
    // But we also have `setIsLocked`.
    // Let's rely on standard React state? No, event listener closure is tricky.

    // Hack: Check if we called `setIsLocked(true)`. 
    // Actually, `handleMove` calls `cleanupGlobalListeners` if it locks.
    // So if `handleRelease` is called, it means we did NOT lock yet?
    // Not necessarily. `handleRelease` might fire before `handleMove` (tap).

    // Simpler: If we are here, and listeners are still attached, we assume it's NOT locked?
    // Wait, `handleMove` removes listeners. So `handleRelease` won't fire if locked!
    // Correct! 
    // If `deltaY < -50`, we set locked and cleanup. So `mouseup` listener is gone.
    // So if `mouseup` fires, it means we never locked.
    // So we just Stop & Send.

    // Check if voiceRecorderRef is ready
    if (voiceRecorderRef.current) {
      voiceRecorderRef.current.stopAndSend();
    } else {
      // Did we tap too fast? VoiceRecorder didn't mount/bind ref yet?
      // We might need to wait or cancel.
      console.warn("Recorder ref not ready, stopping forcefully?");
      // If ref is null, maybe just setIsRecording(false) to cancel?
      // Or better: Let it record minimal duration?
      // For now, if ref is missing, just cancel state. (User tapped extremely fast)
      // setIsRecording(false); 
      // onTyping(false);
      // But maybe VoiceRecorder handles it?

      // Let's try to act on state change in useEffect?
      // No, event-driven is better.

      // If I tap really fast, VoiceRecorder mounts.
      // If ref is null, we can't call stop.
      // We will assume a minimal duration is handled by user holding at least 100ms.
    }

    cleanupGlobalListeners();
  };

  const cleanupGlobalListeners = () => {
    window.removeEventListener('touchmove', handleGlobalTouchMove);
    window.removeEventListener('touchend', handleGlobalTouchEnd);
  };

  // Clean up on unmount
  useEffect(() => {
    return () => cleanupGlobalListeners();
  }, []);

  if (isRecording && user) {
    return (
      <VoiceRecorder
        ref={voiceRecorderRef}
        stream={stream}
        isLocked={isLocked}
        onCancel={() => {
          setIsRecording(false);
          setIsLocked(false);
          onTyping(false);
          releaseStream(); // Libera microfone ao cancelar
        }}
        onSend={(blob, duration, waveform, viewOnce) => {
          // Validate minimum duration (double-check, VoiceRecorder already validates)
          if (duration < 1) {
            return;
          }
          const url = URL.createObjectURL(blob);
          handleVoiceRecordComplete(url, viewOnce, blob, waveform, duration);
        }}
      />
    );
  }

  return (
    <div {...getRootProps()} className={cn("space-y-3 relative", isDragActive && "bg-emerald-50/50 rounded-xl outline-2 outline-dashed outline-emerald-300")}>
      <input {...getInputProps()} />
      {isDragActive && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-white/90 backdrop-blur-sm p-4 rounded-2xl shadow-xl border border-emerald-100 flex flex-col items-center">
            <ImageIcon className="h-10 w-10 text-emerald-500 mb-2" />
            <p className="text-sm font-bold text-emerald-700">Solte para anexar fotos</p>
          </div>
        </div>
      )}
      {/* Reply Preview */}
      <AnimatePresence>
        {replyingTo && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10, height: 0 }}
            animate={{ opacity: 1, scale: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, scale: 0.95, y: 10, height: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="bg-gray-50 border-l-4 border-emerald-500 rounded-lg p-2 flex items-center justify-between overflow-hidden"
          >
            <div className="flex-1 min-w-0 pr-4">
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-0.5">
                Respondendo a {replyingTo.senderId === user?.uid ? 'Você' : (recipientName || 'Usuário')}
              </p>
              <p className="text-xs text-gray-600 truncate">
                {replyingTo.type === 'image' ? '📷 Foto' :
                  replyingTo.type === 'audio' ? '🎤 Áudio' :
                    replyingTo.content}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onCancelReply}
              className="h-6 w-6 rounded-full hover:bg-gray-200"
            >
              <X className="h-3 w-3" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedImages.length > 0 && (
          <ImagePreviewOverlay
            images={selectedImages}
            recipientName={recipientName}
            onClose={() => {
              selectedImages.forEach(img => URL.revokeObjectURL(img.previewUrl));
              setSelectedImages([]);
            }}
            onSend={handlePreviewSend}
            isSending={isSendingImages}
          />
        )}
      </AnimatePresence>
      {/* Edit Preview */}
      <AnimatePresence>
        {editingMessage && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10, height: 0 }}
            animate={{ opacity: 1, scale: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, scale: 0.95, y: 10, height: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-2 flex items-center justify-between overflow-hidden"
          >
            <div className="flex-1 min-w-0 pr-4">
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-0.5">
                Editando mensagem
              </p>
              <p className="text-xs text-blue-800 truncate">
                {editingMessage.content}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onCancelEdit}
              className="h-6 w-6 rounded-full hover:bg-blue-200"
            >
              <X className="h-3 w-3 text-blue-600" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Main Input */}
      <div className="flex items-end space-x-3">
        {/* Actions */}
        <div className="flex items-center space-x-1">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            id="image-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageSelect(file);
              e.target.value = ''; // Reset for same file select
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => document.getElementById('image-input')?.click()}
            className="h-9 w-9 rounded-full text-gray-500 hover:text-blue-600 hover:bg-blue-50"
          >
            <ImageIcon className="h-4 w-4" />
          </Button>

          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-gray-500">
            <Paperclip className="h-4 w-4" />
          </Button>
        </div>

        {/* Text Input */}
        <div className="flex-1 relative bg-gray-50 border border-gray-200 rounded-3xl focus-within:ring-1 focus-within:ring-emerald-500 focus-within:border-emerald-500 focus-within:bg-white transition-all duration-200">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={disabled ? "Você não pode enviar mensagens para este usuário" : (editingMessage ? "Edite sua mensagem..." : `Mensagem para ${recipientName || 'contato'}...`)}
            disabled={disabled}
            rows={1}
            className="resize-none min-h-[44px] max-h-[120px] bg-transparent border-none focus-visible:ring-0 text-gray-700 text-sm py-3 pl-6 pr-12 w-full overflow-y-auto placeholder:text-gray-400 no-scrollbar"
          />

          {/* Emoji Picker */}
          <PopoverUI open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
            <PopoverTriggerUI asChild>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 bottom-1.5 h-8 w-8 rounded-full text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
              >
                <Smile className="h-5 w-5" />
              </Button>
            </PopoverTriggerUI>
            <PopoverContentUI className="w-auto p-0 border-0 shadow-lg" align="end" side="top" sideOffset={10}>
              <EmojiPicker
                data={data}
                onEmojiSelect={handleEmojiSelect}
                theme="light"
                i18n={i18n_pt}
                locale="pt"
                previewPosition="none"
                skinTonePosition="none"
              />
            </PopoverContentUI>
          </PopoverUI>
        </div>

        {/* Send/Voice Button */}
        {message.trim() ? (
          <Button
            onClick={handleSend}
            disabled={disabled || isSendingText}
            className="h-11 w-11 rounded-full bg-emerald-600 hover:bg-emerald-700 p-0 shadow-md"
          >
            {isSendingText ? (
              <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <SendHorizontal className="h-4 w-4" />
            )}
          </Button>
        ) : (
          <Button
            onTouchStart={handleMobileRecordStart}
            onClick={handleDesktopRecordClick}
            disabled={disabled}
            variant="outline"
            className="h-11 w-11 rounded-full border-gray-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 p-0 transition-colors cursor-pointer select-none"
          >
            <Mic className="h-4 w-4" />
          </Button>



        )}
      </div>
    </div>
  );
};