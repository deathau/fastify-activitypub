'use strict'

require('dotenv').config()
const git = require("isomorphic-git");
const http = require("isomorphic-git/http/node");
const { Volume, createFsFromVolume } = require("memfs");
const path = require('path').posix
const AutoLoad = require('@fastify/autoload')
const Actor = require('./dal/actor')

module.exports = async function (fastify, opts) {
  // Place here your custom code!

  const vol = new Volume()
  fastify.fs = createFsFromVolume(vol)
  process.env.rootdir = path.resolve('/') // __dirname if not using memfs

  await git.clone({
    fs: fastify.fs,
    http,
    dir: process.env.rootdir,
    url: `https://deathau:${process.env.GITHUB_TOKEN}@github.com/deathau/test-activitypub-db.git`,
    ref: 'main',
    singleBranch: true,
    depth: 1,
  })

  // register plugins from npm
  fastify.register(require('@fastify/formbody'))

  // // serve static files
  // fastify.register(require('@fastify/static'), {
  //   root: path.join(__dirname, process.env.STATIC_PATH),
  //   // prefix: (optional) default '/'
  // })

  // add a content type parser for activitystreams compatible json, but just parse it as json for now (don't bother with the JSON-LD stuff yet)
  fastify.addContentTypeParser(['application/ld+json; profile="https://www.w3.org/ns/activitystreams"', 'application/activity+json'], { parseAs: 'string' }, fastify.getDefaultJsonParser('ignore', 'ignore'));


  // set the base url for later
  fastify.baseUrl = new URL(process.env.SERVER_URL)

  // read the actor information
  fastify.actor = await Actor.ReadActor(fastify.fs)

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
