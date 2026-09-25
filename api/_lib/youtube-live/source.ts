import { existsSync } from "node:fs";
import { access } from "node:fs/promises";
import { constants } from "node:fs";

import { getServiceClient } from "../christmas/supabaseClient";
import { LONG_FORM_VPS_BUCKET, resolveVpsAbsolutePath } from "../long-form-studio/storage";
import { ffprobeFile } from "../clip-factory/ffmpeg";
import { assertLiveSourceProbe } from "./ffmpegLoop";

export type ResolvedLiveSource = {
  libraryAssetId: string;
  productionId: string;
  title: string;
  path: string;
  probe: Awaited<ReturnType<typeof ffprobeFile>>;
};

export async function resolveLongFormLocalSource(input: {
  libraryAssetId?: string;
  productionId?: string;
}): Promise<ResolvedLiveSource> {
  const service = getServiceClient();
  let libraryAssetId = String(input.libraryAssetId || "").trim();
  let productionId = String(input.productionId || "").trim();
  let title = "TDG Live";

  if (libraryAssetId) {
    const { data, error } = await service.from("library_assets").select("*").eq("id", libraryAssetId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw Object.assign(new Error("Library item not found."), { status: 404 });
    if (String(data.category || data.kind || "") !== "long_form" && String(data.kind || "") !== "long_form") {
      const category = String(data.category || "");
      if (category !== "long_form") {
        throw Object.assign(new Error("YouTube Live is only available for long-form Library items."), { status: 400 });
      }
    }
    title = String(data.title || title);
    productionId =
      productionId ||
      String((data.provenance as { production_id?: string } | null)?.production_id || "");
  }

  if (!productionId) {
    throw Object.assign(new Error("This long-form item is missing its production id."), { status: 400 });
  }

  const { data: production, error } = await service
    .from("long_form_productions")
    .select("id,storage_path,storage_bucket,persist_confirmed,title_suggestions")
    .eq("id", productionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!production?.persist_confirmed || !production.storage_path) {
    throw Object.assign(new Error("The long-form file is not saved on the VPS yet."), { status: 409 });
  }
  const bucket = String(production.storage_bucket || "");
  if (bucket !== LONG_FORM_VPS_BUCKET && bucket !== "vps") {
    throw Object.assign(
      new Error("This long-form file is not on VPS disk. Live streaming will not download it over HTTP."),
      { status: 409 },
    );
  }
  const path = resolveVpsAbsolutePath(String(production.storage_path));
  if (!existsSync(path)) {
    throw Object.assign(new Error("The long-form file is missing from VPS disk."), { status: 404 });
  }
  await access(path, constants.R_OK);
  const probe = await ffprobeFile(path);
  assertLiveSourceProbe(probe, path);
  if (!libraryAssetId) libraryAssetId = productionId;
  const suggested = Array.isArray(production.title_suggestions) ? String(production.title_suggestions[0] || "") : "";
  return {
    libraryAssetId,
    productionId,
    title: title || suggested || "TDG Live",
    path,
    probe,
  };
}
