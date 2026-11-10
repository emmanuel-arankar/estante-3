import React, { useCallback, useMemo } from 'react';
import { ChevronDown, ArrowDownAZ, ArrowDownZA, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SortOption, SortDirection } from '@estante/common-types';

interface SortDropdownProps {
  sortBy: SortOption;
  sortDirection: SortDirection;
  onSortChange: (sortBy: SortOption, sortDirection: SortDirection) => void;
}

// Hoisted static array to prevent recreating array objects on every render pass
const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: 'name', label: 'Nome' },
  { value: 'nickname', label: 'Alcunha' },
  { value: 'friendshipDate', label: 'Data de amizade' },
];

/**
 * SortDropdown
 * Performance Optimization: Wrapped in React.memo to prevent unnecessary re-renders
 * when parent lists (like DenormalizedFriendsList) re-render due to search input typing,
 * pagination, or background refreshes.
 */
export const SortDropdown: React.FC<SortDropdownProps> = React.memo(({
  sortBy,
  sortDirection,
  onSortChange,
}) => {
  // Memoize button text based on current sort option
  const buttonText = useMemo(() => {
    const option = SORT_OPTIONS.find((opt) => opt.value === sortBy);
    return option ? option.label : 'Ordenar';
  }, [sortBy]);

  // Memoize sort direction toggle icon
  const sortIcon = useMemo(() => {
    if (sortBy === 'default') return null;

    return sortDirection === 'asc' ? (
      <ArrowDownAZ className="h-4 w-4" />
    ) : (
      <ArrowDownZA className="h-4 w-4" />
    );
  }, [sortBy, sortDirection]);

  // Memoize toggle handler
  const toggleSortDirection = useCallback(() => {
    if (sortBy !== 'default') {
      onSortChange(sortBy, sortDirection === 'asc' ? 'desc' : 'asc');
    }
  }, [sortBy, sortDirection, onSortChange]);

  // Handle select option
  const handleSelectOption = useCallback((optionValue: SortOption) => {
    // Para nome e alcunha, padrão é A-Z (asc)
    // Para data, padrão é mais recente primeiro (desc)
    const direction = optionValue === 'friendshipDate' ? 'desc' : 'asc';
    onSortChange(optionValue, direction);
  }, [onSortChange]);

  return (
    <div className="flex items-center space-x-1">
      {/* Ícone de ordenação interativo (só aparece quando não é a ordenação padrão) */}
      {sortBy !== 'default' && (
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 m-1"
          onClick={toggleSortDirection}
          title={`Ordenar ${sortDirection === 'asc' ? 'decrescente' : 'crescente'}`}
        >
          {sortIcon}
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center space-x-1 min-w-[180px] justify-between"
          >
            <span className="text-sm truncate">{buttonText}</span>
            <ChevronDown className="h-3 w-3 flex-shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {SORT_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handleSelectOption(option.value)}
              className="flex items-center justify-between"
            >
              <span>{option.label}</span>
              {sortBy === option.value && (
                <Check className="h-4 w-4 text-emerald-600" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});

SortDropdown.displayName = 'SortDropdown';
