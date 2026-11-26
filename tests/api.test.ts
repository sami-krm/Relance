import { exports } from "cloudflare:workers";
import { expect, it } from "vitest";

it("GET /api/health interroge la base et répond ok", async () => {
	const res = await exports.default.fetch("https://relance.test/api/health");
	expect(res.status).toBe(200);
	expect(await res.json()).toEqual({ status: "ok" });
});
