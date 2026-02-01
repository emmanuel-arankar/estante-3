import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';

interface MediaViewerProps {
    isOpen: boolean;
    onClose: () => void;
    images: string[];
    initialIndex?: number;
    senderName?: string;
    senderPhoto?: string;
    timestamp?: Date | number;
    caption?: string;
    messageId?: string;
}

export const MediaViewer = ({
    isOpen,
    onClose,
    images,
    initialIndex = 0,
    senderName,
    senderPhoto,
    timestamp,
    caption,
    messageId
}: MediaViewerProps) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [isAnimating, setIsAnimating] = useState(true);
    const [isZoomed, setIsZoomed] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Reset animation state when opening
    useEffect(() => {
        if (isOpen) {
            setCurrentIndex(initialIndex);
            setIsAnimating(true);
            setIsZoomed(false);
        }
    }, [isOpen, initialIndex]);

    const handleNext = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        setCurrentIndex((prev) => (prev + 1) % images.length);
        setIsAnimating(false);
        setIsZoomed(false); // Reset zoom when navigating
    }, [images.length]);

    const handlePrev = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
        setIsAnimating(false);
        setIsZoomed(false); // Reset zoom when navigating
    }, [images.length]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!isOpen) return;
        if (e.key === 'Escape') {
            if (isZoomed) {
                // Optionally reset zoom first
                setIsZoomed(false);
            } else {
                onClose();
            }
        }
        if (e.key === 'ArrowRight') handleNext();
        if (e.key === 'ArrowLeft') handlePrev();
    }, [isOpen, onClose, handleNext, handlePrev, isZoomed]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    const formatMediaDate = (date: Date | number | undefined) => {
        if (!date) return '';
        const d = new Date(date);
        let prefix = '';
        if (isToday(d)) prefix = 'Hoje';
        else if (isYesterday(d)) prefix = 'Ontem';
        else prefix = format(d, "d 'de' MMM", { locale: ptBR });

        return `${prefix} às ${format(d, "HH:mm")}`;
    };

    const handleDownload = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const imageUrl = images[currentIndex];

        try {
            const fetchUrl = imageUrl.includes('?')
                ? `${imageUrl}&cacheBust=${Date.now()}`
                : `${imageUrl}?cacheBust=${Date.now()}`;

            const response = await fetch(fetchUrl);
            if (!response.ok) throw new Error('Network response was not ok');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            const fileName = imageUrl.split('/').pop()?.split('?')[0] || `media-${Date.now()}`;
            a.download = fileName.endsWith('.jpg') || fileName.endsWith('.png') ? fileName : `${fileName}.jpg`;

            document.body.appendChild(a);
            a.click();

            setTimeout(() => {
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            }, 100);
        } catch (error) {
            console.warn('Direct download failed:', error);
            toast.info("A imagem será aberta em uma nova aba para download devido a restrições de segurança.", {
                duration: 4000,
            });
            window.open(imageUrl, '_blank', 'noopener,noreferrer');
        }
    };

    // Lock body scroll when open
    useEffect(() => {
        if (isOpen) {
            const originalOverflow = document.body.style.overflow;
            const originalPaddingRight = document.body.style.paddingRight;
            const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

            document.body.style.overflow = 'hidden';
            if (scrollbarWidth > 0) {
                document.body.style.paddingRight = `${scrollbarWidth}px`;
            }

            return () => {
                document.body.style.overflow = originalOverflow;
                document.body.style.paddingRight = originalPaddingRight;
            };
        }
    }, [isOpen]);

    return createPortal(
        <AnimatePresence mode="wait">
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[99999] select-none bg-black/95 backdrop-blur-sm overflow-hidden"
                    ref={containerRef}
                >
                    {/* Background Layer */}
                    <div
                        className="absolute inset-0 z-0"
                        onClick={onClose}
                    />

                    {/* Main Content Container - WhatsApp-like centering */}
                    <div className="absolute inset-0 flex items-center justify-center p-4 z-20 pointer-events-none">
                        <div
                            className="relative w-full h-full max-w-[90vw] max-h-[90vh] flex items-center justify-center pointer-events-auto"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!isAnimating && !isZoomed) onClose();
                            }}
                        >
                            {/* Animação inicial (sem zoom) */}
                            {isAnimating ? (
                                <motion.div
                                    className="flex items-center justify-center w-full h-full"
                                    layoutId={messageId ? `media-${messageId}-${currentIndex}` : undefined}
                                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                    onLayoutAnimationComplete={() => setIsAnimating(false)}
                                >
                                    <img
                                        src={images[currentIndex]}
                                        alt="Fullscreen view"
                                        className="max-h-full max-w-full object-contain shadow-2xl"
                                        draggable={false}
                                    />
                                </motion.div>
                            ) : (
                                /* Container do zoom com centralização fixa */
                                <div className="w-full h-full flex items-center justify-center">
                                    <TransformWrapper
                                        initialScale={1}
                                        minScale={1}
                                        maxScale={5}
                                        centerOnInit={true}
                                        centerZoomedOut={true}
                                        limitToBounds={true}
                                        onZoom={(ref) => {
                                            setIsZoomed(ref.state.scale > 1.1);
                                        }}
                                        onPanningStart={(ref) => {
                                            setIsZoomed(ref.state.scale > 1.1);
                                        }}
                                        doubleClick={{ disabled: false, mode: 'zoomIn' }}
                                    >
                                        {({ zoomIn, zoomOut, resetTransform }) => (
                                            <>
                                                <TransformComponent
                                                    wrapperClass="!w-full !h-full flex items-center justify-center"
                                                    contentClass="flex items-center justify-center cursor-default"
                                                    contentStyle={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        width: '100%',
                                                        height: '100%'
                                                    }}
                                                >
                                                    <img
                                                        src={images[currentIndex]}
                                                        alt="Fullscreen view"
                                                        className="max-h-full max-w-full object-contain shadow-2xl select-none"
                                                        draggable={false}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (isZoomed) resetTransform();
                                                        }}
                                                        onDoubleClick={(e) => {
                                                            e.stopPropagation();
                                                            if (isZoomed) {
                                                                resetTransform();
                                                                setIsZoomed(false);
                                                            } else {
                                                                zoomIn();
                                                                setIsZoomed(true);
                                                            }
                                                        }}
                                                    />
                                                </TransformComponent>

                                                {/* Controles de zoom discretos (opcional) */}
                                                {isZoomed && (
                                                    <div className="absolute bottom-24 right-4 flex flex-col gap-2 opacity-0 hover:opacity-100 transition-opacity">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="rounded-full bg-black/40 hover:bg-black/60 text-white h-10 w-10"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                zoomIn();
                                                            }}
                                                        >
                                                            <span className="text-lg">+</span>
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="rounded-full bg-black/40 hover:bg-black/60 text-white h-10 w-10"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                zoomOut();
                                                            }}
                                                        >
                                                            <span className="text-lg">−</span>
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="rounded-full bg-black/40 hover:bg-black/60 text-white h-10 w-10"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                resetTransform();
                                                                setIsZoomed(false);
                                                            }}
                                                        >
                                                            <span className="text-xs">⎌</span>
                                                        </Button>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </TransformWrapper>
                                </div>
                            )}

                            {/* Botões de navegação */}
                            {!isAnimating && images.length > 1 && !isZoomed && (
                                <>
                                    <div className="absolute left-0 top-0 bottom-0 w-32 flex items-center justify-start z-40 group/nav pointer-events-auto" onClick={handlePrev}>
                                        <Button
                                            variant="ghost" size="icon"
                                            className="rounded-full bg-black/40 hover:bg-black/60 text-white h-14 w-14 ml-4 opacity-0 group-hover/nav:opacity-100 transition-all scale-90 group-hover/nav:scale-100"
                                        >
                                            <ChevronLeft className="h-8 w-8" />
                                        </Button>
                                    </div>
                                    <div className="absolute right-0 top-0 bottom-0 w-32 flex items-center justify-end z-40 group/nav pointer-events-auto" onClick={handleNext}>
                                        <Button
                                            variant="ghost" size="icon"
                                            className="rounded-full bg-black/40 hover:bg-black/60 text-white h-14 w-14 mr-4 opacity-0 group-hover/nav:opacity-100 transition-all scale-90 group-hover/nav:scale-100"
                                        >
                                            <ChevronRight className="h-8 w-8" />
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Header */}
                    <div
                        className="absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-4 z-50 bg-gradient-to-b from-black/70 via-black/50 to-transparent pointer-events-auto"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center space-x-3 text-white">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onClose}
                                className="rounded-full hover:bg-white/10 text-white"
                            >
                                <X className="h-6 w-6" />
                            </Button>
                            <div className="flex items-center space-x-3">
                                <Avatar className="h-10 w-10 border border-white/10">
                                    <AvatarImage src={senderPhoto} />
                                    <AvatarFallback>{senderName?.charAt(0) || 'U'}</AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                    <span className="text-sm font-semibold leading-tight">{senderName || 'Usuário'}</span>
                                    <span className="text-xs text-white/60">{formatMediaDate(timestamp)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center space-x-1">
                            <span className="text-xs font-medium text-white/60 mr-4">
                                {currentIndex + 1} / {images.length}
                            </span>
                            <Button variant="ghost" size="icon" onClick={handleDownload} className="rounded-full hover:bg-white/10 text-white">
                                <Download className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>

                    {/* Footer com thumbnail strip */}
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className={`absolute bottom-0 left-0 right-0 z-50 pointer-events-auto transition-all duration-300 ${isZoomed ? 'translate-y-full opacity-0' : ''
                            }`}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Legenda */}
                        {caption && (
                            <div className="max-w-3xl mx-auto mb-4 px-4">
                                <p className="text-white text-sm leading-relaxed whitespace-pre-wrap bg-black/40 backdrop-blur-md px-4 py-2 rounded-lg inline-block">
                                    {caption}
                                </p>
                            </div>
                        )}

                        {/* Strip de thumbnails */}
                        {images.length > 1 && (
                            <div className="bg-gradient-to-t from-black/90 via-black/70 to-transparent pt-6 pb-4 px-4">
                                <div className="flex items-center justify-center space-x-2 overflow-x-auto scrollbar-hide max-w-full mx-auto">
                                    {images.map((img, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => {
                                                if (idx === currentIndex) return;
                                                setCurrentIndex(idx);
                                                setIsAnimating(false);
                                                setIsZoomed(false);
                                            }}
                                            className={cn(
                                                "h-16 w-16 rounded-md overflow-hidden border-2 transition-all flex-shrink-0",
                                                idx === currentIndex
                                                    ? "border-white shadow-lg scale-105"
                                                    : "border-transparent opacity-50 hover:opacity-80 hover:scale-100"
                                            )}
                                        >
                                            <img
                                                src={img}
                                                className="w-full h-full object-cover"
                                                loading="lazy"
                                            />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};