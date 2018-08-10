
(function(){
var interval = require('interval-promise');
var util = require('util'),
    events = require('events'),
	WebSocket = require('ws');
var WSRECONNECT = function(url, protocols, mixin, options) {
	if(!url){
		throw new Error("Please define dest url");
	}
	this.url 					= url && url.indexOf("ws") == -1 ? "ws://"+url : url;
	this.protocols    = protocols;
	this.mixin	= mixin || {};
	this.options 				= options || {};
	this.socket 				= null;
	this.isConnected 			= false;
  this.isAlive           = true;
	this.reconnectTimeoutId 	= 0;
	this.retryCount 			= this.options.retryCount || 2;
    this._retryCount            = this.retryCount;
	this.reconnectInterval 		= this.options.reconnectInterval !== undefined ? this.options.reconnectInterval : 5;
	this.shouldAttemptReconnect = !!this.reconnectInterval;
    // METHODS
    this.start = function(){

        let mixinopts = mixin.getwsopts();
        this.shouldAttemptReconnect = !!this.reconnectInterval;
        this.isConnected 		 	= false;
        this.socket 			 	= new WebSocket(this.url, this.protocols, mixinopts);
        this.socket.onmessage 	 	= this.onMessage.bind(this);
        this.socket.onopen 		 	= this.onOpen.bind(this);
        this.socket.onerror		 	= this.onError.bind(this);
        this.socket.onclose 	 	= this.onClose.bind(this);
        this.socket.on('pong',function(mess) {
           this.isAlive = true;
        });
    };

    this.destroy = function() {
        clearTimeout(this.reconnectTimeoutId);
	    this.shouldAttemptReconnect = false;
        this.socket.close();
    };

    this.onError = function(reason){
        // hook before close
    };

    this.onOpen = function(){
        this.isConnected 	= true;
	    this.emit("connect");
        // set again the retry count
        this.retryCount = this._retryCount;
    };

    this.onClose = function(reason) {
        if (this.shouldAttemptReconnect && this.retryCount > 0) {
            this.retryCount--;
            clearTimeout(this.reconnectTimeoutId);
            this.reconnectTimeoutId = setTimeout(function(){
                this.emit("reconnect");
                this.start();
            }.bind(this), this.reconnectInterval*1000);
        }else{
            this.emit("destroyed");
        }
    };

    this.onMessage = function(message) {
	   this.emit("message",message.data);
    };

    this.send = function(message) {
      this.socket.send(message);
    }

  function noop() {};
  interval(async (iteration, stop) => {
     if (this.isAlive === false) {
        this.socket.terminate();
        this.emit("pingpongreconnect");
        this.start();
      }
      this.isAlive = false;

     this.socket.ping(noop);
    //if (this.pullNetworkflag == false) {
    //    stop()
    //} else{

    //}
  
  }, 10*1000);

};

util.inherits(WSRECONNECT, events.EventEmitter);
module.exports = WSRECONNECT;

})();
