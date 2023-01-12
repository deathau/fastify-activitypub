const IndieAuth = require('indieauth-helper')
const { mf2 } = require("microformats-parser");
const git = require("isomorphic-git");
const http = require("isomorphic-git/http/node");
const path = require('path').posix

module.exports = class Actor {

  constructor(obj = null) {
    Object.assign(this, obj || { id: process.env.ME })
  }

  async populateDetails() {
    if(!this.id) throw "id is required"

    const auth = new IndieAuth()

    const url = auth.getCanonicalUrl(this.id)
    const { response: res, url: finalUrl } = await auth.getUrlWithRedirects(url)
    this.id = this.auth.me = finalUrl

    // Get microformat data
    const parsed = mf2(res.data, {baseUrl: finalUrl});

    this.aliases = [finalUrl, ...parsed.rels.me]

    const hCard = parsed.items.find(i => i.type.some(t => t == 'h-card')).properties
    if(hCard.name.length > 0) this.name = hCard.name[0]
    if(hCard.nickname.length > 0) this.preferredUsername = hCard.nickname[0]
    if(hCard.note.length > 0) this.summary = hCard.note[0]
    if(hCard.photo.length > 0) this.icon = {
      name: hCard.photo[0].alt,
      url: hCard.photo[0].value,
      type: "Image"
    }
    if(hCard.featured.length > 0) this.image = [{
      name: hCard.featured[0].alt,
      url: hCard.featured[0].value,
      type: "Image"
    }, this.icon]
    this.url = hCard.url
    this.type = "Person"

    return this
  }

  async read(fs) {
    Object.assign(this, await Actor.ReadActor(fs))
    return this
  }

  async write(fs) {
    return await Actor.WriteActor(this, fs)
  }

  static get path() {
    return path.join(process.env.rootdir, process.env.DATA_PATH, 'actor.json')
  }

  static async ReadActor(fs) {
    try{
      const data = fs.readFileSync(Actor.path, 'utf8')
      return new Actor(JSON.parse(data))
    }
    catch(err) {
      return new Actor()
    }
  }

  static async WriteActor(actor, fs) {
    if(actor.auth?.secret) delete actor.auth.secret // just in case
    fs.writeFileSync(Actor.path, JSON.stringify(actor, null, 2))
    await git.add({ fs, dir: process.env.rootdir, filepath: path.relative(process.env.rootdir, Actor.path) })
    Actor.commitAndPush(fs)
  }

  static async commit(fs) {
    await git.commit({
      fs,
      dir: process.env.rootdir,
      author: { name: 'commit-bot', email: 'commit-bot@death.id.au' },
      message: `updated actor information on login` 
    })
  }

  static async commitAndPush(fs) {
    await Actor.commit(fs)

    await git.push({
      fs,
      http,
      dir: process.env.rootdir,
      remote: 'origin',
      ref: 'main',
    })
  }
}