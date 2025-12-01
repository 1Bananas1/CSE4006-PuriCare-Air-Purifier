'use client';

import DemoModeBanner from '@/components/ui/demo-mode-banner';

/**
 * Client Layout Wrapper
 *
 * Wraps children with client-side components that need to be present globally
 * Used in server layouts to include client components like DemoModeBanner
 */
export default function ClientLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <DemoModeBanner />
      {children}
    </>
  );
}
