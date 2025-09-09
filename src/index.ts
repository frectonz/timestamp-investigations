import { strict as assert } from "assert";

import { auth } from "@/auth";
import { cookieSetter } from "./cookies";
import { pool } from "./pool";

const testUser = { name: "test", email: "test@test.com", password: "password" };

console.log("[auth] Starting signup test with user:", testUser);

process.env.TZ = "Europe/London";
const user = await auth.api.signUpEmail({
  body: {
    name: testUser.name,
    email: testUser.email,
    password: testUser.password,
  },
  returnHeaders: true
});

console.log("[auth] Signup response:", JSON.stringify(user, null, 2));

assert.equal(user.response.user.name, testUser.name, "User name does not match");
assert.equal(user.response.user.email, testUser.email, "User email does not match");

console.log("Created At", user.response.user.createdAt.toString())

console.log("[auth] Assertions passed ✅ User data is correct");

process.env.TZ = "America/Los_Angeles";
const read = await auth.api.getSession({ headers: cookieSetter(user.headers)! });
console.log(read)


const originalCreatedAt = user.response.user.createdAt;
const newCreatedAt = read?.user.createdAt;

assert.equal(originalCreatedAt, newCreatedAt, "created at doesn't match")

console.log("[db] Starting database truncate…");

await pool.query(`
  DO $$ DECLARE
    r RECORD;
  BEGIN
    -- Disable referential integrity temporarily
    RAISE NOTICE 'Disabling referential integrity…';
    EXECUTE 'SET session_replication_role = replica';
    
    -- Truncate all tables in the public schema
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
      RAISE NOTICE 'Truncating table: %', r.tablename;
      EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
    
    -- Restore integrity checks
    RAISE NOTICE 'Restoring referential integrity…';
    EXECUTE 'SET session_replication_role = DEFAULT';
  END $$;
`);

console.log("[db] Database truncate completed ✅");
