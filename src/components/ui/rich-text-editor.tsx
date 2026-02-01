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
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import { mergeAttributes } from '@tiptap/core';
import tippy, { type Instance, type Props } from 'tippy.js';
import {
  AtSign,
  Bold,
  Highlighter,
  Italic,
  Palette,
  Redo,
  Smile,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo,
} from 'lucide-react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import i18n_pt from '@emoji-mart/data/i18n/pt.json';
import Tippy from '@tippyjs/react';

import { OptimizedAvatar } from '@/components/ui/optimized-avatar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { PrefetchLink } from '@/components/ui/prefetch-link';
import { Separator } from '@/components/ui/separator';
import { userByNicknameQuery as userQueries } from '@/features/users/user.queries';
import { cn } from '@/lib/utils';
import { PATHS } from '@/router/paths';
import { searchUsersForMention } from '@/services/firestore';

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
  content?: string;
  onChange?: (content: string) => void;
  placeholder?: string;
  maxLength?: number;
  className?: string;
  disabled?: boolean;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  content = '',
  onChange,
  placeholder = 'Digite aqui...',
  maxLength = 160,
  className,
  disabled = false,
}) => {
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [characterCount, setCharacterCount] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        blockquote: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({
        placeholder: ({ editor }) => (editor.isEmpty ? placeholder : ''),
      }),
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
    ],
    content,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const text = editor.getText();
      setCharacterCount(text.length);
      if (text.length <= maxLength) {
        onChange?.(html);
      }
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
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
      setCharacterCount(editor.getText().length);
    }
  }, [content, editor]);

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
  const isOverLimit = characterCount > maxLength;

  return (
    <div className={cn('border border-gray-200 rounded-lg overflow-hidden', className)}>
      {/* Toolbar */}
      <div className="border-b border-gray-200 p-2 flex items-center gap-1 flex-wrap bg-gray-50">
        <button type="button" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo() || disabled} className="h-8 w-8 p-0 inline-flex items-center justify-center rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed">
          <Undo className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo() || disabled} className="h-8 w-8 p-0 inline-flex items-center justify-center rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed">
          <Redo className="h-4 w-4" />
        </button>
        <Separator orientation="vertical" className="h-6 mx-1" />
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} disabled={disabled} className={cn('h-8 w-8 p-0 inline-flex items-center justify-center rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed', editor.isActive('bold') && 'bg-gray-200')}>
          <Bold className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} disabled={disabled} className={cn('h-8 w-8 p-0 inline-flex items-center justify-center rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed', editor.isActive('italic') && 'bg-gray-200')}>
          <Italic className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} disabled={disabled} className={cn('h-8 w-8 p-0 inline-flex items-center justify-center rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed', editor.isActive('underline') && 'bg-gray-200')}>
          <UnderlineIcon className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} disabled={disabled} className={cn('h-8 w-8 p-0 inline-flex items-center justify-center rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed', editor.isActive('strike') && 'bg-gray-200')}>
          <Strikethrough className="h-4 w-4" />
        </button>
        <Separator orientation="vertical" className="h-6 mx-1" />
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" disabled={disabled} className="h-8 w-8 p-0 inline-flex items-center justify-center rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed">
              <Palette className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2">
            <div className="grid grid-cols-6 gap-1">
              {['#000000', '#374151', '#DC2626', '#EA580C', '#D97706', '#65A30D', '#059669', '#0891B2', '#3B82F6', '#6366F1', '#8B5CF6', '#A21CAF'].map((color) => (
                <button type="button" key={color} className="w-6 h-6 rounded border border-gray-300 hover:scale-110 transition-transform" style={{ backgroundColor: color }} onClick={() => editor.chain().focus().setColor(color).run()} />
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <button type="button" onClick={() => editor.chain().focus().toggleHighlight().run()} disabled={disabled} className={cn('h-8 w-8 p-0 inline-flex items-center justify-center rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed', editor.isActive('highlight') && 'bg-gray-200')}>
          <Highlighter className="h-4 w-4" />
        </button>
        <Separator orientation="vertical" className="h-6 mx-1" />
        <button type="button" onClick={() => { editor.chain().focus().insertContent('@').run(); }} disabled={disabled} className="h-8 w-8 p-0 inline-flex items-center justify-center rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed">
          <AtSign className="h-4 w-4" />
        </button>
        <div>
          <button ref={emojiButtonRef} type="button" disabled={disabled} onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)} className="h-8 w-8 p-0 inline-flex items-center justify-center rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed">
            <Smile className="h-4 w-4" />
          </button>
          {isEmojiPickerOpen && (
            <Tippy appendTo={document.body} content={<div className="bg-white shadow-lg rounded-lg overflow-hidden"><Picker data={data} onEmojiSelect={addEmoji} theme="light" i18n={i18n_pt} locale="pt" previewPosition="none" skinTonePosition="none" /></div>} interactive={true} visible={isEmojiPickerOpen} onClickOutside={() => setIsEmojiPickerOpen(false)} reference={emojiButtonRef} placement="bottom-start" trigger="manual" />
          )}
        </div>
      </div>

      {/* Editor Content */}
      <div className="relative">
        <EditorContent editor={editor} className={cn('tiptap min-h-[100px]', disabled && 'opacity-50 cursor-not-allowed')} />

        {/* Bubble Menu */}
        <BubbleMenu editor={editor} tippyOptions={{ duration: 100, placement: 'bottom', offset: [0, 10] }} className="bg-white border border-gray-200 rounded-lg shadow-lg p-1 flex items-center gap-1">
          <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={cn('h-8 w-8 p-0 inline-flex items-center justify-center rounded-md hover:bg-gray-200', editor.isActive('bold') && 'bg-gray-200')}>
            <Bold className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={cn('h-8 w-8 p-0 inline-flex items-center justify-center rounded-md hover:bg-gray-200', editor.isActive('italic') && 'bg-gray-200')}>
            <Italic className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={cn('h-8 w-8 p-0 inline-flex items-center justify-center rounded-md hover:bg-gray-200', editor.isActive('underline') && 'bg-gray-200')}>
            <UnderlineIcon className="h-4 w-4" />
          </button>
        </BubbleMenu>

        {/* Character Counter */}
        <div className="absolute bottom-2 right-2 text-xs text-gray-500 bg-white px-2 py-1 rounded shadow">
          <span className={cn(isOverLimit && 'text-red-500')}>
            {characterCount}/{maxLength}
          </span>
        </div>
      </div>
    </div>
  );
};