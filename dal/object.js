const git = require("isomorphic-git");
const http = require("isomorphic-git/http/node");
const path = require('path').posix
const matter = require('gray-matter')
const uuid = require('short-uuid')
const ActivityTypes = require('../const/activityTypes.json')

async function createDirIfNotExists(fs, path) {
  try { if(!(fs.statSync(path)).isDirectory()) throw { code: "ENOENT" } }
  catch(err) { if(err.code === "ENOENT") fs.mkdirSync(path, { recursive: true }) }
}

function isString(myVar) {
  return typeof myVar === 'string' || myVar instanceof String
}

module.exports = class APObject {

  constructor(obj = {}) {
    this["@context"] = "https://www.w3.org/ns/activitystreams"
    if(obj) Object.assign(this, obj)
  }

  ensureType() {
    if(!this.type) throw "Object requires type"
  }

  get isActivity() {
    return this.type && ActivityTypes.some(type => type.toLowerCase() == this.type.toLowerCase())
  }

  ensureId() {
    if(!this.id) {
      this.ensureType()
      let date = new Date()
      if(!this.published) this.published = date.toISOString()
      else date = new Date(this.published)

      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const id = uuid.generate()

      const baseFolder = this.isActivity ? 'outbox' : this.type

      this.id = new URL([baseFolder, year, month, day, id].join('/'), process.env.SERVER_URL).href
    }
  }

  get datapath() {
    this.ensureId()
    let pathname = new URL(this.id, process.env.SERVER_URL).pathname
    if(pathname.endsWith('/')) pathname = pathname.slice(0,-1)
    pathname = path.join(...pathname.split('/'))
    pathname = path.join(process.env.DATA_PATH, pathname)
    pathname += '.md'
    return pathname
  }

  get htmlpath() {
    this.ensureId()
    let pathname = new URL(this.id, process.env.SERVER_URL).pathname
    if(pathname.endsWith('/')) pathname = pathname.slice(0,-1)
    pathname = path.join(...pathname.split('/'))
    pathname = path.join(process.env.STATIC_PATH, pathname)
    pathname += '/index.html'
    return pathname
  }

  get uuid() {
    this.ensureId()
    const segments = new URL(this.id).pathname.split('/');
    return segments.pop() || segments.pop(); // Handle potential trailing slash
  }

  async write(fs) {
    
    const dir = path.join(process.env.rootdir, path.dirname(this.datapath))
    await createDirIfNotExists(fs, dir)

    // bto and bcc should not be saved
    const output = Object.assign({}, this)
    delete output.bto
    delete output.bcc
    const body = output.content ? output.content.html || output.content : output.summary || '';
    delete output.content

    const mdContent = matter.stringify(body || '', output, { noRefs: true })
    fs.writeFileSync(path.join(process.env.rootdir, this.datapath), mdContent)
    await git.add({ fs, dir: process.env.rootdir, filepath: this.datapath })
  }

  async delete(fs) {
    if(!fs.existsSync(path.join(process.env.rootdir, this.datapath))) throw "file does not exist"
    else fs.rmSync(path.join(process.env.rootdir, this.datapath))
  }

  async update(newObject, fs) {
    for (const [key, value] of Object.entries(newObject)) {
      this[key] = value
    }
    await this.write(fs)
  }

  async commit(fs) {
    this.ensureId()
    await git.commit({
      fs,
      dir: process.env.rootdir,
      author: { name: 'commit-bot', email: 'commit-bot@death.id.au' },
      message: `${this.id}\n${this.summary || ''}` 
    })
  }

  async commitAndPush(fs) {
    await this.commit(fs)

    let commits = await git.log({
      fs,
      dir: process.env.rootdir,
      depth: 5,
      ref: 'main'
    })

    const pushResult = await git.push({
      fs,
      http,
      dir: process.env.rootdir,
      remote: 'origin',
      ref: 'main',
    })
  }

  static async get(id, fs) {
    let obj = isString(id) ? new APObject({ id }) : new APObject(id)
    obj.ensureId()
    let datapath = path.join(process.env.rootdir, obj.datapath)
    try{
      if(fs.existsSync(datapath)) {
        const file = matter(fs.readFileSync(datapath))
        if(!file.isEmpty) {
          if(!file.data.summary || file.data.summary != file.content){
            file.data.content = file.content
          }

          return new APObject(file.data)
        }
      }
    }
    catch {}
    return null
  }
}