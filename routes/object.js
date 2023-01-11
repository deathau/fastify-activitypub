'use strict'

const path = require('path')
const Activity = require('../dal/activity')
const APObject = require('../dal/object')

module.exports = async function (fastify, opts) {
  // add a content type parser for activitystreams compatible json, but just parse it as json for now (don't bother with the JSON-LD stuff yet)
  fastify.addContentTypeParser(['application/ld+json; profile="https://www.w3.org/ns/activitystreams"', 'application/activity+json'], { parseAs: 'string' }, fastify.getDefaultJsonParser('ignore', 'ignore'));

  fastify.get('/:type/:y/:m/:d/:file', { }, async function (request, reply) {
    const id = request.url
    const obj = await APObject.get(id)
    if(!obj) reply.code(404)
    if(request.headers["content-type"] && request.headers["content-type"].includes("json")) reply.type('application/ld+json; profile="https://www.w3.org/ns/activitystreams"').code(200).send(obj)
    else{
      const htmlpath = obj.htmlpath
      return reply.sendFile(path.basename(htmlpath), path.join(fastify.__dirname, path.dirname(htmlpath)))
    } 
  })
}