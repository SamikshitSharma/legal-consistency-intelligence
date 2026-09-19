import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Legal Consistency & Change Intelligence | AI Reasoning Engine v1.2.2',
  description:
    'Production-quality cross-document legal reasoning and change intelligence workspace. Detects material modifications, additions, verified removals, apparent conflicts, and grounded deadlines across related legal agreements.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
