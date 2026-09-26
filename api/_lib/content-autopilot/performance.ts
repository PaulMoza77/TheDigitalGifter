import { getServiceClient } from "../christmas/supabaseClient";

export async function refreshConceptPerformance(): Promise<void> {
  const service = getServiceClient();
  const { data: concepts } = await service
    .from("content_concepts")
    .select("id,library_asset_id,publication_count,performance_summary")
    .not("library_asset_id", "is", null);
  for (const concept of concepts || []) {
    const assetId = String(concept.library_asset_id || "");
    if (!assetId) continue;
    const { data: publications } = await service
      .from("publisher_publications")
      .select("id,status")
      .eq("library_asset_id", assetId);
    const publicationIds = (publications || []).map((row) => String(row.id));
    let publishedTargets = 0;
    const platforms: Record<string, number> = {};
    if (publicationIds.length) {
      const { data: targets } = await service
        .from("social_publication_targets")
        .select("platform,status,published_at")
        .in("publisher_publication_id", publicationIds);
      for (const target of targets || []) {
        if (String(target.status || "") !== "published") continue;
        publishedTargets += 1;
        const platform = String(target.platform || "unknown");
        platforms[platform] = (platforms[platform] || 0) + 1;
      }
    }
    const publicationCount = publicationIds.length;
    const summary = {
      platforms,
      published_targets: publishedTargets,
      note: "Post-level views/engagement are not stored in TDG yet; counts reflect publisher + social publish outcomes only.",
    };
    if (
      publicationCount === Number(concept.publication_count || 0) &&
      JSON.stringify(summary.platforms) === JSON.stringify((concept.performance_summary as { platforms?: unknown })?.platforms || {})
    ) {
      continue;
    }
    await service
      .from("content_concepts")
      .update({
        publication_count: publicationCount,
        performance_summary: summary,
        updated_at: new Date().toISOString(),
      })
      .eq("id", concept.id);
  }
}
