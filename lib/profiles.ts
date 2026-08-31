import { getPool, migrate } from "@/lib/db";

export interface Profile {
  wallet: string;
  role: "team" | "organizer";
  name: string | null;
  organization: string | null;
  location: string | null;
  bio: string | null;
  created_at: Date;
  updated_at: Date;
}

let migrated = false;

async function ensure(): Promise<void> {
  if (!migrated) {
    await migrate();
    migrated = true;
  }
}

export async function getProfile(wallet: string): Promise<Profile | null> {
  await ensure();
  const res = await getPool().query(`SELECT * FROM profiles WHERE wallet = $1`, [
    wallet,
  ]);
  return res.rows[0] ?? null;
}

export async function upsertProfile(p: {
  wallet: string;
  role: string;
  name?: string;
  organization?: string;
  location?: string;
  bio?: string;
}): Promise<Profile> {
  await ensure();
  const res = await getPool().query(
    `INSERT INTO profiles (wallet, role, name, organization, location, bio)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (wallet) DO UPDATE SET
       role = EXCLUDED.role,
       name = EXCLUDED.name,
       organization = EXCLUDED.organization,
       location = EXCLUDED.location,
       bio = EXCLUDED.bio,
       updated_at = now()
     RETURNING *`,
    [
      p.wallet,
      p.role === "organizer" ? "organizer" : "team",
      p.name?.trim() || null,
      p.organization?.trim() || null,
      p.location?.trim() || null,
      p.bio?.trim() || null,
    ],
  );
  return res.rows[0];
}
