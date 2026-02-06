import "dotenv/config";

console.log("Environment Variables:")
console.log(`DATABASE_URL: ${process.env.DATABASE_URL}`)
console.log(`NODE_ENV: ${process.env.NODE_ENV}`)
console.log(`SUPABASE_URL: ${process.env.SUPABASE_URL}`)
console.log(`PORT: ${process.env.PORT}`)
process.exit(0)
