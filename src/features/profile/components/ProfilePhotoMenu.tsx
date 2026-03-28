import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Eye, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProfilePhotoMenuProps {
  currentPhotoURL?: string;
  onView: () => void;
  onEdit: () => void;
  trigger: React.ReactNode;
}

export const ProfilePhotoMenu = ({
  currentPhotoURL,
  onView,
  onEdit,
  trigger,
}: ProfilePhotoMenuProps) => {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        {trigger}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        align="center"
        side="bottom"
        sideOffset={12}
        className={cn(
          'z-50 min-w-[200px] rounded-lg bg-white shadow-xl border border-gray-200 p-1 animate-in fade-in zoom-in-95',
          'text-sm text-gray-800'
        )}
      >
        {currentPhotoURL && (
          <DropdownMenu.Item
            onSelect={(e) => {
              e.preventDefault();
              onView();
            }}
            className="flex items-center gap-2 px-3 py-2 cursor-pointer rounded-md hover:bg-gray-100"
          >
            <Eye className="w-4 h-4 text-gray-500" />
            Ver foto do perfil
          </DropdownMenu.Item>
        )}
        <DropdownMenu.Item
          onSelect={(e) => {
            e.preventDefault();
            onEdit();
          }}
          className="flex items-center gap-2 px-3 py-2 cursor-pointer rounded-md hover:bg-gray-100"
        >
          <Camera className="w-4 h-4 text-gray-500" />
          {currentPhotoURL ? 'Editar foto do perfil' : 'Adicionar foto do perfil'}
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
};
