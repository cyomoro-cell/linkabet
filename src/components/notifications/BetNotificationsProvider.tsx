import { useBetNotifications } from '@/hooks/useBetNotifications';

/**
 * Invisible component that activates bet result notifications.
 * Must be inside BrowserRouter and QueryClientProvider.
 */
export function BetNotificationsProvider() {
  useBetNotifications();
  return null;
}
