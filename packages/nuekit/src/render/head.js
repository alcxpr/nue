
import { parse, sep } from 'node:path'

import { elem } from 'nuemark'
import { version } from '../system'
import { minifyCSS } from '../tools/css'

export async function renderHead({ conf, data, assets, libs=[] }) {
  const { title, favicon } = data
  const head = []

  if (title) head.push(elem('title', renderTitle(title, data.title_template)))

  if (favicon) {
    const href = conf.base && favicon.startsWith('/') ? `${conf.base}${favicon}` : favicon
    head.push(elem('link', { rel: 'icon', href }))
  }

  // meta
  head.push(...renderMeta(data, libs))

  // @layers
  const layers = conf.design?.layers
  if (layers) head.push(elem('style', `@layer ${layers.join(', ')}`))

  // styles
  head.push(...await renderStyles(assets, conf))

  // system scripts
  const addJS = name => assets.push(parse(`@nue/${name}.js`))
  if (conf.site?.view_transitions) addJS('transitions')
  if (libs.length) addJS('mount')
  if (!conf.is_prod) addJS('hmr')


  // all scripts
  const scripts = renderScripts(assets, conf.base)

  if (scripts.length || libs.length) {
    head.push(importMap(conf.import_map))
    head.push(...scripts)
  }

  // RSS feed
  if (conf.rss?.enabled) {
    const { title } = conf.rss
    const href = conf.base ? `${conf.base}/feed.xml` : '/feed.xml'
    const link = elem('link', { rel: 'alternate', type: 'application/rss+xml', title, href })
    head.push(link)
  }

  return head
}

export function renderMeta(data, libs) {
  const desc = data.desc || data.description

  const props = {
    viewport: 'width=device-width,initial-scale=1',
    'article:published_time': data.date || data.pubDate,
    generator: `Nue v${version} (nuejs.org)`,
    'date.updated': new Date().toISOString().slice(0, 16) + 'Z',

    'og:title': renderTitle(data.title, data.title_template),
    'og:description': desc,
    'og:image': ogImage(data),
    libs: libs?.join(' '),

    description: desc,
    'theme-color': '',
    author: '',
    robots: '',
  }

  const meta = [elem('meta', { charset: 'utf-8'})]

  Object.entries(props).map(([key, val]) => {
    const content = data[key] || val
    if (content && data[key] !== false) meta.push(elem('meta', { name: key, content }))
  })

  return meta
}

function renderTitle(title, template) {
  const str = template ? template.replace('%s', title) : title

  // Strip Markdown formatting (bold only for now)
  return str?.replaceAll('**', '')
}

export function renderScripts(assets, base = '') {
  const scripts = assets.filter(f => ['.js', '.ts'].includes(f.ext) && f.dir != `@shared${sep}data`)
  return scripts.map(s => {
    const dir = s.dir ? `/${s.dir}` : '' // if dir happened to be empty
    const src = `${dir}/${s.name}.js`
    return elem('script', { src: base ? `${base}${src}` : src, type: 'module' })
  })
}

export async function renderStyles(assets, conf={}) {
  const { inline_css } = conf?.design || {}
  const { base = '' } = conf
  const css_files = assets.filter(file => file.is_css)

  if (conf.is_prod && inline_css) {
    const css = await inlineCSS(css_files)
    return [ elem('style', css) ]
  }

  return css_files.map(file => {
    const href = `/${file.path}`
    return elem('link', { rel: 'stylesheet', href: base ? `${base}${href}` : href })
  })
}

export async function inlineCSS(assets, minify=true) {
  const css_files = assets.filter(el => el.is_css)
  if (!css_files.length) return ''

  const css = await Promise.all(css_files.map(file => file.text()))
  const str = css.join('\n').trim()
  return minifyCSS(str)
}


function importMap(imports) {
  return !Object.keys(imports || {})[0] ? ''
    : elem('script', { type: 'importmap' }, JSON.stringify({ imports }))
}

function ogImage(data) {
  const og = data.og_image || data.og
  const { origin='', base='' } = data

  if (og) {
    const img = og[0] == '/' ? og : `/${data.dir}/${og}`
    const path = base && img.startsWith('/') ? `${base}${img}` : img
    return (data.is_prod ? origin : '') + path
  }
}
