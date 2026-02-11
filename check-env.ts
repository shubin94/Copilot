import "dotenv/config";

const dbUrl = process.env.DATABASE_URL;
let sanitizedUrl = "NOT SET";
if (dbUrl) {
	try {
		sanitizedUrl = new URL(dbUrl).href.replace(/:[^@]+@/g, ":****@");
	} catch (error) {
		console.error("DATABASE_URL parse error:", error);
		sanitizedUrl = "MALFORMED";
	}
}

const supabaseUrl = process.env.SUPABASE_URL;
let sanitizedSupabaseUrl = "NOT SET";
if (supabaseUrl) {
	try {
		sanitizedSupabaseUrl = new URL(supabaseUrl).href.replace(/:[^@]+@/g, ":****@");
	} catch (error) {
		console.error("SUPABASE_URL parse error:", error);
		sanitizedSupabaseUrl = "MALFORMED";
	}
}

console.log("Environment Variables:")
console.log(`DATABASE_URL: ${sanitizedUrl} [REDACTED]`)
console.log(`NODE_ENV: ${process.env.NODE_ENV}`)
console.log(`SUPABASE_URL: ${sanitizedSupabaseUrl} [REDACTED]`)
console.log(`PORT: ${process.env.PORT}`)
process.exit(0)
