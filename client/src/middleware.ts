import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match all pathnames except for
  // - API routes
  // - static files (_next/static)
  // - image optimization files (_next/image)
  // - favicon.ico
  matcher: ['/', '/(en|kr)/:path*', '/((?!api|_next/static|_next/image|favicon.ico|firebase-messaging-sw.js).*)'],
};
