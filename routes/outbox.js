'use strict'

const Activity = require('../dal/activity')
const APObject = require('../dal/object')

module.exports = async function (fastify, opts) {
  // add a content type parser for activitystreams compatible json, but just parse it as json for now (don't bother with the JSON-LD stuff yet)
  fastify.addContentTypeParser(['application/ld+json; profile="https://www.w3.org/ns/activitystreams"', 'application/activity+json'], { parseAs: 'string' }, fastify.getDefaultJsonParser('ignore', 'ignore'));

  // post an activity to the outbox (https://www.w3.org/TR/activitypub/#client-to-server-interactions)
  fastify.post('/:id/outbox', { onRequest: [fastify.authenticate] }, async function (request, reply) {
    try{
      let activity = new Activity(request.body)

      // get the global actor
      const actor = fastify.actor

      // an activity is an actor acting on an object
      if(!activity.isActivity) {
        // so if there's no actor or object, this is not an activity, and therefore must be wrapped in a create activity
        // first though, we're going to assign this object an id (based on its type)
        const object = new APObject(Object.assign({}, activity))
        object.ensureId()

        // this is the new create activity we're making
        const createActivity = new Activity({
          type: "Create",
          actor: actor.id,
          object: object,
          published: new Date().toISOString()
        })

        // the submitted object no longer needs its @context
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
      delete activity.id
      activity.ensureId()

      // add a summary (if it doesn't already have one)
      activity.ensureSummary()

      // reply with the activity (201 with location header as specified by https://www.w3.org/TR/activitypub/#client-to-server-interactions)
      reply.status(201).header('Location', activity.object.id).send(activity)
        .then(async () => {
          // now save this activity data to the outbox for later reference
          await activity.write()
          // and now, finally, we can perform the activity (or maybe add this to a queue of activities?)
          await activity.process()
        })
    }
    catch (e){
      if (e.status && Number.isFinite(e.status)){
        reply.status(e.status).send(e.result)
      }
      else {
        reply.status(500).send(e)
      }
    }
  })
}