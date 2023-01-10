'use strict'

const fp = require('fastify-plugin')
const IndieAuth = require('indieauth-helper')

// the use of fastify-plugin is required to be able
// to export the decorators to the outer scope

module.exports = fp(async function (fastify, opts) {
  
  fastify.register(require('@fastify/jwt'), {secret: process.env.SECRET})

  // decorator for endpoints that require token authentication
  fastify.decorate("authenticate", async function(request, reply) {
    try {
      // set up the auth object from saved actor info
      const auth = new IndieAuth(fastify.actor.auth)
      // if we don't have a token endpoint saved, call the function to go get it
      if(!auth.options.tokenEndpoint) auth.getAuthUrl()
      // get the token from the request
      const token = fastify.jwt.lookupToken(request)
      // verify the token
      const res = await auth.verifyToken(token)
      // if the token could not be verified, send a 401 error
      if(!res) reply.code(401).send("token could not be verified")
    } catch (err) {
      reply.code(401).send(err)
    }
  })
})
