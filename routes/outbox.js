'use strict'

const uuid = require('short-uuid')

function getActor() {
  return {
    username: 'death.au',
    id: 'death.au@death.id.au'
  }
}

module.exports = async function (fastify, opts) {
  fastify.addContentTypeParser(['application/ld+json; profile="https://www.w3.org/ns/activitystreams"', 'application/activity+json'], { parseAs: 'string' }, fastify.getDefaultJsonParser('ignore', 'ignore'));

  fastify.post('/:id/outbox', { onRequest: [fastify.authenticate] }, async function (request, reply) {
    try{
      let activity = request.body

      // authorize the logged in user
      const actor = getActor()
      actor.url = `${request.protocol}://${request.hostname}/${actor.username}`

      // an activity is an actor acting on an object
      if(!activity.actor || !activity.object) {
        // so if there's no actor or object, this is not an activity, and therefore must be wrapped in a create activity
        activity.id = `${actor.url}/${activity.type.toLowerCase()}/${uuid.generate()}`
        const createActivity = {
          "@context": "https://www.w3.org/ns/activitystreams",
          type: "Create",
          actor: `${actor.url}/`,
          object: activity,
          published: new Date().toISOString()
        }

        delete activity["@context"]
        activity.attributedTo = `${actor.url}/`
        if(activity.to)  { createActivity.to = activity.to; }
        if(activity.bto) { createActivity.bto = activity.bto; delete activity.bto; }
        if(activity.cc)  { createActivity.cc = activity.cc; }
        if(activity.bcc) { createActivity.bcc = activity.bcc; delete activity.bcc; }
        if(activity.audience) { createActivity.audience = activity.audience; }

        activity = createActivity
      }
      
      // add a new id to this activity, regardless of any supplied one
      activity.id = `${actor.url}/${uuid.generate()}`

      return reply.status(200).send({activity})
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