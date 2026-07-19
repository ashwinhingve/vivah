/**
 * Jest setup, run before each test file.
 *
 * React 19's reconciler refuses to treat updates as test-scoped unless this
 * global is set, and warns "The current testing environment is not configured
 * to support act(...)" on every state update. In practice that means any screen
 * driven by React Query never commits its resolved state, and queries like
 * findByText fail with "`render` function has not been called" — a message that
 * points nowhere near the actual cause. The jest-expo preset does not set it.
 */
global.IS_REACT_ACT_ENVIRONMENT = true;
