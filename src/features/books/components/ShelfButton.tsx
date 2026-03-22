import React, { useState } from 'react';
import { BookOpen, CheckCircle2, Bookmark, PauseCircle, XCircle, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserBookStatus } from '@estante/common-types';

interface ShelfButtonProps {
    editionId: string;
    workId: string;
    initialStatus?: UserBookStatus;
    size?: 'sm' | 'md';
    className?: string;
}

const statusOptions: { value: string; label: string; icon: React.ReactNode; color: string }[] = [
    { value: 'want-to-read', label: 'Quero Ler', icon: <Bookmark className="w-5 h-5" />, color: 'bg-slate-700 hover:bg-slate-800' },
    { value: 'reading', label: 'Lendo', icon: <BookOpen className="w-5 h-5" />, color: 'bg-blue-600 hover:bg-blue-700' },
    { value: 'rereading', label: 'Relendo', icon: <BookOpen className="w-5 h-5" />, color: 'bg-purple-600 hover:bg-purple-700' },
    { value: 'completed', label: 'Lido', icon: <CheckCircle2 className="w-5 h-5" />, color: 'bg-emerald-600 hover:bg-emerald-700' },
    { value: 'on-hold', label: 'Pausado', icon: <PauseCircle className="w-5 h-5" />, color: 'bg-amber-500 hover:bg-amber-600' },
    { value: 'abandoned', label: 'Abandonei', icon: <XCircle className="w-5 h-5" />, color: 'bg-red-600 hover:bg-red-700' }
];

export const ShelfButton: React.FC<ShelfButtonProps> = ({ editionId: _editionId, workId: _workId, initialStatus, size = 'md', className }) => {
    const [currentStatus, setCurrentStatus] = useState<string | undefined>(initialStatus);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Encontrar o botão ativo
    const activeOption = currentStatus
        ? statusOptions.find(o => o.value === currentStatus) || statusOptions[0]
        : statusOptions[0]; // "Quero Ler" como padrão

    const handleSelect = async (status: string) => {
        setIsOpen(false);
        setIsLoading(true);

        try {
            // TODO: Integrar com React Query Mutation para atualizar o BD (Fase 1B / 2B)
            // Aqui fingiremos um delay para simular a requisição real
            await new Promise(resolve => setTimeout(resolve, 800));
            setCurrentStatus(status);
        } catch (error) {
            console.error("Falha ao atualizar status", error);
        } finally {
            setIsLoading(false);
        }
    };

    const isCompact = size === 'sm';

    return (
        <div className={cn("relative w-full", className)}>
            <div className={cn(
                "flex w-full shadow-sm rounded-lg overflow-hidden",
                isCompact ? "h-9" : "h-11"
            )}>
                {/* Botão de Ação Principal */}
                <button
                    disabled={isLoading}
                    onClick={() => handleSelect(activeOption.value)}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 text-white font-bold transition-colors whitespace-nowrap",
                        isCompact ? "text-[13px] px-3" : "text-base py-2.5 px-4",
                        currentStatus ? activeOption.color : "bg-gray-800 hover:bg-gray-900",
                        isLoading && "opacity-80 cursor-wait"
                    )}
                >
                    {React.cloneElement(activeOption.icon as React.ReactElement, { 
                        className: cn(isCompact ? "w-4 h-4" : "w-5 h-5") 
                    })}
                    {isLoading ? "Salvando..." : (currentStatus ? activeOption.label : 'Quero Ler')}
                </button>

                {/* Dropdown Toggle */}
                <button
                    disabled={isLoading}
                    onClick={() => setIsOpen(!isOpen)}
                    className={cn(
                        "flex items-center justify-center text-white border-l transition-colors border-white/20",
                        isCompact ? "w-9" : "w-12",
                        currentStatus ? activeOption.color : "bg-gray-800 hover:bg-gray-900"
                    )}
                >
                    <ChevronDown className={cn(
                        isCompact ? "w-4 h-4" : "w-5 h-5",
                        "transition-transform", 
                        isOpen && "rotate-180"
                    )} />
                </button>
            </div>

            {/* Dropdown Menu */}
            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-100 z-50 overflow-hidden py-1">
                        {statusOptions.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => handleSelect(option.value)}
                                className={cn(
                                    "w-full flex items-center justify-between hover:bg-gray-50 transition-colors text-left",
                                    isCompact ? "px-3 py-2" : "px-4 py-3"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "p-1.5 rounded-md text-white",
                                        option.color.split(' ')[0] // Pega o bg primário sem o hover
                                    )}>
                                        {React.cloneElement(option.icon as React.ReactElement, { 
                                            className: cn(isCompact ? "w-3.5 h-3.5" : "w-4 h-4") 
                                        })}
                                    </div>
                                    <span className={cn(
                                        "font-medium text-gray-700",
                                        isCompact ? "text-sm" : "text-base"
                                    )}>{option.label}</span>
                                </div>
                                {currentStatus === option.value && (
                                    <Check className={cn(isCompact ? "w-4 h-4" : "w-5 h-5", "text-indigo-600")} />
                                )}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};
