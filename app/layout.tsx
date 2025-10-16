import type React from "react"
import type { Metadata } from "next"
import { Inter, IBM_Plex_Mono, Newsreader } from "next/font/google"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-plex-mono",
})
const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
})

export const metadata: Metadata = {
  title: "Orbitday",
  description: "An orbit-style, minimalist day planner",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${plexMono.variable} ${newsreader.variable} dark antialiased`}>
      <body className="font-sans">{children}</body>
    </html>
  )
}
