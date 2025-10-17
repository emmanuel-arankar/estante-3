import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, ArrowDownAZ, ArrowDownZA, Check } from 'lucide-react';
import { SortOption, SortDirection } from '@/models/friendship';

interface SortDropdownProps {
  sortBy: SortOption;
  sortDirection: SortDirection;
  onSortChange: (sortBy: SortOption, sortDirection: SortDirection) => void;
}

export const SortDropdown: React.FC<SortDropdownProps> = ({
  sortBy,
  sortDirection,
  onSortChange,
}) => {
  const options = [
    { value: 'name', label: 'Nome' },
    { value: 'nickname', label: 'Alcunha' },
    { value: 'friendshipDate', label: 'Data de amizade' },
  ];

  // Função para obter o texto do botão baseado na ordenação atual
  const getButtonText = () => {
    const option = options.find(opt => opt.value === sortBy);
    if (!option) return 'Ordenar';
    
    return option.label;
  };

  // Função para obter o ícone correto
  const getSortIcon = () => {
    if (sortBy === 'default') return null;
    
    return sortDirection === 'asc' ? (
      <ArrowDownAZ className="h-4 w-4" />
    ) : (
      <ArrowDownZA className="h-4 w-4" />
    );
  };

  // Função para alternar a direção da ordenação
  const toggleSortDirection = () => {
    if (sortBy !== 'default') {
      onSortChange(sortBy, sortDirection === 'asc' ? 'desc' : 'asc');
    }
  };

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
          {getSortIcon()}
        </Button>
      )}
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex items-center space-x-1 min-w-[180px] justify-between"
          >
            <span className="text-sm truncate">{getButtonText()}</span>
            <ChevronDown className="h-3 w-3 flex-shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {options.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => {
                // Para nome e alcunha, padrão é A-Z (asc)
                // Para data, padrão é mais recente primeiro (desc)
                const direction = option.value === 'friendshipDate' ? 'desc' : 'asc';
                onSortChange(option.value as SortOption, direction);
              }}
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
};