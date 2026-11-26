export async function api<T = unknown>(
	chemin: string,
	init?: RequestInit,
): Promise<T> {
	const res = await fetch(`/api${chemin}`, init);
	if (!res.ok) {
		const corps = (await res.json().catch(() => null)) as {
			message?: string;
			champs?: string[];
		} | null;
		throw Object.assign(new Error(corps?.message ?? `Erreur ${res.status}`), {
			champs: corps?.champs ?? [],
		});
	}
	return (res.status === 204 ? undefined : await res.json()) as T;
}

export const json = (method: string, corps: unknown): RequestInit => ({
	method,
	headers: { "content-type": "application/json" },
	body: JSON.stringify(corps),
});
