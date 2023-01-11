'use strict'

require('dotenv').config()
const path = require('path')
const AutoLoad = require('@fastify/autoload')
const Actor = require('./dal/actor')

module.exports = async function (fastify, opts) {
  // Place here your custom code!

  // register plugins from npm
  fastify.register(require('@fastify/formbody'))

  // serve static files
  fastify.register(require('@fastify/static'), {
    root: path.join(__dirname, 'public'),
    prefix: '/public/', // optional: default '/'
  })

  fastify.__dirname = __dirname

  // set the base url for later
  fastify.baseUrl = new URL(process.env.SERVER_URL)

  // read the actor information
  fastify.actor = await Actor.ReadActor()

  // Do not touch the following lines

  // This loads all plugins defined in plugins
  // those should be support plugins that are reused
  // through your application
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'plugins'),
    options: Object.assign({}, opts)
  })

  // This loads all plugins defined in routes
  // define your routes in one of these
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'routes'),
    options: Object.assign({}, opts)
  })
}
