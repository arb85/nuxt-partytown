import { join } from 'path'
import { promises as fsp } from 'fs'
import { genObjectFromRawEntries } from 'knitwork'
import serveStatic from 'serve-static'
import { defineNuxtModule, isNuxt2 } from '@nuxt/kit'
import type { PartytownConfig } from '@builder.io/partytown/integration'
import { copyLibFiles, libDirPath } from '@builder.io/partytown/utils'

type ExcludeFrom<G extends Record<string, any>, K> = Pick<
  G,
  {
    [P in keyof G]: NonNullable<G[P]> extends K ? never : P
  }[keyof G]
>

export interface ModuleOptions extends ExcludeFrom<PartytownConfig, Function> {
  /**
   * When `true`, Partytown scripts are not minified. See the
   * [Debugging docs](https://partytown.builder.io/debugging) on how to enable more logging.
   *
   * @default true in development
   */
  debug: boolean
  /**
   * Path where the Partytown library can be found your server. Note that the path must both start
   * and end with a `/` character, and the files must be hosted from the same origin as the webpage.
   *
   * @default '/~partytown/'
   */
  lib: string
  /**
   * Hook that is called to resolve URLs which can be used to modify URLs. The hook uses the API:
   * `resolveUrl(url: URL, location: URL, method: string)`. See
   * [Proxying Requests](https://partytown.builder.io/proxying-requests) for more information.
   *
   * This should be provided as a string, which will be inlined into a `<script>` tag.
   */
  resolveUrl?: string
  get?: string
  set?: string
  apply?: string
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: '@nuxtjs/partytown',
    configKey: 'partytown',
    compatibility: {
      bridge: true,
    },
  },
  defaults: nuxt => ({
    debug: nuxt.options.dev,
    forward: [],
    lib: '/~partytown/',
  }),
  async setup(options, nuxt) {
    // Normalize partytown configuration
    const fns = ['resolveUrl', 'get', 'set', 'apply']
    const rawConfig = Object.entries(options).map(
      ([key, value]) => [key, fns.includes(key) ? value : JSON.stringify(value)] as [string, string]
    )
    const renderedConfig = genObjectFromRawEntries(rawConfig).replace(/\s*\n\s*/g, ' ')

    // Add partytown snippets to document head
    const partytownSnippet = await fsp.readFile(join(libDirPath(), 'partytown.js'), 'utf-8')
    if (isNuxt2()) {
      // Use vue-meta syntax to inject scripts
      nuxt.options.head = nuxt.options.head || {}
      nuxt.options.head.__dangerouslyDisableSanitizersByTagID =
        nuxt.options.head.__dangerouslyDisableSanitizersByTagID || {}
      nuxt.options.head.__dangerouslyDisableSanitizersByTagID.partytown = ['innerHTML']
      nuxt.options.head.__dangerouslyDisableSanitizersByTagID['partytown-config'] = ['innerHTML']
      nuxt.options.head.script.unshift(
        { hid: 'partytown-config', innerHTML: `partytown = ${renderedConfig}` },
        { hid: 'partytown', innerHTML: partytownSnippet }
      )
    } else {
      // Use @vueuse/head syntax to inject scripts
      nuxt.options.meta.script = nuxt.options.meta.script || []
      nuxt.options.meta.script.unshift(
        { children: `partytown = ${renderedConfig}` },
        { children: partytownSnippet }
      )
    }

    if (nuxt.options.dev) {
      // Serve the partytown library directly from node_modules in development
      nuxt.options.serverMiddleware.push({
        path: options.lib,
        handler: serveStatic(libDirPath()),
      })
    } else {
      // Copy partytown directory into .output/public in production build
      nuxt.hook('nitro:generate', async ctx => {
        await copyLibFiles(join(ctx.output.publicDir, options.lib), { debugDir: options.debug })
      })
    }
  },
})
