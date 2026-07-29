/**
 * getAssistantPageContext — pure route-parsing tests.
 */
import { describe, it, expect } from 'vitest';
import { getAssistantPageContext } from '../assistant-page-context';

describe('getAssistantPageContext', () => {
  it('detects a vendor detail page', () => {
    expect(getAssistantPageContext('/vendors/abc-123')).toEqual({
      pathname: '/vendors/abc-123',
      entity_type: 'vendor',
      entity_id: 'abc-123',
    });
  });

  it('strips the /hi locale prefix before matching', () => {
    expect(getAssistantPageContext('/hi/vendors/abc-123')).toEqual({
      pathname: '/vendors/abc-123',
      entity_type: 'vendor',
      entity_id: 'abc-123',
    });
  });

  it('treats a match detail page as a profile entity', () => {
    const ctx = getAssistantPageContext('/matches/m-9');
    expect(ctx.entity_type).toBe('profile');
    expect(ctx.entity_id).toBe('m-9');
  });

  it('detects wedding and profile detail pages', () => {
    expect(getAssistantPageContext('/weddings/w-1').entity_type).toBe('wedding');
    expect(getAssistantPageContext('/profiles/p-1').entity_type).toBe('profile');
  });

  it('does not treat /weddings/new as an entity', () => {
    expect(getAssistantPageContext('/weddings/new').entity_type).toBeUndefined();
  });

  it('captures discover filters from the query string', () => {
    const ctx = getAssistantPageContext('/matches', '?city=Bhopal&age_min=25&empty=');
    expect(ctx.entity_type).toBe('discover');
    expect(ctx.filters).toEqual({ city: 'Bhopal', age_min: '25' });
  });

  it('marks /feed as discover with no filters when the query is empty', () => {
    const ctx = getAssistantPageContext('/feed', '');
    expect(ctx.entity_type).toBe('discover');
    expect(ctx.filters).toBeUndefined();
  });

  it('leaves unrelated routes as plain pathnames', () => {
    expect(getAssistantPageContext('/dashboard')).toEqual({ pathname: '/dashboard' });
  });

  it('caps filter count at 10', () => {
    const query = `?${Array.from({ length: 15 }, (_, i) => `k${i}=v${i}`).join('&')}`;
    const ctx = getAssistantPageContext('/matches', query);
    expect(Object.keys(ctx.filters ?? {})).toHaveLength(10);
  });
});
