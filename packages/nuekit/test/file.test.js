
import { join, parse } from 'node:path'
import { createSite } from '../src/site'
import { testDir, write, removeAll, writeAll } from './test-utils'
import { createFile, getFileInfo, getURL, getSlug } from '../src/file'


test('url property', () => {
  function testURL(path, expected) {
    expect(getURL(parse(path))).toBe(expected)
  }
  testURL('index.md', '/')
  testURL('index.css', '/index.css')
  testURL('blog/entry.md', '/blog/entry')
  testURL('app/index.html', '/app/')
  testURL('blog/table.html', '/blog/table')
  testURL('docs/installation.md', '/docs/installation')
  testURL('@shared/design/base.css', '/@shared/design/base.css')
  testURL('site.yaml', '/site.yaml')
})

test('slug property', () => {
  expect(getSlug(parse('blog/entry.md'))).toBe('entry')
  expect(getSlug(parse('blog/index.html'))).toBe('')
})

test('getFileInfo', () => {
  const info = getFileInfo('blog/table.html')
    expect(info).toEqual({
    dir: "blog",
    base: "table.html",
    ext: ".html",
    name: "table",
    path: "blog/table.html",
    slug: "table.html",
    type: "html",
    url: "/blog/table",
    is_html: true,
  })
})

test('createFile', async () => {
  const path = await write('@shared/model/index.ts', '// hello')
  const file = await createFile(testDir, path)

  expect(file).toMatchObject({
    rootpath: 'test_dir/@shared/model/index.ts',
    path: '@shared/model/index.ts',
    dir: '@shared/model',
    basedir: '@shared',
    base: 'index.ts',
    name: 'index',
    is_ts: true,
    ext: '.ts',
  })

  expect(file.mtime).toBeInstanceOf(Date)
  expect(await file.text()).toBe('// hello')

  // copy operation
  await file.copy(join(testDir, '.dist'))
  expect(await Bun.file(join(testDir, '.dist', file.path)).exists()).toBeTrue()

  await removeAll()
})

const CONF_WITH_BASE = {
  root: testDir,
  is_prod: true,
  dist: join(testDir, '.dist'),
  base: '/blog',
  site: { origin: 'https://example.com', base: '/blog' },
  collections: { posts: { include: ['posts/'] } }
}

describe('basepath', () => {
  beforeEach(async () => {
    await writeAll([
      ['index.md', '# Home'],
      ['posts/hello.md', '# Hello World'],
      ['style.css', 'body { color: red; }'],
      ['app.js', 'console.log("test")'],
    ])
  })

  afterEach(async () => await removeAll())

  test('URLs include base path', async () => {
    const site = await createSite(CONF_WITH_BASE)
    expect(site.get('index.md').url).toBe('/blog/')
    expect(site.get('posts/hello.md').url).toBe('/blog/posts/hello')
  })

  test('rendered HTML links include base path', async () => {
    const site = await createSite({ ...CONF_WITH_BASE, is_prod: false })
    const html = await site.get('index.md').render()
    expect(html).toInclude('href="/blog/style.css"')
    expect(html).toInclude('src="/blog/app.js"')
  })
})
