import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DeliveryForge",
  description: "AI-powered delivery planning platform using McCabe's Cyclomatic Complexity analysis",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Hide Google OAuth button if it appears
              const hideGoogleButton = () => {
                const buttons = document.querySelectorAll('button, a');
                buttons.forEach(btn => {
                  if (btn.textContent.includes('Google') || btn.textContent.includes('google')) {
                    btn.style.display = 'none';
                  }
                });
              };
              // Run on load and after mutations
              window.addEventListener('load', hideGoogleButton);
              document.addEventListener('DOMContentLoaded', hideGoogleButton);
              const observer = new MutationObserver(hideGoogleButton);
              observer.observe(document.body, { childList: true, subtree: true });
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
