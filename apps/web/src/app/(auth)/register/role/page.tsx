import type { Metadata } from 'next';
import RolePicker from './RolePicker.client';

export const metadata: Metadata = { title: 'Choose Your Role — Smart Shaadi' };

export default function RolePage() {
  return <RolePicker />;
}
