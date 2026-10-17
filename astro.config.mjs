import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://wilsonlisboa.com',
  // Astro 7 defaults to JSX-style whitespace, which can drop spaces between inline elements.
  // Keep the classic HTML compression so the hero renders exactly as before.
  compressHTML: true,
  // The stylesheet is small: inline it, as the single-file hero did, to avoid a render-blocking request.
  build: { inlineStylesheets: 'always' },
});
