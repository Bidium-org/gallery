import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import './fonts.css'
import './globals.css'

import { createRoot } from 'react-dom/client'

import { Canvas } from '@/components/canvas'
import { Toaster } from '@/components/ui/sonner'
import { startAgentRelay } from '@/lib/agent-relay'

startAgentRelay()

createRoot(document.getElementById('root')!).render(
  <>
    <main className="h-screen w-screen bg-neutral-950">
      <Canvas />
    </main>
    <Toaster position="top-center" theme="dark" />
  </>,
)
