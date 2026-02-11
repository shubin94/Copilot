// API endpoint to check if email or phone is already taken
// Usage: /api/check-unique?email=...&phone=...
import { NextApiRequest, NextApiResponse } from "next";
import { db } from "../../server/db/index";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { email, phone } = req.query;
  if (!email && !phone) {
    return res.status(400).json({ error: "Email or phone required" });
  }
  let emailExists = false;
  let phoneExists = false;
  if (email) {
    const user = await db.users.findFirst({ where: { email: String(email).toLowerCase() } });
    emailExists = !!user;
  }
  if (phone) {
    const detective = await db.detectives.findFirst({ where: { phone: String(phone) } });
    phoneExists = !!detective;
  }
  res.json({ emailExists, phoneExists });
}
