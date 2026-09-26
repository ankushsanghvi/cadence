import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ElevateAI — Multi-Agent Communication & Interview Coaching Platform',
  description: 'AI-powered Communication & Interview Coaching System featuring 5 specialist agents, STAR evaluation, speech heuristics, and automated benchmark scoring.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen text-slate-100 selection:bg-blue-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
