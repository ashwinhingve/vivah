/**
 * Assistant page context — what the user is looking at right now.
 *
 * Sent with each assistant chat message so questions like "is this vendor
 * verified?" resolve "this" from the current page instead of asking the user
 * which entity they mean. Pure function — unit-testable without a DOM.
 *
 * Read at SEND time (window.location in the submit handler), never during
 * render: no hydration concerns and no useSearchParams/Suspense requirement
 * for the layout-mounted assistant sheet.
 */

export interface AssistantPageContext {
  pathname: string;
  entity_type?: 'vendor' | 'profile' | 'wedding' | 'discover';
  entity_id?: string;
  filters?: Record<string, string>;
}

const MAX_FILTERS = 10;
const MAX_FILTER_VALUE_CHARS = 100;

/** Strip the locale prefix (/hi) so route matching sees canonical paths. */
function stripLocale(pathname: string): string {
  return pathname.replace(/^\/hi(?=\/|$)/, '') || '/';
}

const ENTITY_ROUTES: Array<{
  pattern: RegExp;
  entity_type: NonNullable<AssistantPageContext['entity_type']>;
}> = [
  { pattern: /^\/vendors\/([^/]+)$/, entity_type: 'vendor' },
  // A match detail page shows the other person's profile.
  { pattern: /^\/matches\/([^/]+)$/, entity_type: 'profile' },
  { pattern: /^\/profiles\/([^/]+)$/, entity_type: 'profile' },
  { pattern: /^\/weddings\/([^/]+)$/, entity_type: 'wedding' },
];

const DISCOVER_ROUTES = new Set(['/matches', '/feed']);

export function getAssistantPageContext(
  pathname: string,
  search?: string | null,
): AssistantPageContext {
  const canonical = stripLocale(pathname);
  const context: AssistantPageContext = { pathname: canonical.slice(0, 300) };

  for (const route of ENTITY_ROUTES) {
    const match = canonical.match(route.pattern);
    const id = match?.[1];
    if (id && id !== 'new') {
      context.entity_type = route.entity_type;
      context.entity_id = id.slice(0, 100);
      return context;
    }
  }

  if (DISCOVER_ROUTES.has(canonical)) {
    context.entity_type = 'discover';
    if (search) {
      const params = new URLSearchParams(search);
      const filters: Record<string, string> = {};
      let count = 0;
      for (const [key, value] of params.entries()) {
        if (count >= MAX_FILTERS) break;
        if (!value) continue;
        filters[key.slice(0, 50)] = value.slice(0, MAX_FILTER_VALUE_CHARS);
        count++;
      }
      if (count > 0) context.filters = filters;
    }
  }

  return context;
}
