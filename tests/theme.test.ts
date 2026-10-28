import { expect, test } from 'vitest';
import { resolveTheme } from '../src/theme';
test('resolves explicit preferences and defaults invalid preferences to the system', () => {
  expect(resolveTheme('light', true)).toBe('light');
  expect(resolveTheme('dark', false)).toBe('dark');
  for (const preference of ['system', null, 'invalid']) {
    expect(resolveTheme(preference, true)).toBe('dark');
    expect(resolveTheme(preference, false)).toBe('light');
  }
});
