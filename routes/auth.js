const fs = require('fs')
const os = require('os')
const path = require('path')
const IndieAuth = require('indieauth-helper')
const Actor = require("../dal/actor")

function tmpWriteFileSync(name, data, options = undefined) {
  return fs.writeFileSync(path.join(os.tmpdir(), name), data, options)
}

function tmpReadFileSync(name, options = undefined) {
  return fs.readFileSync(path.join(os.tmpdir(), name), options)
}

function tmpWriteJsonSync(name, data, options = undefined) {
  return fs.writeFileSync(path.join(os.tmpdir(), name), JSON.stringify(data, null, 2), options)
}

function tmpReadJsonSync(name, options = undefined) {
  return JSON.parse(fs.readFileSync(path.join(os.tmpdir(), name), options))
}
function tmpReadJsonAndDeleteSync(name, options = undefined) {
  const obj = tmpReadJsonSync(name, options)
  fs.rmSync(path.join(os.tmpdir(), name))
  return obj
}

module.exports = async function (fastify, opts) {

  fastify.all('/login', async function (request, reply) {
    // create the indie auth with options from env variables
    const auth = new IndieAuth({
      clientId: fastify.baseUrl.href,
      redirectUri: new URL('auth', fastify.baseUrl).href,
      me: new URL(process.env.ME).href,
      secret: process.env.SECRET
    })
    auth.options.codeVerifier = auth.generateRandomString()

    // get the auth url for 'me' (also populates the token endpoint)
    const authUrl = await auth.getAuthUrl('code', ['create', 'update'])

    // save the auth options so we can validate against them
    tmpWriteJsonSync('tmpauth', { ...auth.options, secret: undefined })
    //Actor.WriteActor({ ...fastify.actor, auth: auth.options }, fastify.fs)

    // redirect to the auth endpoint
    reply.redirect(authUrl)
  })

  fastify.get('/auth', async function (request, reply) {
    // now we're back from the auth endpoint, it's time to validate and get a token
    const tmpauth = tmpReadJsonAndDeleteSync('tmpauth')

    if(!tmpauth) return reply.code(500).send("Couldn't load actor auth data. Please try logging in again")
    const auth = new IndieAuth({ ...tmpauth, secret: process.env.SECRET })

    let err, token

    // validate the returned state
    const validatedState = auth.validateState(request.query.state)
    
    // this is single user, after all
    if(validatedState.me != process.env.ME){
      err = "invalid authorization state"
    }
    else {
      // time to get a token (and validate it)
      token = await auth.getToken(request.query.code)
      const res = await auth.verifyToken(token)
      if(!res) err = "could not validate token"
    }
    
    // no errors and we have a token? Let's populate the actor
    if(!err && token) {
      const actor = new Actor({ 
        id: validatedState.me,
        auth: { // keep the auth configuration (especially endpoints) for later
          me: validatedState.me,
          authEndpoint: auth.options.authEndpoint,
          tokenEndpoint: auth.options.tokenEndpoint,
          clientId: auth.options.clientId,
          redirectUri: auth.options.redirectUri
        }
      })

      try {
        // populate any other details (name, etc) from profile
        await actor.populateDetails()
        // write the actor back to file so we don't lose it
        await actor.write(fastify.fs)

        // set the global actor
        fastify.actor = new Actor(actor)
      }
      catch(e){
        err = e
      }
    }

    // if there's an error or no token, then this is unauthorised
    if(err || !token) reply.code(401).send(err)
    // everything went well, so return the token
    // TODO: return a view that displays the token?
    else reply.code(200).send(token)
  })
}