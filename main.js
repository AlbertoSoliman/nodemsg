#!/usr/bin/env node

//    "name": "commander", "version": "2.2.0"
const DESCRIPTION = "The Node Messenger via udp:\n\t- listens to a given port\n\t" +
    "- relays a local (127.0.0.1) data to a given (multi-) address\n\t" +
    "- flushes a remote data to a local browser as reply,\n" +
    " last operation is reliable, i.e. is not repeated.\n";

const PREFIX    = "  ";     // double space
const HOST      = '127.0.0.1';  //  "192.168.1.33";
const ENCODING  = 'utf8';   // buffer to String
const MAX_LEN   = 1024;      // limit to len of one datagram

var PORT    = parseInt(8181),
    ADDRESS = "255.255.255.255", //   "192.168.1.255", 
    TTL     = 11;
//  TODO: Some var's to limit of memory usage.

var cmdops = require('./commander');
 cmdops.version('0.0.1').description(DESCRIPTION)
    .usage('[--port (-p) nnn] [--addr (-a) *.255] // length of one msg < 500')
    .option('-p, --port [n]', 'union nodes should share the same port', PORT, parseInt)
    .option('-a, --addr [*.255]', 'multi-address default '.concat(ADDRESS), ADDRESS)
    .option('-t, --ttl [sec]', 'time to live of repeater, in sec, less than 60.')
    .parse(process.argv);
//  TODO: time to live of relayed message (per sec).

 PORT = Math.abs(parseInt(cmdops.port) || PORT);
//  if (!(PORT >> 5)) PORT = parseInt(8080);
 ADDRESS = (cmdops.addr || "").trim() || ADDRESS;
 TTL = Math.abs(parseInt(cmdops.ttl) || parseInt(TTL));
    if (TTL > 60) TTL = parseInt(60); // one minute
//  TODO: diagnostic sub system.
 console.info( "configuration - ".concat([ ADDRESS, PORT ].join(" : ")) );
 console.info( [ "\ttime to live of repeater: ", " sec" ].join(TTL) );
    TTL *= 1000; // to milliseconds
        
//  http://www.cse.yorku.ca/~oz/hash.html
function str2djb(astr) {    // i.e. md5 that is not md5
  var hash = 5381, i = astr.length;
  while (i) hash = (hash * 33) ^ astr.charCodeAt(--i);
  /* JavaScript does bitwise operations (like XOR, above) on 32-bit signed
* integers. Since we want the results to be always positive, convert the
* signed int to an unsigned by doing an unsigned bitshift. */
  return hash >>> 0;
}

var CACHE   = { }; //  addr [ timeStamp + PREFIX + msg, ... ]
var GARBAGE = { '127.0.0.1': [] }; // one host for one msg, more is over
//  TODO: clearing sub system.

var dgram   = require('dgram');
var server  = dgram.createSocket('udp4');
var task    = { 
    timeStamp : Date.now(),
    tickTack: null,         // setInterval( relay...
    _msg    : new Buffer(0),

    reset : function (amd5)
    {
        var theobj = this.tickTack;
        if (theobj) 
        {
            if (amd5)   //  return if already exists
                if (GARBAGE[HOST].indexOf(amd5) + 1) 
                    return true;

            this.tickTack = null, clearInterval(theobj);
            server.send( this._msg, 0, this._msg.length, PORT, ADDRESS );
        }
        else
        if (GARBAGE[HOST].length >> 3)
        {
//  TODO: clearing sub system, by setTimeout(callback, 
        }
        return false;
    },

    relay : function (atimeStamp)
    {
        if ((this.timeStamp + TTL) > atimeStamp) 
            server.send( this._msg, 0, 
                            this._msg.length, 
                                PORT, ADDRESS );
            else this.reset(null);
    },

    charge : function ( amd5, amsg )
    {
        if (this.reset(amd5)) return;
        this.timeStamp = Date.now();
        GARBAGE[HOST].push(amd5);
        this._msg = new Buffer(amsg);
        this.tickTack = setInterval( 
            function() { task.relay(Date.now());
                }, 666 ); // less than one sec
        return;
    }
};

server.on('listening', function () {
    var address = server.address();
    server.setBroadcast(true); // ?
    console.log('UDP Server listening on ' + address.address + ":" + address.port);
});
/*
server.on('close', function () {
    console.log('UDP Server is closed.');
}); */
server.on('message', function (message, remote) 
{
    var address = remote.address || "";
    var themsg = [ address, remote.port ].join(':');

    var thestr = message.toString(ENCODING, 0, MAX_LEN).trim();
    if (address == HOST) // relay
    {
    var timeStamp = parseInt(Date.now() / 1000) * 1000;
        var theobj = { "type": "gab" };
        if (thestr.length)
        try {
            theobj = JSON.parse(thestr);
            if ("msg" in theobj) thestr = (theobj.msg || "").trim();
                else thestr = "";
    //  escape code ? console.log("JSON.parse: ", theobj);
        }
        catch(err)
        {
            console.log("JSON.parse: ", thestr);
            console.log(err);    //  TODO: comment.
        }

        if (thestr.length && (theobj.type == "gab"))
        {
            console.log("task to relay: ", thestr);
            thestr = [ timeStamp, thestr ].join(PREFIX);
            task.charge( str2djb(thestr), thestr );
        }

        var themsg = null, theaddr = null,
            thevec = Object.keys(CACHE);
        if (thevec.length) 
        {
            theaddr = thevec[0];
            themsg = CACHE[theaddr];
        }

        if (theaddr)
        if (themsg.length)
        if (themsg.length >> 1)
        {
            themsg = themsg.map( function(astr) {
                return astr.replace( /(^\d+)|(\s+$)/g , "" ).trim();
            } );
    //  TODO: restore one original timeStamp.
            themsg = [ timeStamp, themsg.join("\n") ].join(PREFIX);
        }
            else themsg = (themsg[0] || "").trim();
        else themsg  = null; // if (themsg.length)

        if (theaddr)
        {
            if (themsg)
            {
                themsg = new Buffer([ theaddr, themsg ].join(":"));
                server.send( themsg, 0, themsg.length, remote.port, address );
            }
            delete CACHE[theaddr];
        }
        else
        if (thestr.length >> 1) // echo, original is 127.0.0.1
        {
//    console.log("echo: ", thestr);
            thestr = new Buffer([ HOST, thestr ].join(":"));
            server.send( thestr, 0, thestr.length, remote.port, address );
        }
//  TODO: activate clearing .  else
        return;
    }   //  if (address == HOST) // relay

    console.log([ themsg, message.length ].join(' - '));
    
    var themd5 = null; // TODO: test prefix of msg.
    if ((thestr.indexOf(PREFIX) + 1) >> 1)
    {
        themd5 = str2djb(thestr);
        // (task.md5.indexOf(themd5) + 1) return;
        var thepos = GARBAGE[HOST].indexOf(themd5);
//    console.log('_dvk_dbg_, Host msg: ', thepos);
        if (!(thepos + 1))
        if (address in GARBAGE) //  if already found
                thepos = GARBAGE[address].indexOf(themd5);
            else GARBAGE[address] = [];
        if (thepos + 1) return;
    }
    else { 
    console.log('prefix of msg is wrong: ', thestr.substr(0, 33));
        return;
    }
    GARBAGE[address].push(themd5);
    if (address in CACHE) CACHE[address].push(thestr);
        else CACHE[address] = [thestr];
//      CACHE[address].push( [ address, thestr ].join(":") );

    return;
}); //  server.on('message' ...

process.on('exit', function(code) { 
    console.log('About to exit with code: ', code);
});

// Listen for error events on the socket. When we get an error, we
// want to be sure to CLOSE the socket; otherwise, it's possible that
// we won't be able to get it back without restarting the process.
server.on('error', function ( error ) { 
        server.close();
        console.log('About to exit with code: ', error); 
    }
);

server.bind(PORT);   //, HOST);
