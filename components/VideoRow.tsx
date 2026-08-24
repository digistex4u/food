"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { api, jsonBody, type RecipeLink } from "@/lib/client";
import { youtubeSearchUrl } from "@/lib/nutrition";

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
);
const SearchIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M10 2a8 8 0 105.3 14l5.4 5.4 1.4-1.4-5.4-5.4A8 8 0 0010 2zm0 2a6 6 0 110 12 6 6 0 010-12z" />
  </svg>
);

/** Renders a QR for the printed card. Generated in the browser so nothing is
 *  fetched from an external image service — the CSP on a printed page is the
 *  least of it, but a card that only works online is a card that fails in a
 *  kitchen. */
function Qr({ url, label }: { url: string; label: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let live = true;
    QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M" })
      .then((s) => { if (live) setSvg(s); })
      .catch(() => { if (live) setSvg(""); });
    return () => { live = false; };
  }, [url]);

  if (!svg) return null;
  return (
    <div className="qr">
      <div dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="qr-cap">
        <b>{label}</b>
        Scan to watch on your phone
        <span>{url}</span>
      </div>
    </div>
  );
}

export default function VideoRow({
  recipeId, nameEn, nameHi, link, onChange, say,
}: {
  recipeId: string;
  nameEn: string;
  nameHi?: string;
  link?: RecipeLink;
  onChange: (next: RecipeLink | null, id: string) => void;
  say: (m: string, bad?: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  const searchUrl = youtubeSearchUrl(nameEn, nameHi);
  const effective = link?.url ?? searchUrl;

  const save = async () => {
    setBusy(true);
    try {
      const saved = await api<RecipeLink>("/api/recipe-links", jsonBody({
        recipeId, url: value, title: "",
      }));
      onChange(saved, recipeId);
      setEditing(false);
      setValue("");
      say(`Video pinned to ${nameEn}`);
    } catch (e) {
      say(e instanceof Error ? e.message : "Could not save that link.", true);
    } finally { setBusy(false); }
  };

  const remove = async () => {
    try {
      await api(`/api/recipe-links?id=${encodeURIComponent(recipeId)}`, { method: "DELETE" });
      onChange(null, recipeId);
      say("Video unpinned");
    } catch (e) {
      say(e instanceof Error ? e.message : "Could not remove it.", true);
    }
  };

  return (
    <>
      <div className="vid-row no-print">
        {link ? (
          <>
            <a className="vid-link" href={link.url} target="_blank" rel="noopener noreferrer">
              <PlayIcon />
              <span className="vl-t">Watch this recipe</span>
            </a>
            <button className="btn btn-sm btn-ghost" onClick={() => { setEditing(!editing); setValue(link.url); }}>
              Change
            </button>
            <button className="btn btn-sm btn-ghost" onClick={remove}>Remove</button>
          </>
        ) : (
          <>
            <a className="vid-search" href={searchUrl} target="_blank" rel="noopener noreferrer">
              <SearchIcon />
              Find on YouTube
            </a>
            {!editing && (
              <button className="btn btn-sm btn-ghost" onClick={() => setEditing(true)}>
                Pin a video
              </button>
            )}
            {!editing && (
              <span className="vid-hint">
                Searches <span className="hi">{nameHi ? `${nameHi} रेसिपी` : `${nameEn} recipe`}</span>
              </span>
            )}
          </>
        )}

        {editing && (
          <div className="vid-form">
            <input
              type="url" placeholder="Paste the YouTube link…" value={value} autoFocus
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void save(); if (e.key === "Escape") setEditing(false); }}
            />
            <button className="btn btn-sm btn-primary" onClick={save} disabled={busy || !value.trim()}>
              {busy ? "Saving…" : "Save"}
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        )}
      </div>

      <Qr url={effective} label={link ? `${nameEn} — video` : `${nameEn} — find the video`} />
    </>
  );
}
