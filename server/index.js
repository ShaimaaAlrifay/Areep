import cors from 'cors'
import express from 'express'
import { discoveryRouter } from './routes/discovery.js'
import { prdRouter } from './routes/prd.js'

const app = express()
app.use(cors())
app.use(express.json())

app.use('/api', discoveryRouter)
app.use('/api', prdRouter)

// Local dev only — a real deploy would assign this via $PORT the same
// way the sibling portfolio's server.js does, but areep/server/.env
// already pins PORT=3002 for this project.
const PORT = process.env.PORT || 3002
app.listen(PORT, () => {
  console.log(`Areep discovery backend listening on port ${PORT}`)
})
