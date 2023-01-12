const APObject = require('./object')

function isString(myVar) {
  return typeof myVar === 'string' || myVar instanceof String
}

function objectUrl(obj) {
  return isString(obj) ? obj : (obj.id || obj.url)
}

function activityString(activity, verb, preposition = null, targetProp = 'target') {
  let ret = `${verb}`
  const objectUri = objectUrl(activity.object)
  if(objectUri) ret += ` ${objectUri}`
  if(preposition) {
    const targetUri = objectUrl(activity[targetProp])
    if(targetUri) ret += ` ${preposition} ${targetUri}`
  }
  return ret
}

module.exports = class Activity extends APObject {

  async ensureSummary() {
    let obj
    if(isString(this.object)) obj = await APObject.get(this.object)
    else obj = new APObject(this.object)
    if(obj) {
      obj.ensureId()

      if(!this.summary) switch(this.type.toLowerCase()) {
        case 'accept':  this.summary = activityString(this, 'accepted', 'into'); break;
        case 'add':     this.summary = activityString(this, 'added', 'to'); break;
        case 'announce':this.summary = activityString(this, 'ANNOUNCEMENT:'); break;
        case 'arrive':  this.summary = activityString(this, 'arrived', 'at', 'location'); break;
        case 'block':   this.summary = activityString(this, 'blocked'); break;
        case 'create':  this.summary = activityString(this, `created a new ${obj.type}:`); break;
        case 'delete':  this.summary = activityString(this, 'deleted'); break;
        case 'dislike': this.summary = activityString(this, 'disliked'); break;
        case 'flag':    this.summary = activityString(this, 'flagged'); break;
        case 'follow':  this.summary = activityString(this, 'followed'); break;
        case 'ignore':  this.summary = activityString(this, 'ignored'); break;
        case 'invite':  this.summary = activityString(this, 'invited to', ': '); break;
        case 'join':    this.summary = activityString(this, 'joined'); break;
        case 'leave':   this.summary = activityString(this, 'left'); break;
        case 'like':    this.summary = activityString(this, 'liked'); break;
        case 'listen':  this.summary = activityString(this, 'listened to'); break;
        case 'move':    this.summary = activityString(this, 'moved', 'to'); break;
        case 'offer':   this.summary = activityString(this, 'offered', 'to'); break;
        case 'question':this.summary = `asked a question: "${this.name}" (${this.id})`; break;
        case 'reject':  this.summary = activityString(this, 'rejected'); break;
        case 'read':    this.summary = activityString(this, 'read'); break;
        case 'remove':  this.summary = activityString(this, 'removed', 'from'); break;
        case 'tentativereject':
                        this.summary = activityString(this, 'tentively rejected'); break;
        case 'tentativeaccept':
                        this.summary = activityString(this, 'tentively accepted'); break;
        case 'travel':  this.summary = activityString(this, 'travelled', 'to'); break;
        case 'undo':    this.summary = activityString(this, 'retracted'); break;
        case 'update':  this.summary = activityString(this, 'updated'); break;
        case 'view':    this.summary = activityString(this, 'viewed'); break;
        default:        this.summary = `did a thing: ${this.id}`; break;
      }
    }
  }

  async process(fs) {
    let existingObj = await APObject.get(this.object, fs)
    let newObj = new APObject(this.object)
    newObj.ensureId()
    switch(this.type.toLowerCase()) {
      case 'create':
        if(existingObj) throw 'object already exists'
        else await new APObject(newObj).write(fs)
        break;
      case 'delete':
        if(!existingObj) throw 'object does not exist'
        else await existingObj.delete(fs)
        break;
      case 'update':
        if(!existingObj) throw 'object does not exist'
        else await existingObj.update(newObj, fs)
    }
  }

  async send() {
    // TODO: implement ActivityPub spec for server to server
  }
}