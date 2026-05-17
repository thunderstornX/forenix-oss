/**
 * Subprocess: yt-dlp — extract metadata from a video/social-media URL
 * without downloading the actual video. Surfaces: uploader, channel,
 * title, description, upload date, view counts, tags, comments
 * (when public).
 * https://github.com/yt-dlp/yt-dlp
 *
 * Install:  pip install -U yt-dlp
 * Usage:    yt-dlp --dump-json --no-download <url>
 */
import { spawnTool } from "../runner";
import type { Tool } from "../types";

const URL_RE = /^https?:\/\/[A-Za-z0-9._\-/:%?#=&+~,]+$/;

export const ytDlpTool: Tool = {
  name: "ytdlp_metadata",
  description:
    "Extract metadata (NOT the media itself) from a video or social- " +
    "media URL: uploader, channel, title, description, upload date, " +
    "view count, tags. Supports YouTube, TikTok, X/Twitter, Vimeo, " +
    "Instagram, and 1000+ other sites.",
  parameters: {
    type: "object",
    properties: {
      url: { type: "string", description: "Video / social-media post URL." },
    },
    required: ["url"],
  },
  kind: "subprocess",
  groups: ["social", "media", "identity"],
  timeoutMs: 60_000,
  maxOutputBytes: 24_000,
  async execute(args) {
    const url = String(args.url ?? "").trim();
    if (!URL_RE.test(url)) throw new Error("invalid url");
    const { exitCode, stdout, stderr } = await spawnTool({
      cmd: "yt-dlp",
      argv: [
        "--dump-single-json",
        "--no-download",
        "--no-playlist",
        "--socket-timeout", "15",
        "--no-warnings",
        url,
      ],
      timeoutMs: 50_000,
      maxBytes: 800_000,
    });
    if (exitCode !== 0 && !stdout) {
      throw new Error(`yt-dlp exit ${exitCode}: ${stderr.slice(0, 200)}`);
    }
    let j: Record<string, unknown> = {};
    try { j = JSON.parse(stdout) as Record<string, unknown>; } catch { /* fallthrough */ }
    // Trim the noisy fields exporters don't need.
    const out = {
      id: j.id,
      title: j.title,
      uploader: j.uploader ?? j.channel,
      uploader_id: j.uploader_id ?? j.channel_id,
      uploader_url: j.uploader_url ?? j.channel_url,
      upload_date: j.upload_date,
      duration: j.duration,
      view_count: j.view_count,
      like_count: j.like_count,
      tags: j.tags,
      description: typeof j.description === "string" ? (j.description as string).slice(0, 600) : undefined,
      webpage_url: j.webpage_url ?? url,
      extractor: j.extractor,
    };
    return out;
  },
};
