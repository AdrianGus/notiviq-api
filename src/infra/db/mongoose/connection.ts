import mongoose from 'mongoose'

export async function connect() {
  const uri = process.env.MONGO_URI!

  await mongoose.connect(uri)

  mongoose.connection.on('connected', () => console.log('[mongo] connected'))
  mongoose.connection.on('error', (e) => console.error('[mongo] error', e))
}