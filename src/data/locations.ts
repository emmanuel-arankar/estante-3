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

// Performance Optimization: Hoist static Map lookup tables outside function calls
// to replace linear state array searches (.find) with O(1) hash map lookups.
const STATE_BY_CODE_MAP = new Map<string, BrazilState>(
  brazilLocations.states.map(s => [s.code, s])
);

const STATE_BY_NAME_MAP = new Map<string, BrazilState>(
  brazilLocations.states.map(s => [s.name, s])
);

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
  const state = STATE_BY_CODE_MAP.get(stateCode);
  return state?.cities || [];
}

/**
 * Busca estado pelo código
 */
export function getStateByCode(stateCode: string): BrazilState | undefined {
  return STATE_BY_CODE_MAP.get(stateCode);
}

/**
 * Busca estado pelo nome
 */
export function getStateByName(stateName: string): BrazilState | undefined {
  return STATE_BY_NAME_MAP.get(stateName);
}
