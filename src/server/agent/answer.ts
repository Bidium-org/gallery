export const succeed = (result: unknown) => Response.json({ ok: true, result });

export const fail = (error: string, message: string, status: number) =>
  Response.json({ ok: false, error, message }, { status });
