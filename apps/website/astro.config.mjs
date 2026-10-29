// @ts-check
import starlight from '@astrojs/starlight';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import rehypeMermaid from 'rehype-mermaid';

export default defineConfig({
  site: 'https://teamtown.bastianswelt.de',
  // Static output for the classic webhosting (ADR-0025).
  output: 'static',
  vite: { plugins: [tailwindcss()] },
  markdown: {
    // Mermaid diagrams are rendered to inline SVG at build time (decision N-07), so no diagram
    // library (and its EPL-licensed layout engine) is shipped to visitors.
    syntaxHighlight: { type: 'shiki', excludeLangs: ['mermaid'] },
    rehypePlugins: [[rehypeMermaid, { strategy: 'inline-svg', mermaidConfig: { theme: 'neutral' } }]],
  },
  integrations: [
    starlight({
      title: 'TeamTown',
      description: 'Where teams live. Open-source isometric office for team communication.',
      logo: { src: './src/assets/brand/logo-mark.svg' },
      favicon: '/favicon.svg',
      customCss: ['./src/styles/starlight.css'],
      components: { Footer: './src/components/footer.astro' },
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/ehrenberg/teamtown' }],
      sidebar: [
        { label: 'Start', link: '/docs/' },
        { label: 'Product', items: [{ autogenerate: { directory: 'docs/product' } }] },
        { label: 'Architecture', items: [{ autogenerate: { directory: 'docs/architecture' } }] },
        { label: 'Engineering', items: [{ autogenerate: { directory: 'docs/engineering' } }] },
        { label: 'Design', items: [{ autogenerate: { directory: 'docs/design' } }] },
      ],
    }),
  ],
});
