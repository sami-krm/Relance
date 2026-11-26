import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { profil } from "../db/schema";
import { type Profil, profilSchema } from "../shared/schemas";
import { bd, type Contexte, exigerSession } from "./session";

const vide: Profil = { valeurs: {}, partages: [] };

export const routesProfil = new Hono<Contexte>()
	.use(exigerSession)
	.get("/", async (c) => {
		const ligne = await bd(c.env)
			.select({ donnees: profil.donnees })
			.from(profil)
			.where(eq(profil.userId, c.var.userId))
			.get();
		return c.json(ligne?.donnees ?? vide);
	})
	.put("/", async (c) => {
		const r = profilSchema.safeParse(await c.req.json().catch(() => null));
		if (!r.success) {
			const champs = r.error.issues.map((i) => i.path.at(-1));
			return c.json(
				{ message: "Certains champs sont invalides.", champs },
				400,
			);
		}
		const donnees = r.data as Profil;
		await bd(c.env)
			.insert(profil)
			.values({ userId: c.var.userId, donnees })
			.onConflictDoUpdate({
				target: profil.userId,
				set: { donnees, updatedAt: new Date() },
			});
		return c.json(donnees);
	});
