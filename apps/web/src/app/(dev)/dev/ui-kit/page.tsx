import { notFound } from 'next/navigation';
import { UIKitClient } from './UIKitClient.client';

export const dynamic = 'force-static';

export default function UIKitPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <UIKitClient />;
}
