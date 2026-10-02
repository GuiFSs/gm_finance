import { NextRequest } from "next/server";

import { jsonError, parseBody } from "@/shared/lib/api";
import { requireApiSession } from "@/shared/lib/api-auth";
import {
  loadVoiceCommandContext,
  parseVoiceCommandFromAudio,
  parseVoiceCommandFromTranscript,
  parseVoiceRequestSchema,
} from "@/shared/lib/gemini-parse-voice-command";

export async function POST(request: NextRequest) {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);

  if (!process.env.GEMINI_API_KEY?.trim()) {
    return jsonError("GEMINI_API_KEY não configurada no servidor", 503);
  }

  try {
    const body = parseBody(parseVoiceRequestSchema, await request.json());
    const ctx = await loadVoiceCommandContext();

    const data = body.audioBase64
      ? await parseVoiceCommandFromAudio(body.audioBase64, body.mimeType ?? "audio/webm", ctx)
      : await parseVoiceCommandFromTranscript(body.transcript!, ctx);

    return Response.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    if (/GEMINI_API_KEY/i.test(message)) {
      return jsonError(message, 503);
    }
    if (/Gemini|JSON|schema|Áudio/i.test(message)) {
      return jsonError(message, 502);
    }
    return jsonError(message);
  }
}
