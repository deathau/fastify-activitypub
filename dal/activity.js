const fs = require('fs')
const path = require('path')
const matter = require('gray-matter')
const uuid = require('short-uuid')

async function createDirIfNotExists(path) {
  try{
    if(!(fs.statSync(path)).isDirectory()) throw { code: "ENOENT" }
  }
  catch(err) {
    if(err.code === "ENOENT") fs.mkdirSync(path, { recursive: true })
  }
}

function isObject(obj) {
  return obj === Object(obj);
}

function objectUrl(obj) {
  return isObject(obj) ? obj.id || obj.url : object;
}

function activityString(activity, verb, preposition = null, targetProp = 'target') {
  let ret = `${verb}`
  const objectUri = objectUrl(activity.object)
  if(objectUri) ret += ` ${objectUri}`
  if(preposition) {
    const targetUri = objectUrl(activity[targetProp])
    if(targetUri) ret += ` ${preposition} ${targetUri}`
  }
  return ret
}

module.exports = class Activity {
  id
  actor
  object
  type
  published

  static folder = `outbox`
  static path = path.join('.data', Activity.folder)

  constructor(obj = {}) {
    this["@context"] = "https://www.w3.org/ns/activitystreams"
    if(obj) Object.assign(this, obj)
  }

  ensureId() {
    if(!this.id) {
      let date = new Date()
      if(!this.published) this.published = date.toISOString()
      else date = new Date(this.published)

      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const id = uuid.generate()

      this.id = new URL([Activity.folder, year, month, day, id].join('/'), process.env.SERVER_URL).href
    }
  }

  get datapath() {
    let pathname = new URL(this.id).pathname
    if(pathname.endsWith('/')) pathname = pathname.slice(0,-1)
    pathname = path.join(...pathname.split('/'))
    pathname = path.join(process.env.DATA_PATH, pathname)
    pathname += '.md'
    return pathname
  }

  get uuid() {
    if(!this.id) return undefined
    const segments = new URL(this.id).pathname.split('/');
    return segments.pop() || segments.pop(); // Handle potential trailing slash
  }

  async write() {
    
    const dir = this.datapath.slice(0, -4 - this.uuid.length)
    await createDirIfNotExists(dir)

    // bto and bcc should not be saved
    const activityOutput = Object.assign({}, this)
    delete activityOutput.bto
    delete activityOutput.bcc
    const body = activityOutput.content ? activityOutput.content.html || activityOutput.content : activityOutput.summary || '';
    delete activityOutput.content

    const mdContent = matter.stringify(body || '', activityOutput, { noRefs: true })
    fs.writeFileSync(this.datapath, mdContent)
  }

  ensureSummary() {
    if(!this.summary) switch(this.type.toLowerCase()) {
      case 'accept':  this.summary = activityString(this, 'accepted', 'into'); break;
      case 'add':     this.summary = activityString(this, 'added', 'to'); break;
      case 'announce':this.summary = activityString(this, 'ANNOUNCEMENT:'); break;
      case 'arrive':  this.summary = activityString(this, 'arrived', 'at', 'location'); break;
      case 'block':   this.summary = activityString(this, 'blocked'); break;
      case 'create':  this.summary = activityString(this, `created a new ${this.object.type}:`); break;
      case 'delete':  this.summary = activityString(this, 'deleted'); break;
      case 'dislike': this.summary = activityString(this, 'disliked'); break;
      case 'flag':    this.summary = activityString(this, 'flagged'); break;
      case 'follow':  this.summary = activityString(this, 'followed'); break;
      case 'ignore':  this.summary = activityString(this, 'ignored'); break;
      case 'invite':  this.summary = activityString(this, 'invited to', ': '); break;
      case 'join':    this.summary = activityString(this, 'joined'); break;
      case 'leave':   this.summary = activityString(this, 'left'); break;
      case 'like':    this.summary = activityString(this, 'liked'); break;
      case 'listen':  this.summary = activityString(this, 'listened to'); break;
      case 'move':    this.summary = activityString(this, 'moved', 'to'); break;
      case 'offer':   this.summary = activityString(this, 'offered', 'to'); break;
      case 'question':this.summary = `asked a question: "${this.name}" (${this.id})`; break;
      case 'reject':  this.summary = activityString(this, 'rejected'); break;
      case 'read':    this.summary = activityString(this, 'read'); break;
      case 'remove':  this.summary = activityString(this, 'removed', 'from'); break;
      case 'tentativereject':
                      this.summary = activityString(this, 'tentively rejected'); break;
      case 'aentativeaccept':
                      this.summary = activityString(this, 'tentively accepted'); break;
      case 'travel':  this.summary = activityString(this, 'travelled', 'to'); break;
      case 'undo':    this.summary = activityString(this, 'retracted'); break;
      case 'update':  this.summary = activityString(this, 'updated'); break;
      case 'view':    this.summary = activityString(this, 'viewed'); break;
      default:        this.summary = `did a thing: ${this.id}`; break;
    }
  }
}