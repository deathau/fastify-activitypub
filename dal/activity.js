const APObject = require('./object')

function isObject(obj) {
  return obj === Object(obj);
}

function objectUrl(obj) {
  return isObject(obj) ? obj.id || obj.url : object;
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

  ensureSummary() {
    if(!this.summary) switch(this.type.toLowerCase()) {
      case 'accept':  this.summary = activityString(this, 'accepted', 'into'); break;
      case 'add':     this.summary = activityString(this, 'added', 'to'); break;
      case 'announce':this.summary = activityString(this, 'ANNOUNCEMENT:'); break;
      case 'arrive':  this.summary = activityString(this, 'arrived', 'at', 'location'); break;
      case 'block':   this.summary = activityString(this, 'blocked'); break;
      case 'create':  this.summary = activityString(this, `created a new ${this.object.type}:`); break;
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

  async process(fs) {
    let obj = await APObject.get(this.object, fs)
    switch(this.type.toLowerCase()) {
      case 'create':
        if(obj) throw 'object already exists'
        else new APObject(this.object).write(fs)
        break;
      case 'delete':
        if(!obj) throw 'object does not exist'
        else obj.delete(fs)
        break;
      case 'update':
        if(!obj) throw 'object does not exist'
        else obj.update(this.object, fs)
    }

    this.send()
  }

  async send() {
    // TODO: implement ActivityPub spec for server to server
  }
}