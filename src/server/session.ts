import { drizzle } from "drizzle-orm/d1";
import { createMiddleware } from "hono/factory";
import * as schema from "../db/schema";
import { auth } from "./auth";

export type Contexte = { Bindings: Env; Variables: { userId: string } };

export const exigerSession = createMiddleware<Contexte>(async (c, next) => {
	const session = await auth.api.getSession({ headers: c.req.raw.headers });
	if (!session) return c.json({ message: "Connexion requise." }, 401);
	c.set("userId", session.user.id);
	await next();
});

export const bd = (env: Env) => drizzle(env.DB, { schema });
