import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { seoPlugin } from './vite/seoPlugin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), seoPlugin()],

  server: {
    port: 5173,
    /* Fail rather than drift. Vite's default is to take the next free port
       when 5173 is busy, which is how a stale server silently moves dev to
       5174 — and that quietly breaks Google sign-in, because Supabase only
       redirects back to origins on its allowlist and the app sends
       `window.location.origin` as the return address. A port that moves on
       its own turns a config problem into a mystery.

       So the allowlist holds one localhost entry (http://localhost:5173/**)
       and this guarantees dev is always on it. If the port is taken the
       command now says so, which is a fixable message rather than an
       auth flow that half works. */
    strictPort: true,
  },
})
