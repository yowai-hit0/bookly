import { defineConfig } from 'vitepress'

// The documentation site. This round ships the API reference and the developer
// guide; the photographer guide, client help and their French versions are a
// planned follow-up and are intentionally not linked yet, so the dead-link
// check stays green.
export default defineConfig({
  title: 'Bookly',
  description: 'Documentation for the Bookly booking platform.',
  cleanUrls: true,
  lastUpdated: true,
  // The generated spec lives in public/ but is not a page.
  srcExclude: ['**/GLOSSARY.md'],
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Developers', link: '/developers/' },
      { text: 'API', link: '/api/' },
    ],
    sidebar: {
      '/developers/': [
        {
          text: 'Developer guide',
          items: [
            { text: 'Overview', link: '/developers/' },
            { text: 'Architecture', link: '/developers/architecture' },
            { text: 'Local setup', link: '/developers/local-setup' },
            { text: 'Data model', link: '/developers/data-model' },
            { text: 'Booking lifecycle', link: '/developers/booking-lifecycle' },
            { text: 'Payments', link: '/developers/payments' },
            { text: 'Email and the outbox', link: '/developers/email-and-outbox' },
            { text: 'Auth and security', link: '/developers/auth-and-security' },
            { text: 'Testing', link: '/developers/testing' },
          ],
        },
        {
          text: 'API',
          items: [
            { text: 'Reference', link: '/api/' },
            { text: 'Conventions', link: '/api/conventions' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API',
          items: [
            { text: 'Reference', link: '/api/' },
            { text: 'Conventions', link: '/api/conventions' },
          ],
        },
      ],
    },
    search: { provider: 'local' },
    outline: 'deep',
  },
})
