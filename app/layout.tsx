// app/layout.tsx
import '../styles/globals.css';

export const metadata = {
  title: 'Langrad EMC — AI Chatbot',
  description: 'Lead-gen chatbot for steel fabrication, tanks, silos & civil works.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
