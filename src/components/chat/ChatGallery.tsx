import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { X, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatMessage } from '@estante/common-types';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ChatGalleryProps {
    messages: ChatMessage[];
    isOpen: boolean;
    onClose: () => void;
}

export const ChatGallery = ({ messages, isOpen, onClose }: ChatGalleryProps) => {
    if (!isOpen) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Overlay */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[999] w-screen h-screen top-0 left-0"
                    />

                    {/* Side Panel */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 h-screen w-full max-w-md bg-white shadow-2xl z-[1000] flex flex-col"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0">
                            <div className="flex items-center space-x-2">
                                <div className="bg-blue-50 p-2 rounded-lg">
                                    <ImageIcon className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <h2 className="font-bold text-gray-900 leading-tight">Galeria de Mídia</h2>
                                    <p className="text-xs text-gray-500">{images.length} arquivos compartilhados</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
                                <X className="h-5 w-5" />
                            </Button>
                        </div>

                        {/* Content */}
                        <ScrollArea className="flex-1 p-4">
                            {images.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-center text-gray-400">
                                    <div className="bg-gray-50 p-6 rounded-full mb-4">
                                        <ImageIcon className="h-10 w-10 text-gray-300" />
                                    </div>
                                    <p className="text-sm">Nenhuma mídia encontrada nesta conversa</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 gap-2">
                                    {images.map((msg) => (
                                        <motion.div
                                            key={msg.id}
                                            layoutId={msg.id}
                                            whileHover={{ scale: 1.05 }}
                                            className="aspect-square relative group rounded-lg overflow-hidden border border-gray-100 shadow-sm transition-all hover:shadow-md cursor-pointer"
                                        >
                                            <img
                                                src={msg.content}
                                                alt="Shared media"
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center space-x-2 opacity-0 group-hover:opacity-100">
                                                <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full" onClick={() => window.open(msg.content, '_blank')}>
                                                    <ExternalLink className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>

                        {/* Footer */}
                        <div className="p-4 border-t border-gray-100 bg-gray-50/50">
                            <p className="text-[10px] text-gray-400 text-center uppercase tracking-widest font-bold">
                                Mídia compartilhada no Chat
                            </p>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>,
        document.body
    );
};
