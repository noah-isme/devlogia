type MediaUsageAsset = {
  readonly publicUrl: string;
  readonly path: string;
};

type MediaUsageContent = {
  readonly postCoverUrls: readonly string[];
  readonly postBodies: readonly string[];
  readonly pageBodies: readonly string[];
};

export function isMediaUsedByContent(asset: MediaUsageAsset, content: MediaUsageContent) {
  const bodies = [...content.postBodies, ...content.pageBodies];
  return (
    content.postCoverUrls.includes(asset.publicUrl) ||
    bodies.some((body) => body.includes(asset.publicUrl) || body.includes(asset.path))
  );
}
