import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { motion } from 'framer-motion';

interface ReadMoreProps {
  html: string;
  lines?: number;
}

export const ReadMore = ({ html, lines = 6 }: ReadMoreProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [needsExpansion, setNeedsExpansion] = useState(false);
  const [collapsedHeight, setCollapsedHeight] = useState<number>(0);
  const [fullHeight, setFullHeight] = useState<number>(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLDivElement>(null);

  // Efeito para medir as alturas (sem clamp e com clamp)
  useEffect(() => {
    if (hiddenRef.current && contentRef.current) {
      const fullH = hiddenRef.current.scrollHeight;
      const collH = contentRef.current.clientHeight;
      
      setFullHeight(fullH);
      
      // Se a altura total for maior que a visível com o clamp
      if (fullH > collH + 10) { // +10 de margem de segurança
        setNeedsExpansion(true);
        setCollapsedHeight(collH);
      } else {
        setNeedsExpansion(false);
      }
    }
  }, [html, lines]);

  return (
    <div className="relative">
      {/* Div invisível usado apenas para medir a altura total real sem clamp */}
      <div 
        ref={hiddenRef}
        className="prose prose-sm max-w-none absolute opacity-0 pointer-events-none"
        style={{ visibility: 'hidden' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <motion.div
        initial={false}
        animate={{ 
          height: isExpanded ? (fullHeight || 'auto') : (collapsedHeight || 'auto'),
          opacity: 1
        }}
        transition={{ 
          duration: 0.5, 
          ease: [0.4, 0, 0.2, 1] 
        }}
        onAnimationStart={() => setIsAnimating(true)}
        onAnimationComplete={() => setIsAnimating(false)}
        className="overflow-hidden"
      >
        <div
          ref={contentRef}
          className="prose prose-sm max-w-none text-gray-700 text-justify hyphens-auto"
          style={(!isExpanded && !isAnimating) ? {
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: lines,
            overflow: 'hidden'
          } : {
            // Durante a animação, não aplicamos clamp para o texto fluir livremente
            // e ser cortado pelo overflow:hidden do motion.div pai
            display: 'block'
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </motion.div>

      {needsExpansion && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-3 flex items-center justify-center w-full py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-emerald-600 font-bold text-sm transition-colors border border-gray-100"
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
