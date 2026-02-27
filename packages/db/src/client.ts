import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null

function createDb() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required')
  }
  const sql = postgres(connectionString, { max: 10 })
  return drizzle(sql, { schema })
}

/** Lazily-initialized Drizzle client. Only connects when first accessed. */
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop, receiver) {
    if (!_db) _db = createDb()
    return Reflect.get(_db, prop, receiver)
  },
})

export type Database = ReturnType<typeof drizzle<typeof schema>>
