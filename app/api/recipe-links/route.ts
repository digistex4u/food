import { q, q1 } from "@/lib/db";
import { handle, ok, str, optStr, ValidationError } from "@/lib/api";
import { parseYouTubeUrl } from "@/lib/nutrition";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Row { recipe_id: string; url: string; title: string }
const toLink = (r: Row) => ({ id: r.recipe_id, url: r.url, title: r.title });

export async function GET() {
  return handle(async () => {
    const rows = await q<Row>(`SELECT recipe_id, url, title FROM recipe_links`);
    return ok(rows.map(toLink));
  });
}

/**
 * Pins a cooking video to a recipe. The URL is parsed and rebuilt rather than
 * stored as typed, so a share link with tracking parameters, a Shorts link or a
 * youtu.be link all end up as the same clean watch URL — and anything that is
 * not YouTube is refused rather than rendered as a link on a printed card.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const b = (await req.json()) as Record<string, unknown>;
    const id = str(b.recipeId, "recipeId", 80);
    const url = parseYouTubeUrl(String(b.url ?? ""));
    if (!url) {
      throw new ValidationError(
        "That does not look like a YouTube link. Paste the address from the video — youtube.com/watch?v=… or a youtu.be/… share link."
      );
    }
    const row = await q1<Row>(
      `INSERT INTO recipe_links (recipe_id, url, title) VALUES ($1,$2,$3)
       ON CONFLICT (recipe_id) DO UPDATE SET url = EXCLUDED.url, title = EXCLUDED.title, updated_at = now()
       RETURNING recipe_id, url, title`,
      [id, url, optStr(b.title, 160)]
    );
    return ok(toLink(row as Row));
  });
}

export async function DELETE(req: Request) {
  return handle(async () => {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) throw new ValidationError("Which recipe's video should be removed?");
    await q1(`DELETE FROM recipe_links WHERE recipe_id = $1`, [id]);
    return ok({ ok: true });
  });
}
