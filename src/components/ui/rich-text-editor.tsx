import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  useCallback,
} from 'react';
import {
  EditorContent,
  ReactRenderer,
  useEditor,
  BubbleMenu,
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type NodeViewProps,
} from '@tiptap/react';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Mention, { MentionOptions } from '@tiptap/extension-mention';
import { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import CharacterCount from '@tiptap/extension-character-count';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { SpoilerMark } from './extensions/spoiler-mark';
import { mergeAttributes } from '@tiptap/core';
import tippy, { type Instance, type Props } from 'tippy.js';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  PaintBucket, Highlighter, Code, Quote, Image as ImageIcon,
  Undo, Redo, EyeOff, Smile,
  Heading1, Heading2, Heading3, Heading4,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Subscript as SubscriptIcon, Superscript as SuperscriptIcon, Trash2,
  ImagePlay, Indent, Outdent
} from 'lucide-react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import i18n_pt from '@emoji-mart/data/i18n/pt.json';
import Tippy from '@tippyjs/react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { GiphySelector } from '@/components/ui/giphy-selector';
import { HexColorPicker } from 'react-colorful';

import { OptimizedAvatar } from '@/components/ui/optimized-avatar';
import { PrefetchLink } from '@/components/ui/prefetch-link';
// import { Separator } from '@/components/ui/separator';
import { userByNicknameQuery as userQueries } from '@/features/users/user.queries';
import { apiClient } from '@/services/apiClient';
import { cn } from '@/lib/utils';
import { PATHS } from '@/router/paths';

// Busca de usuários para menções via API backend
// Busca de usuários para menções via API backend
const searchUsersForMention = async (
  searchTerm: string
): Promise<{ id: string; label: string; nickname: string; photoURL: string }[]> => {
  if (!searchTerm || searchTerm.length < 2) return [];
  try {
    return await apiClient<{ id: string; label: string; nickname: string; photoURL: string }[]>(
      `/users/search?q=${encodeURIComponent(searchTerm)}&limit=10`
    );
  } catch {
    return [];
  }
};

// # atualizado: Tipagem para os props do componente de menções (com photoURL)
type MentionListProps = SuggestionProps & {
  items: { id: string; label: string; nickname: string; photoURL: string }[];
};

// # atualizado: Interface para o Ref do componente de menções
interface MentionListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

// # atualizado: Componente da lista de sugestões (agora com avatares)
const MentionListComponent = forwardRef<MentionListRef, MentionListProps>(
  (props, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const selectItem = (index: number) => {
      const item = props.items[index];
      if (item) {
        // # atualizado: Passa todos os dados para o nó
        props.command({
          id: item.id,
          label: item.label, // Nome completo
          nickname: item.nickname, // Nickname
        });
      }
    };

    useEffect(() => setSelectedIndex(0), [props.items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex(
            (selectedIndex + props.items.length - 1) % props.items.length
          );
          return true;
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((selectedIndex + 1) % props.items.length);
          return true;
        }
        if (event.key === 'Enter') {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    return (
      <div className="mention-suggestions bg-white border border-gray-200 rounded-lg shadow-lg p-1 max-h-48 overflow-y-auto z-50 w-64">
        {props.items.length ? (
          props.items.map((item, index) => (
            <button
              key={item.id} // # atualizado
              className={cn(
                'w-full text-left p-2 rounded hover:bg-gray-100 text-sm flex items-center gap-2', // # atualizado
                index === selectedIndex && 'bg-gray-100'
              )}
              onClick={() => selectItem(index)}
            >
              {/* # atualizado: Adicionado o avatar do usuário */}
              <OptimizedAvatar
                src={item.photoURL}
                alt={item.label}
                fallback={item.label}
                className="w-8 h-8 rounded-full"
              />
              <div className="flex-1 overflow-hidden">
                <div className="font-medium truncate">{item.label}</div>
                <div className="text-gray-500 text-xs truncate">
                  @{item.nickname}
                </div>
              </div>
            </button>
          ))
        ) : (
          <div className="p-2 text-gray-500 text-sm">
            Nenhum usuário encontrado
          </div>
        )}
      </div>
    );
  }
);
MentionListComponent.displayName = 'MentionListComponent';

// # atualizado: Novo componente para renderizar o nó de menção como um PrefetchLink
const MentionLinkComponent: React.FC<NodeViewProps> = ({ node, deleteNode }) => {
  const nickname = node.attrs.nickname;

  // Fallback para o caso de o nickname ser 'undefined'
  if (!nickname) {
    return (
      <span className="mention-broken text-red-500" onClick={deleteNode}>
        @{node.attrs.label || 'inválido'}
      </span>
    );
  }

  // # atualizado: Define a query a ser pré-carregada
  const prefetchQuery = userQueries(nickname);

  return (
    // NodeViewWrapper é necessário para o Tiptap gerenciar o nó
    <NodeViewWrapper as="span" data-mention>
      <PrefetchLink
        to={PATHS.PROFILE({ nickname })}
        query={prefetchQuery}
        // # atualizado: Cor primária (emerald) e estilo de link
        className="text-primary hover:text-primary/80 bg-primary/10 px-1 py-0.5 rounded-md font-medium no-underline"
        data-id={node.attrs.id}
        data-label={node.attrs.label}
        data-nickname={nickname}
        // # atualizado: Impede que o cursor entre no link
        contentEditable={false}
      >
        @{nickname}
      </PrefetchLink>
    </NodeViewWrapper>
  );
};

// # atualizado: Objeto de sugestão com tipagem explícita
const suggestion: Omit<MentionOptions['suggestion'], 'editor'> = {
  allowSpaces: true,
  items: ({ query }: { query: string }) => searchUsersForMention(query),
  render: () => {
    let reactRenderer: ReactRenderer<MentionListRef>;
    let popup: Instance<Props>[];

    return {
      onStart: (props: SuggestionProps) => {
        reactRenderer = new ReactRenderer(MentionListComponent, {
          props,
          editor: props.editor as Editor,
        });

        if (!props.clientRect) return;

        popup = [tippy(document.body, {
          getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(),
          appendTo: () => document.body,
          content: reactRenderer.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        })];
      },
      onUpdate(props: SuggestionProps) {
        reactRenderer.updateProps(props);
        if (!props.clientRect) return;
        popup[0].setProps({
          getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(),
        });
      },
      onKeyDown(props: SuggestionKeyDownProps) {
        if (props.event.key === 'Escape') {
          popup[0].hide();
          return true;
        }
        return reactRenderer.ref?.onKeyDown(props) ?? false;
      },
      onExit() {
        if (popup) popup[0].destroy();
        if (reactRenderer) reactRenderer.destroy();
      },
    };
  },
};

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  className?: string;
  variant?: 'minimal' | 'full'; // Define o quão completo o Editor ficará
}

const STANDARD_COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
  '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
  '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc',
  '#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd',
  '#cc4125', '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6d9eeb', '#6fa8dc', '#8e7cc3', '#c27ba0',
  '#a61c00', '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3c78d8', '#3d85c6', '#674ea7', '#a64d79',
  '#5b0f00', '#660000', '#783f04', '#7f6000', '#274e13', '#0c343d', '#1c4587', '#073763', '#20124d', '#4c1130'
];

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : { r: 0, g: 0, b: 0 };
};

const rgbToHex = (r: number, g: number, b: number) => {
  return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).padStart(6, '0');
};

const hexToHsl = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 0, s: 0, l: 0 };
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  let max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
};

const hslToHex = (h: number, s: number, l: number) => {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

const ColorPalette = ({
  onSelectColor,
  title
}: {
  onSelectColor: (color: string | undefined) => void,
  title: string
}) => {
  const [isCustom, setIsCustom] = useState(false);
  const [customColor, setCustomColor] = useState('#4f46e5');
  const [colorMode, setColorMode] = useState<'rgb' | 'hsl'>('rgb');

  const safeHex = customColor.startsWith('#') || customColor.match(/^[0-9A-F]{6}$/i) ? customColor : '#4f46e5';
  const rgb = React.useMemo(() => hexToRgb(safeHex), [safeHex]);
  const hsl = React.useMemo(() => hexToHsl(safeHex), [safeHex]);

  const handleRgbChange = (channel: 'r' | 'g' | 'b', val: string) => {
    const num = Math.min(255, Math.max(0, parseInt(val || '0', 10)));
    const newRgb = { ...rgb, [channel]: num };
    setCustomColor(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
  };

  const handleHslChange = (channel: 'h' | 's' | 'l', val: string) => {
    const max = channel === 'h' ? 360 : 100;
    const num = Math.min(max, Math.max(0, parseInt(val || '0', 10)));
    const newHsl = { ...hsl, [channel]: num };
    setCustomColor(hslToHex(newHsl.h, newHsl.s, newHsl.l));
  };

  if (isCustom) {
    return (
      <div className="p-3 w-[264px] bg-white border border-gray-200 rounded-lg shadow-lg z-50 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-gray-500">Cor Personalizada</div>
          <button
            type="button"
            onClick={() => setIsCustom(false)}
            className="text-xs text-gray-400 hover:text-gray-700 font-medium"
          >
            Voltar
          </button>
        </div>

        <div className="w-full">
          <HexColorPicker color={safeHex} onChange={setCustomColor} style={{ width: '100%', height: '160px' }} />
        </div>

        <div className="flex bg-white items-center gap-2 mt-1">
          <div className="w-[48px] h-8 border border-gray-300 rounded-md flex-shrink-0 shadow-sm" style={{ backgroundColor: safeHex }} />
          <input
            type="text"
            value={customColor}
            onChange={(e) => setCustomColor(e.target.value)}
            className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-300 rounded-md outline-none focus:border-emerald-500 h-8 shadow-sm"
            placeholder="#HEX"
          />
        </div>

        <div className="flex items-end gap-2 mt-1">
          <div className="w-[48px] flex-shrink-0 relative">
            <select
              value={colorMode}
              onChange={(e) => setColorMode(e.target.value as any)}
              className="w-full bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-md h-8 text-[11px] px-1 pr-4 outline-none uppercase appearance-none bg-transparent relative z-10 font-bold transition-colors cursor-pointer"
            >
              <option value="rgb">RGB</option>
              <option value="hsl">HSL</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-1 pointer-events-none text-gray-500 z-0">
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>

          <div className="flex-1 flex gap-2 justify-between">
            <div className="flex flex-col items-center w-1/3">
              <span className="text-[10px] font-bold text-gray-700 mb-0.5 uppercase">{colorMode === 'rgb' ? 'r' : 'h'}</span>
              <input type="number" min="0" max={colorMode === 'rgb' ? 255 : 360} value={colorMode === 'rgb' ? rgb.r : hsl.h} onChange={(e) => colorMode === 'rgb' ? handleRgbChange('r', e.target.value) : handleHslChange('h', e.target.value)} className="w-full h-8 border border-gray-300 focus:border-emerald-500 outline-none rounded-md text-right text-sm pr-1 shadow-sm transition-all" />
            </div>
            <div className="flex flex-col items-center w-1/3">
              <span className="text-[10px] font-bold text-gray-700 mb-0.5 uppercase">{colorMode === 'rgb' ? 'g' : 's'}</span>
              <input type="number" min="0" max={colorMode === 'rgb' ? 255 : 100} value={colorMode === 'rgb' ? rgb.g : hsl.s} onChange={(e) => colorMode === 'rgb' ? handleRgbChange('g', e.target.value) : handleHslChange('s', e.target.value)} className="w-full h-8 border border-gray-300 focus:border-emerald-500 outline-none rounded-md text-right text-sm pr-1 shadow-sm transition-all" />
            </div>
            <div className="flex flex-col items-center w-1/3">
              <span className="text-[10px] font-bold text-gray-700 mb-0.5 uppercase">{colorMode === 'rgb' ? 'b' : 'l'}</span>
              <input type="number" min="0" max={colorMode === 'rgb' ? 255 : 100} value={colorMode === 'rgb' ? rgb.b : hsl.l} onChange={(e) => colorMode === 'rgb' ? handleRgbChange('b', e.target.value) : handleHslChange('l', e.target.value)} className="w-full h-8 border border-gray-300 focus:border-emerald-500 outline-none rounded-md text-right text-sm pr-1 shadow-sm transition-all" />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSelectColor(customColor)}
          className="w-full mt-2 bg-[#00A86B] hover:bg-emerald-600 text-white font-medium py-1.5 rounded-md text-sm transition-colors shadow-sm"
        >
          Aplicar Cor
        </button>
      </div>
    );
  }

  return (
    <div className="p-3 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
      <div className="text-xs font-semibold text-gray-500 mb-3">{title}</div>

      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={(e) => { e.preventDefault(); onSelectColor(undefined); }}
          type="button"
          className="w-5 h-5 rounded hover:scale-110 transition-transform border border-gray-300 bg-black flex-shrink-0"
          title="Automático"
        />
        <span className="text-sm font-medium text-gray-700">Automático</span>
      </div>

      <div className="w-full h-px bg-gray-200 my-2" />

      <div className="grid grid-cols-10 gap-1 mb-2">
        {STANDARD_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className="w-5 h-5 rounded hover:scale-110 transition-transform border border-black/10"
            style={{ backgroundColor: c }}
            onClick={(e) => { e.preventDefault(); onSelectColor(c); }}
            title={c}
          />
        ))}
      </div>
      <div className="w-full h-px bg-gray-200 my-2" />
      <button
        type="button"
        onClick={() => setIsCustom(true)}
        className="w-full mt-1 bg-gray-400 hover:bg-gray-500 text-white font-medium py-1.5 rounded-md text-sm transition-colors shadow-sm"
      >
        Cor Personalizada
      </button>
    </div>
  );
};

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Digite aqui...',
  maxLength,
  className = '',
  variant = 'minimal'
}) => {
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isGifOpen, setIsGifOpen] = useState(false);
  const [isTextColorOpen, setIsTextColorOpen] = useState(false);
  const [isHighlightColorOpen, setIsHighlightColorOpen] = useState(false);

  // Helper component for toolbar buttons
  const ToolbarButton: React.FC<{
    onClick: () => void;
    icon: React.ReactNode;
    title: string;
    isActive?: boolean;
    disabled?: boolean;
  }> = ({ onClick, icon, title, isActive = false, disabled = false }) => (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
      }}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'h-8 w-8 p-0 inline-flex items-center justify-center rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed',
        isActive && 'bg-gray-200'
      )}
      title={title}
    >
      {icon}
    </button>
  );

  // Constrói lista de plugins atráves da Variante
  const extensions: any[] = [
    StarterKit.configure({
      heading: variant === 'full' ? { levels: [1, 2, 3, 4] } : false, // Enable heading 1-4
      codeBlock: variant === 'full' ? {} : false,
      blockquote: variant === 'full' ? {} : false, // Enable blockquote only for full variant
      horizontalRule: false,
      bulletList: variant === 'full' ? {} : false, // Enable bulletList only for full variant
      orderedList: variant === 'full' ? {} : false, // Enable orderedList only for full variant
      listItem: variant === 'full' ? {} : false, // Enable listItem only for full variant
    }),
    Underline,
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    Placeholder.configure({
      placeholder: ({ editor }) => (editor.isEmpty ? placeholder : ''),
    }),
    Image.extend({
      addAttributes() {
        return {
          ...this.parent?.(),
          size: {
            default: 'medium',
            parseHTML: element => element.getAttribute('data-size') || 'medium',
            renderHTML: attributes => {
              return {
                'data-size': attributes.size,
                style: attributes.size === 'small' ? 'width: 250px'
                  : attributes.size === 'medium' ? 'width: 500px'
                    : 'width: 100%',
              }
            },
          },
        }
      },
    }).configure({
      HTMLAttributes: {
        class: 'max-h-[400px] object-cover mx-auto transition-all duration-300 ease-in-out',
      },
    }),
    SpoilerMark,
    Mention.extend({
      addAttributes() {
        return {
          id: { default: null },
          label: { default: null },
          nickname: { default: null },
        };
      },
      // # atualizado: Padroniza o texto para @nickname
      renderText({ node }) {
        return `@${node.attrs.nickname}`;
      },
      // # atualizado: Define como o Tiptap lê o HTML salvo
      parseHTML() {
        return [{ tag: 'a[data-mention]' }];
      },
      // # atualizado: Define o HTML que é salvo (para fallback)
      renderHTML({ node, HTMLAttributes }) {
        if (!node.attrs.nickname) {
          return ['span', mergeAttributes(HTMLAttributes), 'menção inválida'];
        }
        return [
          'a',
          mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
            'data-mention': '',
            href: PATHS.PROFILE({ nickname: node.attrs.nickname }),
            // # atualizado: Adiciona as classes de cor aqui também
            class: 'text-primary bg-primary/10 px-1 rounded-md font-medium no-underline',
          }),
          `@${node.attrs.nickname}`,
        ];
      },
      addNodeView() {
        return ReactNodeViewRenderer(MentionLinkComponent);
      },
    }).configure({
      HTMLAttributes: {
        class: 'mention', // Classe de fallback
      },
      // # atualizado: Resolve o problema do cursor ao apagar
      deleteTriggerWithBackspace: true,
      suggestion,
    }),
  ];

  if (variant === 'full') {
    extensions.push(
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Subscript,
      Superscript
    );
  }

  if (maxLength) {
    extensions.push(CharacterCount.configure({ limit: maxLength }));
  }

  const editor = useEditor({
    extensions,
    content: value,
    editable: true, // Editor is always editable, disabled state is handled by toolbar buttons
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange?.(html);
    },
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm max-w-none focus:outline-none min-h-[100px] p-3',
          'prose-p:my-1 prose-p:leading-relaxed',
          className
        ),
      },
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, false); // false to prevent triggering onUpdate
    }
  }, [value, editor]);

  const addEmoji = useCallback(
    (emoji: any) => {
      if (editor) {
        editor.chain().focus().insertContent(emoji.native).run();
      }
    },
    [editor]
  );

  if (!editor) {
    return null;
  }

  const emojiButtonRef = React.useRef<HTMLButtonElement>(null);
  const characterCount = editor.storage.characterCount?.characters() || 0;
  const isOverLimit = maxLength && characterCount > maxLength;

  return (
    <div className={`border border-gray-200 rounded-xl overflow-hidden bg-white focus-within:ring-2 focus-within:ring-emerald-600 focus-within:border-emerald-600 transition-all shadow-sm flex flex-col ${className}`}>

      {/* Toolbar Avançada Tiptap */}
      <div className="bg-gray-50 border-b border-gray-200 p-2 flex flex-wrap gap-1 items-center z-10">
        {/* Desfazer / Refazer */}
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} icon={<Undo className="w-4 h-4" />} title="Desfazer" />
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} icon={<Redo className="w-4 h-4" />} title="Refazer" />

        <div className="w-px h-4 bg-gray-300 mx-1" />

        {/* Formatações de Texto Básicas */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} icon={<Bold className="w-4 h-4" />} title="Negrito" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} icon={<Italic className="w-4 h-4" />} title="Itálico" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} icon={<UnderlineIcon className="w-4 h-4" />} title="Sublinhado" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} icon={<Strikethrough className="w-4 h-4" />} title="Tachado" />

        {variant === 'full' && (
          <>
            <ToolbarButton onClick={() => editor.chain().focus().toggleSubscript().run()} isActive={editor.isActive('subscript')} icon={<SubscriptIcon className="w-4 h-4" />} title="Subscrito" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleSuperscript().run()} isActive={editor.isActive('superscript')} icon={<SuperscriptIcon className="w-4 h-4" />} title="Sobrescrito" />
          </>
        )}

        <div className="w-px h-4 bg-gray-300 mx-1" />

        {/* Cabeçalhos (Apenas Full) */}
        {variant === 'full' && (
          <>
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} icon={<Heading1 className="w-4 h-4" />} title="Título 1" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} icon={<Heading2 className="w-4 h-4" />} title="Título 2" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive('heading', { level: 3 })} icon={<Heading3 className="w-4 h-4" />} title="Título 3" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} isActive={editor.isActive('heading', { level: 4 })} icon={<Heading4 className="w-4 h-4" />} title="Título 4" />
            <div className="w-px h-4 bg-gray-300 mx-1" />
          </>
        )}

        {/* Alinhamento (Apenas Full)*/}
        {variant === 'full' && (
          <>
            <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })} icon={<AlignLeft className="w-4 h-4" />} title="Alinhar Esquerda" />
            <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })} icon={<AlignCenter className="w-4 h-4" />} title="Centralizar" />
            <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={editor.isActive({ textAlign: 'right' })} icon={<AlignRight className="w-4 h-4" />} title="Alinhar Direita" />
            <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('justify').run()} isActive={editor.isActive({ textAlign: 'justify' })} icon={<AlignJustify className="w-4 h-4" />} title="Justificar" />
            <div className="w-px h-4 bg-gray-300 mx-1" />
          </>
        )}

        {/* Cores e Marcações */}
        <Popover open={isTextColorOpen} onOpenChange={setIsTextColorOpen}>
          <PopoverTrigger asChild>
            <div onClick={(e) => { e.preventDefault(); setIsTextColorOpen(!isTextColorOpen); }}>
              <ToolbarButton onClick={() => { }} icon={<PaintBucket className="w-4 h-4" />} title="Cor do Texto" />
            </div>
          </PopoverTrigger>
          <PopoverContent className="p-0 border-0 shadow-none w-auto bg-transparent" side="bottom" align="center" sideOffset={5}>
            <ColorPalette onSelectColor={(color) => { if (color) { editor.chain().focus().setColor(color).run(); } else { editor.chain().focus().unsetColor().run() } setIsTextColorOpen(false); }} title="Cores do Tema" />
          </PopoverContent>
        </Popover>

        <Popover open={isHighlightColorOpen} onOpenChange={setIsHighlightColorOpen}>
          <PopoverTrigger asChild>
            <div onClick={(e) => { e.preventDefault(); setIsHighlightColorOpen(!isHighlightColorOpen); }} onContextMenu={(e) => { e.preventDefault(); editor.chain().focus().unsetHighlight().run(); }}>
              <ToolbarButton onClick={() => { }} isActive={editor.isActive('highlight')} icon={<Highlighter className="w-4 h-4" />} title="Cor de Fundo (Clique direito para remover)" />
            </div>
          </PopoverTrigger>
          <PopoverContent className="p-0 border-0 shadow-none w-auto bg-transparent" side="bottom" align="center" sideOffset={5}>
            <ColorPalette onSelectColor={(color) => { if (color) { editor.chain().focus().setHighlight({ color }).run(); } else { editor.chain().focus().unsetHighlight().run(); } setIsHighlightColorOpen(false); }} title="Cores de Realce" />
          </PopoverContent>
        </Popover>

        <div className="w-px h-4 bg-gray-300 mx-1" />

        {/* Listas e Blocos (Full / Parcial) */}
        {variant === 'full' && (
          <>
            <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} icon={<List className="w-4 h-4" />} title="Lista com Marcadores" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} icon={<ListOrdered className="w-4 h-4" />} title="Lista Numerada" />
            <ToolbarButton onClick={() => editor.chain().focus().sinkListItem('listItem').run()} disabled={!editor.can().sinkListItem('listItem')} icon={<Indent className="w-4 h-4" />} title="Aumentar Recuo (Ninho)" />
            <ToolbarButton onClick={() => editor.chain().focus().liftListItem('listItem').run()} disabled={!editor.can().liftListItem('listItem')} icon={<Outdent className="w-4 h-4" />} title="Diminuir Recuo" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} icon={<Quote className="w-4 h-4" />} title="Citação" />
            <div className="w-px h-4 bg-gray-300 mx-1" />

            <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} isActive={editor.isActive('code')} icon={<Code className="w-4 h-4" />} title="Código inline" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleSpoiler().run()} isActive={editor.isActive('spoiler')} icon={<EyeOff className={`w-4 h-4 ${editor.isActive('spoiler') ? 'text-red-500' : ''}`} />} title="Spoiler" />
            <div className="w-px h-4 bg-gray-300 mx-1" />
          </>
        )}

        {/* Utilitários Extras / Mídias */}
        {variant === 'full' && (
          <>
            <ToolbarButton onClick={() => { const url = window.prompt('URL da imagem (ex: https://.../gato.gif):'); if (url) { editor.chain().focus().setImage({ src: url }).run(); } }} icon={<ImageIcon className="w-4 h-4" />} title="Inserir Imagem (URL)" />

            <Popover open={isGifOpen} onOpenChange={setIsGifOpen}>
              <PopoverTrigger asChild>
                <div onClick={(e) => { e.preventDefault(); setIsGifOpen(!isGifOpen); }}>
                  <ToolbarButton onClick={() => { } /* Handled by trigger wrapper */} isActive={isGifOpen} icon={<ImagePlay className="w-4 h-4" />} title="Inserir GIF Aleatório" />
                </div>
              </PopoverTrigger>
              <PopoverContent className="p-0 border-0 shadow-lg w-auto h-auto rounded-xl bg-transparent mt-2" side="bottom" align="center">
                <div className="bg-white border shadow-md rounded-xl">
                  <GiphySelector onSelect={(url) => { editor.chain().focus().setImage({ src: url }).run(); setIsGifOpen(false); }} />
                </div>
              </PopoverContent>
            </Popover>
          </>
        )}

        {/* Emoji Picker sempre presente independente da variante na aba de mídias */}
        <div className="relative">
          <button ref={emojiButtonRef} type="button" onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)} className="h-8 w-8 p-0 inline-flex items-center justify-center rounded-md hover:bg-gray-200">
            <Smile className="h-4 w-4" />
          </button>
          {isEmojiPickerOpen && (
            <Tippy appendTo={document.body} content={<div className="bg-white shadow-lg rounded-lg overflow-hidden"><Picker data={data} onEmojiSelect={addEmoji} theme="light" i18n={i18n_pt} locale="pt" previewPosition="none" skinTonePosition="none" /></div>} interactive={true} visible={isEmojiPickerOpen} onClickOutside={() => setIsEmojiPickerOpen(false)} reference={emojiButtonRef} placement="bottom-start" trigger="manual" />
          )}
        </div>
      </div>

      {/* Editor Content */}
      <div className="relative flex-1">
        <EditorContent editor={editor} className={cn('tiptap min-h-[100px] h-full outline-none')} />

        {/* Bubble Menu de Texto (Oculto em Imagens) */}
        <BubbleMenu
          editor={editor}
          shouldShow={({ state, editor }) => !editor.isActive('image') && !state.selection.empty}
          tippyOptions={{ duration: 100, placement: 'top', offset: [0, 10] }}
          className="bg-white border border-gray-200 rounded-lg shadow-lg p-1 flex items-center gap-1"
        >
          <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} icon={<Bold className="w-4 h-4" />} title="Negrito" />
          <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} icon={<Italic className="w-4 h-4" />} title="Itálico" />
          <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} icon={<UnderlineIcon className="w-4 h-4" />} title="Sublinhado" />
          {variant === 'full' && (
            <>
              <div className="w-px h-4 bg-gray-300 mx-1" />
              <ToolbarButton onClick={() => editor.chain().focus().toggleSpoiler().run()} isActive={editor.isActive('spoiler')} icon={<EyeOff className={`w-4 h-4 ${editor.isActive('spoiler') ? 'text-red-500' : ''}`} />} title="Spoiler" />
            </>
          )}
        </BubbleMenu>

        {/* Bubble Menu Específico para Imagens */}
        <BubbleMenu
          editor={editor}
          shouldShow={({ editor }) => editor.isActive('image')}
          tippyOptions={{ duration: 100, placement: 'bottom', offset: [0, 10] }}
          className="bg-white border border-gray-200 rounded-lg shadow-lg p-1 flex items-center gap-1"
        >
          <ToolbarButton onClick={() => editor.chain().focus().updateAttributes('image', { size: 'small' }).run()} isActive={editor.isActive('image', { size: 'small' })} icon={<span className="text-[10px] font-bold">P</span>} title="Pequeno (250px)" />
          <ToolbarButton onClick={() => editor.chain().focus().updateAttributes('image', { size: 'medium' }).run()} isActive={editor.isActive('image', { size: 'medium' })} icon={<span className="text-[10px] font-bold">M</span>} title="Médio (500px)" />
          <ToolbarButton onClick={() => editor.chain().focus().updateAttributes('image', { size: 'large' }).run()} isActive={editor.isActive('image', { size: 'large' })} icon={<span className="text-[10px] font-bold px-0.5">G</span>} title="Grande (100%)" />
          <div className="w-px h-4 bg-gray-300 mx-1" />
          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })} icon={<AlignLeft className="w-4 h-4" />} title="Alinhar Esquerda" />
          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })} icon={<AlignCenter className="w-4 h-4" />} title="Centralizar" />
          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={editor.isActive({ textAlign: 'right' })} icon={<AlignRight className="w-4 h-4" />} title="Alinhar Direita" />
          <div className="w-px h-4 bg-gray-300 mx-1" />
          <ToolbarButton onClick={() => editor.chain().focus().deleteSelection().run()} icon={<Trash2 className="w-4 h-4 text-red-500" />} title="Remover Imagem" />
        </BubbleMenu>

        {/* Contador de Caracteres */}
        {maxLength && (
          <div className="absolute bottom-2 right-2 text-xs text-gray-400 font-medium">
            <span className={cn(isOverLimit && 'text-red-500 font-bold')}>
              {characterCount}/{maxLength}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};