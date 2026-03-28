import { describe, it, expect } from 'vitest';
import { formatAudioTime, isValidAudioDuration } from './audioUtils';

describe('audioUtils', () => {
  describe('formatAudioTime', () => {
    it('formats seconds to MM:SS', () => {
      expect(formatAudioTime(0)).toBe('0:00');
      expect(formatAudioTime(30)).toBe('0:30');
      expect(formatAudioTime(90)).toBe('1:30');
      expect(formatAudioTime(150)).toBe('2:30');
    });

    it('handles hours correctly', () => {
      expect(formatAudioTime(3600)).toBe('60:00');
      expect(formatAudioTime(3661)).toBe('61:01');
    });

    it('pads single digit seconds with zero', () => {
      expect(formatAudioTime(5)).toBe('0:05');
      expect(formatAudioTime(65)).toBe('1:05');
    });

    it('handles edge cases', () => {
      expect(formatAudioTime(NaN)).toBe('0:00');
      expect(formatAudioTime(Infinity)).toBe('0:00');
    });
  });

  describe('isValidAudioDuration', () => {
    it('returns true for valid durations', () => {
      expect(isValidAudioDuration(1)).toBe(true);
      expect(isValidAudioDuration(120)).toBe(true);
      expect(isValidAudioDuration(3600)).toBe(true);
    });

    it('returns false for invalid durations', () => {
      expect(isValidAudioDuration(0.5)).toBe(false);
      expect(isValidAudioDuration(0)).toBe(false);
      expect(isValidAudioDuration(NaN)).toBe(false);
      expect(isValidAudioDuration(Infinity)).toBe(false);
      expect(isValidAudioDuration(-10)).toBe(false);
    });
  });
});
