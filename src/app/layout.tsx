import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ElevateAI — Enterprise Assessment & AI Interview Coaching Platform',
  description: 'AI-Powered Communication & Interview Coaching Platform for Prodapt Enterprise Evaluation featuring 5 Specialist Autonomous Agents.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
