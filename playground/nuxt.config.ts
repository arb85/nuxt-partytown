export default defineNuxtConfig({
  modules: ['@nuxtjs/partytown', '@nuxtseo/module'],
  app: {
    head: {
      script: [{ src: '/test-script.js', type: 'text/partytown' }],
    },
  },
  partytown: {
    //
  },

  experimental: {
    headNext: true,
  },
})
