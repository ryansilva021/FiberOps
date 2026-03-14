import './globals.css'
import { SessionProvider } from 'next-auth/react'

export const metadata = {
  title: 'FiberOps FTTH',
  description: 'Gestão de rede FTTH',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: 'system-ui, sans-serif' }}>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
