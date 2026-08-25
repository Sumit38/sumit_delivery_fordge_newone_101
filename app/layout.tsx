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
              // Hide Google OAuth elements and divider
              window.__hideGoogleButton = function() {
                // Hide Google buttons specifically
                const allElements = document.querySelectorAll('button, a, [role="button"]');
                allElements.forEach(el => {
                  const text = (el.textContent || el.innerText || '').toLowerCase();
                  if (text.includes('sign up with google') || text.includes('sign in with google')) {
                    el.style.setProperty('display', 'none', 'important');
                  }
                });

                // Hide "OR CONTINUE WITH EMAIL" divider by finding it specifically
                const allDivs = document.querySelectorAll('div, span, p');
                allDivs.forEach(el => {
                  const text = (el.textContent || el.innerText || '').trim().toLowerCase();
                  if (text === 'or continue with email' || text === 'or') {
                    // Hide the divider and possibly its parent container
                    el.style.setProperty('display', 'none', 'important');
                    if (el.parentElement) {
                      el.parentElement.style.setProperty('display', 'none', 'important');
                    }
                  }
                });
              };
              // Run on every event
              window.__hideGoogleButton();
              document.addEventListener('DOMContentLoaded', window.__hideGoogleButton);
              window.addEventListener('load', window.__hideGoogleButton);
              document.addEventListener('change', window.__hideGoogleButton);
              // Monitor for any new elements
              const observer = new MutationObserver(() => {
                setTimeout(window.__hideGoogleButton, 0);
              });
              observer.observe(document.body || document.documentElement, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['style', 'class']
              });
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
