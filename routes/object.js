'use strict'

const path = require('path')
const Activity = require('../dal/activity')
const APObject = require('../dal/object')

module.exports = async function (fastify, opts) {
  fastify.get('/:type/:y/:m/:d/:file', { }, async function (request, reply) {
    if(request.headers["content-type"] && request.headers["content-type"].includes("json")) {
      const id = request.url
      const obj = await APObject.get(id)
      if(!obj) reply.callNotFound()
      reply.type('application/ld+json; profile="https://www.w3.org/ns/activitystreams"').code(200).send(obj)
    }
    else{
      return reply.sendFile("index.html", path.join(fastify.__dirname, process.env.STATIC_PATH, ...request.url.split('/')))
    } 
  })
}