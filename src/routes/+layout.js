/** Client-only: universal store singleton + large bundled JSON */
export const ssr = false;
export const prerender = true;
/** S3/static hosts need `tool/index.html`, not `tool.html`. */
export const trailingSlash = 'always';
