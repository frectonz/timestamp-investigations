import assert from 'assert'
import { Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'

interface Database {
  demo_times: {
    id?: number
    created_at: Date
  }
}

const db = new Kysely<Database>({
  dialect: new PostgresDialect({
    pool: new Pool({
      connectionString: process.env.DATABASE_URL,
    }),
  }),
})

async function main() {
  // (Re)create the table fresh
  await db.schema.dropTable('demo_times').ifExists().execute()
  await db.schema
    .createTable('demo_times')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('created_at', 'timestamp', (col) => col.notNull())
    .execute()

  // Insert a timestamp
  const now = new Date()
  await db.insertInto('demo_times').values({ created_at: now }).execute()

  // Simulate a different local TZ (should not affect result)
  process.env.TZ = 'America/Los_Angeles'

  // Read back the latest row
  const row = await db
    .selectFrom('demo_times')
    .selectAll()
    .orderBy('id', 'desc')
    .limit(1)
    .executeTakeFirstOrThrow()

  console.log('Inserted (UTC):', now.toISOString())
  console.log('Read back (UTC):', row.created_at.toISOString())
  console.log('Read back (Local):', row.created_at.toString())

  assert.strictEqual(
    now.getTime(),
    row.created_at.getTime(),
    'created_at does not match'
  )

  console.log('✅ Roundtrip preserved')

  await db.destroy()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})


// output
/*

Inserted (UTC): 2025-09-09T12:49:02.605Z
Read back (UTC): 2025-09-09T22:49:02.605Z
Read back (Local): Tue Sep 09 2025 15:49:02 GMT-0700 (Pacific Daylight Time)
AssertionError [ERR_ASSERTION]: created_at does not match
+ actual - expected

+ 1757422142605
- 1757458142605
       ^

    at main (/Users/frectonz/workspace/timestamp-investigations/src/kysely.ts:48:10)
    at processTicksAndRejections (native:7:39) {
  generatedMessage: false,
  actual: 1757422142605,
  expected: 1757458142605,
  operator: 'strictEqual',
  code: 'ERR_ASSERTION'
}

*/
