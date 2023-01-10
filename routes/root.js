'use strict'

module.exports = async function (fastify, opts) {
  fastify.get('/', async function (request, reply) {
    reply.code(200).type('text/html').send('<h1>Home</h1><form action="/login" method="get"><input type="Submit" value="Login" /></form>')
  })
}
