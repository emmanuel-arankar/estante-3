import { describe, it, expect } from 'vitest';
import { getLanguageName, isValidLanguage, getLanguageFlag } from './book-languages';
import { getCitiesByState, getStateByCode, getStateByName } from './locations';
import { getContributorRoleName } from './book-contributors';
import { getAlternateNameTypeName, getScriptName } from './alternate-names';

describe('Data Utility Optimization Tests', () => {
  describe('book-languages', () => {
    it('returns language name by id', () => {
      expect(getLanguageName('pt-BR')).toBe('Português (Brasil)');
      expect(getLanguageName('en')).toBe('Inglês');
      expect(getLanguageName('unknown-id')).toBe('unknown-id');
    });

    it('checks if language is valid', () => {
      expect(isValidLanguage('pt-BR')).toBe(true);
      expect(isValidLanguage('en')).toBe(true);
      expect(isValidLanguage('unknown-id')).toBe(false);
    });

    it('returns language flag', () => {
      expect(getLanguageFlag('pt-BR')).toBe('🇧🇷');
      expect(getLanguageFlag('unknown-id')).toBe('🌐');
    });
  });

  describe('locations', () => {
    it('gets cities by state code', () => {
      const spCities = getCitiesByState('SP');
      expect(spCities).toBeDefined();
      expect(Array.isArray(spCities)).toBe(true);
      expect(spCities.length).toBeGreaterThan(0);
      expect(getCitiesByState('XX')).toEqual([]);
    });

    it('gets state by code', () => {
      const state = getStateByCode('SP');
      expect(state).toBeDefined();
      expect(state?.name).toBe('São Paulo');
      expect(getStateByCode('XX')).toBeUndefined();
    });

    it('gets state by name', () => {
      const state = getStateByName('São Paulo');
      expect(state).toBeDefined();
      expect(state?.code).toBe('SP');
      expect(getStateByName('NonExistentState')).toBeUndefined();
    });
  });

  describe('book-contributors', () => {
    it('gets contributor role name by id', () => {
      expect(getContributorRoleName('author')).toBe('Autor(a)');
      expect(getContributorRoleName('translator')).toBe('Tradutor(a)');
      expect(getContributorRoleName('unknown_role')).toBe('unknown_role');
    });
  });

  describe('alternate-names', () => {
    it('gets alternate name type name', () => {
      expect(getAlternateNameTypeName('native')).toBe('Nome Nativo');
      expect(getAlternateNameTypeName('unknown_type')).toBe('unknown_type');
    });

    it('gets script name', () => {
      expect(getScriptName('Cyrl')).toBe('Cirílico');
      expect(getScriptName('Hani', 'ja')).toBe('Kanji');
      expect(getScriptName('Hani', 'zh-CN')).toBe('Hanzi');
      expect(getScriptName('unknown_script')).toBe('unknown_script');
    });
  });
});
