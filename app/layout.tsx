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
        <style>{`
          /* Hide Google OAuth button immediately on page load */
          button:has-text("Sign up with Google"),
          button:has-text("Sign in with Google"),
          a:has-text("Sign up with Google"),
          a:has-text("Sign in with Google"),
          [data-testid*="google"],
          [aria-label*="google" i],
          [class*="google" i]:where(button, a),
          button:where([class*="google" i]),
          a:where([class*="google" i]) {
            display: none !important;
            visibility: hidden !important;
            pointer-events: none !important;
          }
        `}</style>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Hide Google OAuth button immediately (before render)
              const hideGoogleButton = () => {
                const buttons = document.querySelectorAll('button, a, [role="button"]');
                buttons.forEach(btn => {
                  const text = btn.textContent || btn.innerText || '';
                  if (text.toLowerCase().includes('google')) {
                    btn.style.display = 'none !important';
                    btn.style.visibility = 'hidden !important';
                    btn.style.pointerEvents = 'none !important';
                  }
                });
              };
              // Run immediately and after DOM changes
              if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', hideGoogleButton);
              } else {
                hideGoogleButton();
              }
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
