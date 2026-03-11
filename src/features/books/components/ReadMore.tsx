import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { motion } from 'framer-motion';

interface ReadMoreProps {
    html: string;
    lines?: number;
}

export const ReadMore = ({ html, lines = 6 }: ReadMoreProps) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [needsExpansion, setNeedsExpansion] = useState(false);
    const [collapsedHeight, setCollapsedHeight] = useState<number>(0);
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (contentRef.current) {
            // Verifica se há overflow text no clamp para decidir exibir o botão "Ler mais"
            const currentH = contentRef.current.clientHeight;
            const scrollH = contentRef.current.scrollHeight;
            if (scrollH > currentH) {
                setNeedsExpansion(true);
                if (collapsedHeight === 0) {
                    setCollapsedHeight(currentH);
                }
            } else {
                setNeedsExpansion(false);
            }
        }
    }, [html, lines, collapsedHeight]);

    return (
        <div className="relative">
            <motion.div
                initial={false}
                animate={{ height: isExpanded ? 'auto' : (needsExpansion && collapsedHeight > 0 ? collapsedHeight : 'auto') }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden"
            >
                <div
                    ref={contentRef}
                    className="prose prose-sm max-w-none text-gray-700 text-justify hyphens-auto"
                    style={!isExpanded ? {
                        display: '-webkit-box',
                        WebkitBoxOrient: 'vertical',
                        WebkitLineClamp: lines,
                        overflow: 'hidden'
                    } : {}}
                    dangerouslySetInnerHTML={{ __html: html }}
                />
            </motion.div>

            {needsExpansion && (
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="mt-3 flex items-center justify-center w-full py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-indigo-600 font-bold text-sm transition-colors border border-gray-100"
                >
                    {isExpanded ? (
                        <>Mostrar menos <ChevronUp className="ml-1 w-4 h-4" /></>
                    ) : (
                        <>Ler mais <ChevronDown className="ml-1 w-4 h-4" /></>
                    )}
                </button>
            )}
        </div>
    );
};
