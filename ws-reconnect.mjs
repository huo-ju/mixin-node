import events from 'events';
import interval from 'interval-promise';
import util from 'util';
import WebSocket from 'ws';

const WSRECONNECT = function(url, protocols, mixin, options) {
  if (!url) {
    throw new Error('Please define dest url');
  }
  this.url = url && url.indexOf('ws') == -1 ? 'ws://' + url : url;
  this.protocols = protocols;
  this.mixin = mixin || {};
  this.options = options || {};
  this.socket = null;
  this.isConnected = false;
  this.reconnectTimeoutId = 0;
  this.reconnectInterval =
    this.options.reconnectInterval !== undefined
      ? this.options.reconnectInterval
      : 5;
  this.shouldAttemptReconnect = !!this.reconnectInterval;
  // METHODS
  this.start = function() {
    let mixinopts = mixin.getwsopts();
    this.shouldAttemptReconnect = !!this.reconnectInterval;
    this.isConnected = false;
    this.socket = new WebSocket(this.url, this.protocols, mixinopts);
    this.socket.onmessage = this.onMessage.bind(this);
    this.socket.onopen = this.onOpen.bind(this);
    this.socket.onerror = this.onError.bind(this);
    this.socket.onclose = this.onClose.bind(this);
  };

  this.destroy = function() {
    clearTimeout(this.reconnectTimeoutId);
    this.shouldAttemptReconnect = false;
    this.socket.close();
  };

  this.onError = function(event) {
    this.emit('error', event);
  };

  this.onOpen = function() {
    this.isConnected = true;
    this.emit('connect');
  };

  this.onClose = function(event) {
    if (this.shouldAttemptReconnect) {
      this.emit('closed', event);
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = setTimeout(() => {
        this.emit('reconnect');
        this.start();
      }, this.reconnectInterval * 1000);
    } else {
      this.emit('destroyed', event);
    }
  };

  this.onMessage = function(message) {
    this.emit('message', message.data);
  };

  this.send = function(message) {
    this.socket.send(message);
  };

  this.ping = () => {
    return new Promise((resolve, reject) => {
      try {
        this.socket.ping();
        let pong = false;
        this.socket.once('pong', () => {
          pong = true;
          resolve();
        });
        setTimeout(() => {
          if (!pong) {
            reject(new Error('timeout'));
          }
        }, 5000);
      } catch (err) {
        reject(err);
      }
    });
  };

  interval(async (iteration, stop) => {
    try {
      await this.ping();
    } catch (err) {
      this.socket.terminate();
      this.start();
    }
  }, 30 * 1000);
};

util.inherits(WSRECONNECT, events.EventEmitter);

export default WSRECONNECT;
