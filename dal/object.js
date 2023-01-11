const simpleGit = require('simple-git')
const fs = require('fs')
const path = require('path')
const matter = require('gray-matter')
const uuid = require('short-uuid')
const ActivityTypes = require('../const/activityTypes.json')

async function createDirIfNotExists(path) {
  try { if(!(fs.statSync(path)).isDirectory()) throw { code: "ENOENT" } }
  catch(err) { if(err.code === "ENOENT") fs.mkdirSync(path, { recursive: true }) }
}

function isObject(obj) {
  return obj === Object(obj);
}

function objectUrl(obj) {
  return isObject(obj) ? obj.id || obj.url : object;
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
    pathname = path.join(process.env.DATA_PATH, pathname)
    pathname += '.html'
    return pathname
  }

  get uuid() {
    this.ensureId()
    const segments = new URL(this.id).pathname.split('/');
    return segments.pop() || segments.pop(); // Handle potential trailing slash
  }

  async write() {
    
    const dir = this.datapath.slice(0, -4 - this.uuid.length)
    await createDirIfNotExists(dir)

    // bto and bcc should not be saved
    const output = Object.assign({}, this)
    delete output.bto
    delete output.bcc
    const body = output.content ? output.content.html || output.content : output.summary || '';
    delete output.content

    const mdContent = matter.stringify(body || '', output, { noRefs: true })
    fs.writeFileSync(this.datapath, mdContent)
  }

  async delete() {
    if(!fs.existsSync(this.datapath)) throw "file does not exist"
    else fs.rmSync(this.datapath)
  }

  async update(newObject) {
    for (const [key, value] of Object.entries(newObject)) {
      this[key] = value
    }
    await this.write()
  }

  static async get(id) {
    if(isObject(id) && id.id) id = id.id
    let datapath = new APObject({ id }).datapath
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