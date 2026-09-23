/** Warm the two planner route chunks. Recipe rows load only when Meals or Recipes is the likely next step. */
export function prefetchPlannerRoute(path: string) {
  if (isMoreChunk(path)) void import("./ChristmasPlannerMoreModules");
  else void import("./ChristmasPlannerPages");
  if (/\/account\/christmas\/(food|recipes)(?:\/|$)/.test(path)) {
    void import("./food/recipeCatalogQuery").then((mod) => mod.loadPublishedRecipeList());
  }
}

export function prefetchPlannerShell() {
  void import("./ChristmasPlannerPages");
  void import("./ChristmasPlannerMoreModules");
}

function isMoreChunk(path: string) {
  return /\/account\/christmas\/(shopping|food|grocery|recipes|calendar|hosting|home|travel|traditions|cards|wishlist|memories|club|settings)(?:\/|$)/.test(
    path,
  );
}
