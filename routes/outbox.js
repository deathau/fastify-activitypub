'use strict'

const uuid = require('short-uuid')
const simpleGit = require('simple-git')
const Activity = require('../dal/activity')

module.exports = async function (fastify, opts) {
  // add a content type parser for activitystreams compatible json, but just parse it as json for now (don't bother with the JSON-LD stuff yet)
  fastify.addContentTypeParser(['application/ld+json; profile="https://www.w3.org/ns/activitystreams"', 'application/activity+json'], { parseAs: 'string' }, fastify.getDefaultJsonParser('ignore', 'ignore'));

  // post an activity to the outbox (https://www.w3.org/TR/activitypub/#client-to-server-interactions)
  fastify.post('/:id/outbox', { onRequest: [fastify.authenticate] }, async function (request, reply) {
    try{
      let activity = request.body

      // get the global actor
      const actor = fastify.actor

      // an activity is an actor acting on an object
      if(!activity.actor || !activity.object) {
        // so if there's no actor or object, this is not an activity, and therefore must be wrapped in a create activity
        // first though, we're going to assign this object an id (based on its type)
        const object = Object.assign({}, activity)
        object.id = new URL(`${object.type.toLowerCase()}/${uuid.generate()}`, fastify.baseUrl).href

        // this is the new create activity we're making
        const createActivity = new Activity({
          type: "Create",
          actor: actor.id,
          object: object,
          published: new Date().toISOString()
        })

        // the submitted activity no longer needs its @context
        delete object["@context"]
        // but it does need attribution
        object.attributedTo = actor.id

        // all the to, bto, cc and bcc values (and the audience) need to be assigned to the create activity
        if(object.to)  { createActivity.to = object.to; }
        if(object.bto) { createActivity.bto = object.bto; delete object.bto; } // bto should not be saved
        if(object.cc)  { createActivity.cc = object.cc; }
        if(object.bcc) { createActivity.bcc = object.bcc; delete object.bcc; } // bcc should not be saved
        if(object.audience) { createActivity.audience = object.audience; }

        // now that is sorted, the create activity is the new activity we're submitting
        activity = createActivity
      }

      // add a new id to this activity, regardless of any supplied one
      activity = new Activity(activity)
      delete activity.id
      activity.ensureId()

      // add a summary (if it doesn't already have one)
      activity.ensureSummary()
      
      // now save this activity data to the outbox for later reference
      await activity.write()

      // reply with the activity (201 with location header as specified by https://www.w3.org/TR/activitypub/#client-to-server-interactions)
      return reply.status(201).header('Location', activity.object.id).send(activity)
    }
    catch (e){
      if (e.status && Number.isFinite(e.status)){
        return reply.status(e.status).send(e.result)
      }
      else {
        return reply.status(500).send(e)
      }
    }
  })
}