import './config/env.js'
import { createServer } from 'http'
import { app } from './app.js'
import { connect } from './infra/db/mongoose/connection.js'
import { startCrons } from './infra/jobs/cron.js'

const port = Number(process.env.PORT || 3000)

async function main() {
  await connect()

  const server = createServer(app)

  server.listen(port, async () => {
    console.log(`[notiviq] API up on http://localhost:${port}`)

    await startCrons()
  })
}

main().catch((err) => {
  console.error('[notiviq] fatal error', err)
  process.exit(1)
})