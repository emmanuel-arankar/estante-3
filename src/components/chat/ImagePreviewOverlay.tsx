import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, SendHorizontal, Crop, Pencil, Type, Eye, Smile, Undo2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Popover as PopoverUI,
    PopoverContent as PopoverContentUI,
    PopoverTrigger as PopoverTriggerUI
} from '@/components/ui/popover';
import EmojiPicker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import i18n_pt from '@emoji-mart/data/i18n/pt.json';
import Cropper from 'react-easy-crop';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { PendingImage } from './ChatInput';
import { Stage, Layer, Image as KImage, Transformer, Text, Rect, Circle, Line } from 'react-konva';
import useImage from 'use-image';

interface ImagePreviewOverlayProps {
    images: PendingImage[];
    onClose: () => void;
    onSend: (images: PendingImage[]) => void;
    recipientName?: string;
    isSending?: boolean;
}

export const ImagePreviewOverlay = ({
    images: initialImages,
    onClose,
    onSend,
    recipientName,
    isSending = false
}: ImagePreviewOverlayProps) => {
    const stageContainerRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<any>(null);
    const trRef = useRef<any>(null);
    const [images, setImages] = useState<PendingImage[]>(initialImages);
    const [currentIndex, setCurrentIndex] = useState(0);
    const currentImg = images[currentIndex];

    // Modes
    const [mode, setMode] = useState<'preview' | 'crop' | 'edit'>('preview');

    // Konva Editor State
    const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
    const [konvaObjects, setKonvaObjects] = useState<any[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [history, setHistory] = useState<any[][]>([[]]);
    const [historyStep, setHistoryStep] = useState(0);

    // Tooling
    const [selectedTool, setSelectedTool] = useState<'select' | 'pencil' | 'text' | 'rect' | 'circle'>('select');
    const [brushColor, setBrushColor] = useState('#ffffff');
    const [isDrawing, setIsDrawing] = useState(false);

    const [konvaImage] = useImage(currentImg.previewUrl);

    // Lock body scroll when open
    useEffect(() => {
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, []);

    // Dynamic Sizing
    useEffect(() => {
        if (!konvaImage || mode !== 'edit') return;

        const container = stageContainerRef.current;
        if (!container) return;

        const { width: containerW, height: containerH } = container.getBoundingClientRect();
        const imgW = konvaImage.width;
        const imgH = konvaImage.height;

        const ratio = Math.min(containerW / imgW, containerH / imgH);

        setStageSize({
            width: imgW * ratio,
            height: imgH * ratio
        });
    }, [konvaImage, mode]);

    const handleAddText = () => {
        const id = 'text-' + Math.random().toString(36).substring(7);
        const newObj = {
            id,
            type: 'text',
            text: 'Texto aqui',
            x: stageSize.width / 2 - 50,
            y: stageSize.height / 2 - 10,
            fontSize: 24,
            fill: brushColor,
            draggable: true
        };
        commitToHistory([...konvaObjects, newObj]);
        setSelectedId(id);
    };

    const handleDeleteObject = () => {
        if (!selectedId) return;
        const newObjects = konvaObjects.filter((obj: any) => obj.id !== selectedId);
        commitToHistory(newObjects);
        setSelectedId(null);
    };

    const handleMouseDown = (e: any) => {
        if (selectedTool !== 'pencil' || mode !== 'edit') {
            const clickedOnEmpty = e.target === e.target.getStage();
            if (clickedOnEmpty) setSelectedId(null);
            return;
        }

        setIsDrawing(true);
        const pos = e.target.getStage().getPointerPosition();
        const id = 'line-' + Math.random().toString(36).substring(7);
        const newLine = {
            id,
            type: 'line',
            points: [pos.x, pos.y],
            stroke: brushColor,
            strokeWidth: 3,
            tension: 0.5,
            lineCap: 'round',
            lineJoin: 'round',
            draggable: true
        };
        setKonvaObjects([...konvaObjects, newLine]);
    };

    const handleMouseMove = (e: any) => {
        if (!isDrawing || selectedTool !== 'pencil') return;

        const stage = e.target.getStage();
        const point = stage.getPointerPosition();
        const lastLine = { ...konvaObjects[konvaObjects.length - 1] };
        lastLine.points = lastLine.points.concat([point.x, point.y]);

        const newObjects = konvaObjects.slice(0, konvaObjects.length - 1).concat([lastLine]);
        setKonvaObjects(newObjects);
    };

    const handleMouseUp = () => {
        if (isDrawing) {
            setIsDrawing(false);
            commitToHistory(konvaObjects);
        }
    };

    const handleApplyEditsKonva = () => {
        if (!stageRef.current) return;

        // Hide transformer for capture
        setSelectedId(null);

        setTimeout(() => {
            const dataURL = stageRef.current.toDataURL({ pixelRatio: 2 });
            const newImages = [...images];
            newImages[currentIndex].previewUrl = dataURL;
            setImages(newImages);
            setMode('preview');
        }, 50);
    };

    const handleObjectChange = (id: string, newProps: any) => {
        setKonvaObjects((prev: any[]) => prev.map((o: any) => o.id === id ? { ...o, ...newProps } : o));
    };

    useEffect(() => {
        if (selectedId && trRef.current) {
            // Find the node
            const stage = trRef.current.getStage();
            const selectedNode = stage.findOne('#' + selectedId);
            if (selectedNode) {
                trRef.current.nodes([selectedNode]);
                trRef.current.getLayer().batchDraw();
            }
        }
    }, [selectedId]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (mode !== 'preview') {
                    setMode('preview'); // Exit edit/crop mode first
                } else {
                    onClose(); // Close overly
                }
            }
        };

        const handlePaste = (e: ClipboardEvent) => {
            if (document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT') {
                if (e.clipboardData?.files.length === 0) return;
            }

            const items = e.clipboardData?.items;
            if (!items) return;

            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    e.preventDefault();
                    const blob = items[i].getAsFile();
                    if (blob) {
                        const newImg = {
                            id: Math.random().toString(36).substring(7),
                            file: blob,
                            previewUrl: URL.createObjectURL(blob),
                            caption: '',
                            viewOnce: false
                        };
                        setImages(prev => [...prev, newImg]);
                        toast.success("Imagem adicionada!");
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('paste', handlePaste);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('paste', handlePaste);
        };
    }, [mode, onClose]);

    // Crop State
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

    const handleCaptionChange = (val: string) => {
        const newImages = [...images];
        newImages[currentIndex].caption = val;
        setImages(newImages);
    };

    const handleViewOnceToggle = () => {
        const newImages = [...images];
        newImages[currentIndex].viewOnce = !newImages[currentIndex].viewOnce;
        setImages(newImages);
    };

    const onCropComplete = (_croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    };

    const handleApplyCrop = async () => {
        if (!currentImg.previewUrl || !croppedAreaPixels) return;
        try {
            const croppedImageUrl = await getCroppedImg(currentImg.previewUrl, croppedAreaPixels);
            const newImages = [...images];
            newImages[currentIndex].previewUrl = croppedImageUrl;
            setImages(newImages);
            setMode('preview');
        } catch (e) {
            console.error(e);
            toast.error("Erro ao recortar imagem");
        }
    };

    const getCroppedImg = (imageSrc: string, pixelCrop: any): Promise<string> => {
        const image = new Image();
        image.src = imageSrc;
        return new Promise((resolve, reject) => {
            image.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject();
                canvas.width = pixelCrop.width;
                canvas.height = pixelCrop.height;
                ctx.drawImage(
                    image,
                    pixelCrop.x,
                    pixelCrop.y,
                    pixelCrop.width,
                    pixelCrop.height,
                    0,
                    0,
                    pixelCrop.width,
                    pixelCrop.height
                );
                resolve(canvas.toDataURL('image/jpeg'));
            };
            image.onerror = (e) => reject(e);
        });
    };

    const commitToHistory = (newObjects: any[]) => {
        const newHistory = history.slice(0, historyStep + 1);
        newHistory.push(newObjects);
        setHistory(newHistory);
        setHistoryStep(newHistory.length - 1);
        setKonvaObjects(newObjects);
    };

    const handleUndo = () => {
        if (historyStep === 0) return;
        setHistoryStep(historyStep - 1);
        setKonvaObjects(history[historyStep - 1]);
        setSelectedId(null);
    };

    const handleSend = () => {
        if (isSending) return;
        onSend(images);
    };

    if (images.length === 0) return null;

    return createPortal(
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-[#0b141a] flex flex-col items-center overflow-hidden w-screen h-screen"
        >
            {/* Header / Toolbar (Centered like WA) */}
            <div className="w-full h-14 flex items-center justify-between px-4 text-white shrink-0 relative">
                <div className="flex items-center">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="text-white/70 hover:text-white hover:bg-white/10 rounded-full"
                    >
                        <X className="h-6 w-6" />
                    </Button>
                    {recipientName && (
                        <span className="text-white font-medium text-sm ml-2 hidden sm:inline-block">
                            Enviar para <span className="font-bold">{recipientName}</span>
                        </span>
                    )}
                </div>

                {/* Central Toolbar */}
                <div className="absolute left-1/2 -translate-x-1/2 flex items-center space-x-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setMode(mode === 'crop' ? 'preview' : 'crop')}
                        className={cn("h-10 w-10 rounded-full transition-colors", mode === 'crop' ? "bg-emerald-500 text-white" : "hover:bg-white/10 text-white/70")}
                        title="Recortar"
                    >
                        <Crop className="h-5 w-5" />
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setMode(mode === 'edit' ? 'preview' : 'edit')}
                        className={cn("h-10 w-10 rounded-full transition-colors", mode === 'edit' ? "bg-emerald-500 text-white" : "hover:bg-white/10 text-white/70")}
                        title="Editar"
                    >
                        <Pencil className="h-5 w-5" />
                    </Button>

                    {mode === 'edit' && (
                        <div className="flex items-center space-x-1 pl-4 border-l border-white/20 ml-2 animate-in fade-in slide-in-from-top-2 duration-200">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedTool('pencil')}
                                className={cn("text-white rounded-lg h-9 w-9 p-0", selectedTool === 'pencil' ? "bg-emerald-500" : "hover:bg-white/10")}
                            >
                                <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleAddText}
                                className="text-white hover:bg-white/10 rounded-lg h-9 w-9 p-0"
                            >
                                <Type className="h-4 w-4" />
                            </Button>

                            <div className="flex items-center space-x-1 bg-black/20 rounded-lg p-1 mx-2">
                                {['#ffffff', '#000000', '#ef4444', '#10b981', '#3b82f6', '#eab308'].map(color => (
                                    <button
                                        key={color}
                                        onClick={() => setBrushColor(color)}
                                        className={cn(
                                            "w-3 h-3 rounded-full border border-white/20 transition-transform",
                                            brushColor === color ? "scale-150 border-white z-10" : "hover:scale-125"
                                        )}
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                            </div>

                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleUndo}
                                disabled={historyStep === 0}
                                className="text-white hover:bg-white/10 rounded-lg h-9 w-9 p-0 disabled:opacity-30"
                            >
                                <Undo2 className="h-4 w-4" />
                            </Button>
                            {selectedId && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleDeleteObject}
                                    className="text-white hover:bg-red-500/20 hover:text-red-400 rounded-lg h-9 w-9 p-0"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center">
                    {(mode === 'crop' || mode === 'edit') ? (
                        <Button
                            size="sm"
                            onClick={mode === 'crop' ? handleApplyCrop : handleApplyEditsKonva}
                            className="bg-emerald-600 hover:bg-emerald-700 h-8 px-4 text-xs font-bold rounded-full text-white"
                        >
                            Concluir
                        </Button>
                    ) : (
                        <div className="w-10 h-10" />
                    )}
                </div>
            </div>

            <div className="flex-1 w-full relative flex items-center justify-center p-4 overflow-hidden">
                <AnimatePresence mode="wait">
                    {mode === 'crop' ? (
                        <motion.div
                            key="crop"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="relative w-full h-full max-w-4xl"
                        >
                            <Cropper
                                image={currentImg.previewUrl}
                                crop={crop}
                                zoom={zoom}
                                aspect={undefined}
                                onCropChange={setCrop}
                                onZoomChange={setZoom}
                                onCropComplete={onCropComplete}
                            />
                        </motion.div>
                    ) : mode === 'edit' ? (
                        <motion.div
                            key="edit"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            ref={stageContainerRef}
                            className="relative w-full h-full flex items-center justify-center"
                        >
                            <div className="bg-black/20 rounded-lg overflow-hidden shadow-2xl border border-white/5">
                                <Stage
                                    ref={stageRef}
                                    width={stageSize.width}
                                    height={stageSize.height}
                                    onMouseDown={handleMouseDown}
                                    onMouseMove={handleMouseMove}
                                    onMouseUp={handleMouseUp}
                                    onTouchStart={handleMouseDown}
                                    onTouchMove={handleMouseMove}
                                    onTouchEnd={handleMouseUp}
                                >
                                    <Layer>
                                        {konvaImage && (
                                            <KImage
                                                image={konvaImage}
                                                width={stageSize.width}
                                                height={stageSize.height}
                                            />
                                        )}
                                        {konvaObjects.map((obj: any) => {
                                            if (obj.type === 'text') return (
                                                <Text
                                                    key={obj.id}
                                                    id={obj.id}
                                                    {...obj}
                                                    onClick={() => setSelectedId(obj.id)}
                                                    onTap={() => setSelectedId(obj.id)}
                                                    onDragEnd={(e) => handleObjectChange(obj.id, { x: e.target.x(), y: e.target.y() })}
                                                    onTransformEnd={(e) => {
                                                        const node = e.target;
                                                        handleObjectChange(obj.id, {
                                                            x: node.x(),
                                                            y: node.y(),
                                                            scaleX: node.scaleX(),
                                                            scaleY: node.scaleY(),
                                                            rotation: node.rotation()
                                                        });
                                                    }}
                                                />
                                            );
                                            if (obj.type === 'rect' || obj.type === 'circle' || obj.type === 'line') {
                                                const ShapeComp = obj.type === 'rect' ? Rect : obj.type === 'circle' ? Circle : Line;
                                                return (
                                                    <ShapeComp
                                                        key={obj.id}
                                                        id={obj.id}
                                                        {...obj}
                                                        onClick={() => setSelectedId(obj.id)}
                                                        onDragEnd={(e: any) => handleObjectChange(obj.id, { x: e.target.x(), y: e.target.y() })}
                                                    />
                                                )
                                            }
                                            return null;
                                        })}
                                        {selectedId && (
                                            <Transformer
                                                ref={trRef}
                                                boundBoxFunc={(oldBox, newBox) => {
                                                    if (newBox.width < 5 || newBox.height < 5) return oldBox;
                                                    return newBox;
                                                }}
                                            />
                                        )}
                                    </Layer>
                                </Stage>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key={currentImg.previewUrl}
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="relative max-h-full max-w-full flex items-center justify-center p-4"
                        >
                            <img
                                src={currentImg.previewUrl}
                                alt="Preview"
                                className="max-h-full max-w-full object-contain shadow-2xl rounded-sm"
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="w-full bg-[#111b21] pt-4 pb-8 flex flex-col items-center shrink-0 z-20 px-4">
                <div className="w-full max-w-2xl mb-6 relative group/caption">
                    <div className="flex items-center space-x-2 bg-[#2a3942] rounded-full p-1.5 pl-4 pr-1.5 focus-within:bg-[#3b4a54] transition-colors border border-transparent focus-within:border-emerald-500/30">
                        <PopoverUI>
                            <PopoverTriggerUI asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0 rounded-full text-white/50 hover:text-white hover:bg-white/10"
                                >
                                    <Smile className="h-5 w-5" />
                                </Button>
                            </PopoverTriggerUI>
                            <PopoverContentUI className="w-auto p-0 border-0 shadow-lg" side="top" align="start">
                                <EmojiPicker
                                    data={data}
                                    onEmojiSelect={(emoji: any) => handleCaptionChange(currentImg.caption + emoji.native)}
                                    theme="dark"
                                    i18n={i18n_pt}
                                    locale="pt"
                                />
                            </PopoverContentUI>
                        </PopoverUI>

                        <Textarea
                            value={currentImg.caption}
                            onChange={(e) => handleCaptionChange(e.target.value)}
                            placeholder="Adicione uma legenda..."
                            rows={1}
                            className="bg-transparent border-none text-white placeholder:text-gray-400 rounded-none py-1 px-1 min-h-[38px] max-h-[120px] resize-none focus-visible:ring-0 focus-visible:ring-offset-0 text-base no-scrollbar flex-1"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                        />

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleViewOnceToggle}
                            className={cn(
                                "h-8 w-8 shrink-0 rounded-full transition-all mx-1",
                                currentImg.viewOnce
                                    ? "bg-emerald-500 text-white"
                                    : "text-white/40 hover:text-white"
                            )}
                            title="Visualização única"
                        >
                            <div className="relative flex items-center justify-center">
                                <Eye className={cn("h-4 w-4", currentImg.viewOnce ? "scale-90" : "")} />
                                {currentImg.viewOnce && <span className="absolute text-[8px] font-bold mt-[0.5px]">1</span>}
                            </div>
                        </Button>

                        <Button
                            size="icon"
                            onClick={handleSend}
                            disabled={isSending}
                            className="h-10 w-10 shrink-0 rounded-full bg-emerald-500 hover:bg-emerald-600 text-[#0b141a] shadow-lg transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isSending ? (
                                <div className="w-5 h-5 border-2 border-[#0b141a]/40 border-t-[#0b141a] rounded-full animate-spin" />
                            ) : (
                                <SendHorizontal className="h-5 w-5" />
                            )}
                        </Button>
                    </div>
                </div>

                <div className="flex items-center space-x-2 px-6 py-2 bg-black/20 rounded-2xl overflow-x-auto max-w-full no-scrollbar border border-white/5">
                    {images.map((img, idx) => (
                        <div key={img.id} className="relative group/thumb">
                            <button
                                onClick={() => {
                                    setCurrentIndex(idx);
                                    setMode('preview');
                                }}
                                className={cn(
                                    "relative h-14 w-14 shrink-0 rounded-lg overflow-hidden border-2 transition-all duration-300",
                                    idx === currentIndex
                                        ? "border-emerald-500 scale-110 shadow-lg"
                                        : "border-transparent opacity-40 hover:opacity-100"
                                )}
                            >
                                <img src={img.previewUrl} className="h-full w-full object-cover" />
                            </button>
                            {images.length > 1 && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const newImages = images.filter((_, i) => i !== idx);
                                        if (newImages.length === 0) onClose();
                                        else {
                                            setImages(newImages);
                                            setCurrentIndex(Math.min(currentIndex, newImages.length - 1));
                                        }
                                    }}
                                    className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                    ))}

                    <div className="relative">
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            id="add-more-images"
                            onChange={(e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                    const newFiles = Array.from(e.target.files).map(file => ({
                                        id: Math.random().toString(36).substring(7),
                                        file,
                                        previewUrl: URL.createObjectURL(file),
                                        caption: '',
                                        viewOnce: false
                                    }));
                                    setImages(prev => [...prev, ...newFiles]);
                                    setCurrentIndex(images.length);
                                    setMode('preview');
                                    e.target.value = '';
                                }
                            }}
                        />
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => document.getElementById('add-more-images')?.click()}
                            className="h-14 w-14 shrink-0 rounded-lg border-2 border-dashed border-white/30 bg-white/5 hover:bg-white/10 hover:border-white/50 text-white/50 hover:text-white transition-all ml-2"
                            title="Adicionar mais imagens"
                        >
                            <span className="text-2xl font-light mb-0.5">+</span>
                        </Button>
                    </div>
                </div>
            </div>
        </motion.div>,
        document.body
    );
};
