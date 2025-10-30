declare module "swagger-ui-dist/swagger-ui-bundle.js" {
  type SwaggerUIBundleOptions = Record<string, unknown>;
  type SwaggerUIBundleReturn = Record<string, unknown>;
  const SwaggerUIBundle: (options: SwaggerUIBundleOptions) => SwaggerUIBundleReturn;
  export default SwaggerUIBundle;
}

declare module "swagger-ui-dist/swagger-ui-standalone-preset.js" {
  type SwaggerUIStandalonePreset = Record<string, unknown>;
  const SwaggerUIStandalonePreset: SwaggerUIStandalonePreset;
  export default SwaggerUIStandalonePreset;
}
