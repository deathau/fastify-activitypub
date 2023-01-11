const fs = require('fs')
const IndieAuth = require('indieauth-helper')
const { mf2 } = require("microformats-parser");

const ACTOR_FILE = './.data/actor.json'

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

  async read() {
    Object.assign(this, await Actor.ReadActor())
    return this
  }

  async write() {
    return await Actor.WriteActor(this)
  }

  static async ReadActor() {
    try{
      const data = fs.readFileSync(ACTOR_FILE, 'utf8')
      return new Actor(JSON.parse(data))
    }
    catch(err) {
      return new Actor()
    }
  }

  static async WriteActor(actor) {
    if(actor.auth?.secret) delete actor.auth.secret // just in case
    fs.writeFileSync(ACTOR_FILE, JSON.stringify(actor, null, 2))
  }
}