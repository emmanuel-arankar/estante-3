/**
 * Dados de localização do Brasil (estados e cidades)
 * Fonte: IBGE
 */

import locationData from './brazil-locations.json';

export interface BrazilState {
  name: string;
  code: string;
  cities: string[];
}

export interface LocationData {
  states: BrazilState[];
}

// Exportar dados tipados
export const brazilLocations = locationData as LocationData;

// Funções auxiliares

/**
 * Retorna lista de todos os estados
 */
export function getStates(): BrazilState[] {
  return brazilLocations.states;
}

/**
 * Retorna lista de cidades de um estado específico
 */
export function getCitiesByState(stateCode: string): string[] {
  const state = brazilLocations.states.find(s => s.code === stateCode);
  return state?.cities || [];
}

/**
 * Busca estado pelo código
 */
export function getStateByCode(stateCode: string): BrazilState | undefined {
  return brazilLocations.states.find(s => s.code === stateCode);
}

/**
 * Busca estado pelo nome
 */
export function getStateByName(stateName: string): BrazilState | undefined {
  return brazilLocations.states.find(s => s.name === stateName);
}
