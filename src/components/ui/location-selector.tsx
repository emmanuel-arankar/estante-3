/**
 * Componente para seleção de localização (Estado e Cidade)
 * As cidades são filtradas automaticamente baseado no estado selecionado
 */

import React, { useState, useEffect, useCallback } from 'react';
import { MapPin } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getStates, getCitiesByState } from '@/data/locations';

// PERFORMANCE: Hoisted outside component render body to maintain stable array reference
const BRAZIL_STATES = getStates();

interface LocationSelectorProps {
  defaultState?: string;
  defaultCity?: string;
  onLocationChange?: (state: string, stateCode: string, city: string) => void;
  stateFieldName?: string;
  stateCodeFieldName?: string;
  cityFieldName?: string;
  className?: string;
}

/**
 * PERFORMANCE: Wrapped in React.memo to prevent unnecessary component re-renders
 * when parent form state updates or re-renders.
 */
export const LocationSelector = React.memo(({
  defaultState,
  defaultCity,
  onLocationChange,
  stateFieldName = 'state',
  stateCodeFieldName = 'stateCode',
  cityFieldName = 'city',
  className = '',
}: LocationSelectorProps) => {
  // Encontrar código do estado padrão se fornecido
  const initialStateCode = defaultState
    ? BRAZIL_STATES.find(s => s.name === defaultState || s.code === defaultState)?.code
    : undefined;

  const [selectedStateCode, setSelectedStateCode] = useState<string | undefined>(initialStateCode);
  const [selectedCity, setSelectedCity] = useState<string | undefined>(defaultCity);
  const [cities, setCities] = useState<string[]>([]);

  // Atualizar lista de cidades quando estado mudar
  useEffect(() => {
    if (selectedStateCode) {
      const stateCities = getCitiesByState(selectedStateCode);
      setCities(stateCities);

      // Se a cidade selecionada não está na lista do novo estado, limpar
      if (selectedCity && !stateCities.includes(selectedCity)) {
        setSelectedCity(undefined);
      }
    } else {
      setCities([]);
      setSelectedCity(undefined);
    }
  }, [selectedStateCode]);

  // Notificar mudanças para o componente pai
  useEffect(() => {
    if (onLocationChange && selectedStateCode && selectedCity) {
      const state = BRAZIL_STATES.find(s => s.code === selectedStateCode);
      if (state) {
        onLocationChange(state.name, state.code, selectedCity);
      }
    }
  }, [selectedStateCode, selectedCity, onLocationChange]);

  const handleStateChange = useCallback((stateCode: string) => {
    setSelectedStateCode(stateCode);
    setSelectedCity(undefined); // Limpar cidade ao trocar estado
  }, []);

  const handleCityChange = useCallback((city: string) => {
    setSelectedCity(city);
  }, []);

  return (
    <div className={`flex flex-col sm:flex-row gap-4 w-full ${className}`}>
      {/* Campo Estado */}
      <div className="space-y-2 flex-1 relative">
        <label htmlFor="state" className="text-sm font-medium text-gray-700">
          Estado
        </label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
          <Select
            name={stateCodeFieldName}
            value={selectedStateCode}
            onValueChange={handleStateChange}
          >
            <SelectTrigger className="pl-10">
              <SelectValue placeholder="Selecione o estado" />
            </SelectTrigger>
            <SelectContent>
              {BRAZIL_STATES.map((state) => (
                <SelectItem key={state.code} value={state.code}>
                  {state.name} ({state.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* Hidden input para enviar nome do estado */}
        <input type="hidden" name={stateFieldName} value={
          selectedStateCode ? BRAZIL_STATES.find(s => s.code === selectedStateCode)?.name || '' : ''
        } />
      </div>

      {/* Campo Cidade */}
      <div className="space-y-2 flex-1 relative">
        <label htmlFor="city" className="text-sm font-medium text-gray-700">
          Cidade
        </label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
          <Select
            name={cityFieldName}
            value={selectedCity}
            onValueChange={handleCityChange}
            disabled={!selectedStateCode || cities.length === 0}
          >
            <SelectTrigger className="pl-10">
              <SelectValue
                placeholder={
                  !selectedStateCode
                    ? "Selecione um estado primeiro"
                    : cities.length === 0
                    ? "Nenhuma cidade encontrada"
                    : "Selecione a cidade"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {cities.map((city) => (
                <SelectItem key={city} value={city}>
                  {city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
});

LocationSelector.displayName = 'LocationSelector';
