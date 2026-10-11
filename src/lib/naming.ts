export async function nameGeneration(
  prompt: string,
  existingLabels: string[],
): Promise<string | null> {
  try {
    const response = await fetch("/api/name", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, existingLabels }),
    });
    if (!response.ok) return null;

    const { name } = (await response.json()) as { name?: string };
    return name?.trim() || null;
  } catch {
    return null;
  }
}
