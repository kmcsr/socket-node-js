
'use strict';

const EventEmitter = require('events');
const { NUMBER_RE, PACKAGE_ID, NODE_STATUS } = require('./constants');

class SocketServerNode extends EventEmitter{
	constructor(socket, {pinginterval=15000/*15sec*/, pingtimeout=30000/*30sec*/, inithandler=null, pinghandler=null}={}){
		super();

		this.native = socket;
		this.inithandler = inithandler;
		this.pinginterval = pinginterval;
		this.pingtimeout = pingtimeout;
		this._ping_timeout_id = null;
		this._pong_timeout_id = null;
		this.pinghandler = pinghandler;
		this._status = NODE_STATUS.INIT;
		this._inited = false;
		this._pkg_msg_id = 0;
		this._pkg_rpy_cb = {};
		this._pkg_ping_id = 0;
		this._pkg_pong_cb = {};

		//let stick takeover the data
		this.native.on('message', (data)=>{
			data = data.toString();
			let pid = Number.parseInt(data[0]);
			data = data.substring(1);
			if(pid === PACKAGE_ID.INIT){
				if(this._status === NODE_STATUS.INIT){
					data = tryParseData(data);
					if(this.inithandler){
						let reply = this.inithandler(data);
						if(reply === null){
							this.close();
							return;
						}
						this.write(PACKAGE_ID.INIT, {
							pinginterval: this.pinginterval,
							pingtimeout: this.pingtimeout,
							data: reply
						});
					}else{
						this.write(PACKAGE_ID.INIT, {
							pinginterval: this.pinginterval,
							pingtimeout: this.pingtimeout
						});
					}
					this._status = NODE_STATUS.READY;
					this._inited = true;
					this.flushPing();
					this.emit('ready', data);
				}
				return;
			}
			this.flushPing();
			switch(PACKAGE_ID[pid]){
				case 'MESSAGE':{
					if(!this.is_ready){ return; }
					var relpy = undefined;
					if(data[0] === ','){
						let g = NUMBER_RE.match(data.substring(1));
						if(g){
							let id = g[0];
							data = data.substring(1 + id.length);
							let replied = false;
							relpy = (data)=>{
								if(replied){ return false; }
								this.write(PACKAGE_ID.REPLY, data, {id: id});
								replied = true;
								return true;
							};
						}
					}
					this.emit('message', tryParseData(data), relpy);
				}break;
				case 'REPLY':{
					if(!this.is_ready){ return; }
					if(data[0] === ','){
						let g = NUMBER_RE.match(data.substring(1));
						if(g){
							let id = g[0];
							data = data.substring(1 + id.length);
							id = Number.parseInt(id);
							let cb = this._pkg_rpy_cb[id];
							if(cb){
								delete this._pkg_rpy_cb[id];
								cb(tryParseData(data));
								return;
							}
						}
					}
				}break;
				case 'PING':{
					if(!this.is_ready){ return; }
					data = tryParseData(data);
					if(this.pinghandler){
						data = this.pinghandler(data);
					}
					this.write(PACKAGE_ID.PONG, data);
					this.emit('ping', data);
				}break;
				case 'PONG':{
					if(!this.is_ready){ return; }
					if(data[0] === ','){
						let g = NUMBER_RE.match(data.substring(1));
						if(g){
							let id = g[0];
							data = data.substring(1 + id.length);
							id = Number.parseInt(id);
							let cb = this._pkg_pong_cb[id];
							if(cb){
								delete this._pkg_pong_cb[id];
								cb(tryParseData(data));
								return;
							}
						}
					}
					this.emit('pong', tryParseData(data));
				}break;
				case 'CLOSE':{
					if(!this.is_close){
						this.native.emitClose();
					}
				}break;
			}
		});

		this.native.once('close', ()=>{
			this._status = NODE_STATUS.CLOSE;
			if(this._pong_timeout_id){ clearTimeout(this._pong_timeout_id); }
			if(this._ping_timeout_id){ clearTimeout(this._ping_timeout_id); }
			this.emit('close', null, this._inited);
		});

		this.native.once('error', (err)=>{
			this.emit('error', err);
			this.native.emitClose();
		});

		if(this.pingtimeout > 0){
			this._pong_timeout_id = setTimeout(()=>{
				this.close({"reason": "InitTimeout"});
			}, this.pingtimeout);
		}
	}

	get status(){
		return this._status;
	}

	get is_ready(){
		return this._status === NODE_STATUS.READY;
	}

	get is_close(){
		return this._status === NODE_STATUS.CLOSE;
	}

	flushPing(){
		if(!this.is_ready){ return; }
		if(this._pong_timeout_id){ clearTimeout(this._pong_timeout_id); }
		if(this._ping_timeout_id){ clearTimeout(this._ping_timeout_id); }
		if(this.pinginterval > 0){
			this._ping_timeout_id = setTimeout(()=>{
				this.ping((new Date().getTime() + Math.floor(Math.random() * 10000)) % 1000000);
				if(this.pingtimeout > 0){
					this._pong_timeout_id = setTimeout(()=>{
						this.close({"reason": "PongTimeout"});
					}, this.pingtimeout);
				}
			}, this.pinginterval);
		}
	}

	write(pid, data=null, {id=null}={}){
		if(this.is_close){ return; }
		var pkg = pid.toString();
		if(id !== null){
			pkg += ',' + id.toString();
		}
		if(data !== null){
			pkg += ';' + JSON.stringify(data);
		}
		this.native.send(pkg);
	}

	send(data, callback=null){
		if(!this.is_ready){ return; }
		var opt = {};
		if(callback){
			if(++this._pkg_msg_id === Infinity){
				this._pkg_msg_id = 1;
			}
			this._pkt_rpy_cb[opt.id = this._pkg_msg_id] = callback;
		}
		this.write(PACKAGE_ID.MESSAGE, data, opt);
	}

	ping(data=null, callback=null){
		if(!this.is_ready){ return; }
		var opt = {};
		if(callback){
			if(++this._pkg_ping_id === Infinity){
				this._pkg_ping_id = 1;
			}
			this._pkt_pong_cb[opt.id = this._pkg_ping_id] = callback;
		}
		this.write(PACKAGE_ID.PING, data);
	}

	close(data=null){
		if(this.is_close){ return; }
		this.write(PACKAGE_ID.CLOSE, data);
		this.emit('close', data, this._inited);
		this.native.emitClose();
	}
}

module.exports = SocketServerNode;

function tryParseData(data){
	let i = data.indexOf(';');
	if(i === -1){ return; }
	data = data.substring(i + 1);
	try{
		return JSON.parse(data);
	}catch(e){
		return undefined;
	}
}
