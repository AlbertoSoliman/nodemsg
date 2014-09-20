const DESCRIPTION = "The Node Messenger via udp:\n\t- listens to a given port\n\t" +
    "- relays a local (127.0.0.1) data to a given (multi-) address\n\t" +
    "- flushes a remote data to a local browser as reply,\n" +
    " last operation is reliable, i.e. is not repeated.\n";

const PREFIX    = "  ";     // double space
const COLON     = ':';
const LOCAL_HOST = '127.0.0.1';  //  "192.168.1.33";
const ENCODING  = 'utf8';   // buffer to String
const MAX_LEN   = 2048;      // limit to len of one datagram
const ERROR_ALREADY_CONNECTED = parseInt(19);
const ERROR_UNEXPECTED = parseInt(-1);
const errno2code = { 'EACCES': 3 };

var PORT    = parseInt(8181),
    ADDRESS = "255.255.255.255", //   "192.168.1.255", 
    TTL     = 11,
    randomstr = "i am nodemsg"; //  TODO: randomize string.
//  TODO: Some var's to limit of memory usage.

var cmdops = require('./commander'); //    "name": "commander", "version": "2.2.0"
 cmdops.version('0.1.3').description(DESCRIPTION)
    .usage('[--port (-p) nnn] [--addr (-a) *.255] // length of one msg < 500')
    .option('-o, --once [once]', 'one diagnostic round', false)
    .option('-p, --port [n]', 'union nodes should share the same port', PORT, parseInt)
    .option('-a, --addr [*.255]', 'multi-address default '.concat(ADDRESS), ADDRESS)
    .option('-t, --ttl [sec]', 'time to live of repeater, in sec, less than 60.')
    .parse(process.argv);

 PORT = Math.abs(parseInt(cmdops.port) || PORT);
//  if (!(PORT >> 5)) PORT = parseInt(8080);
 ADDRESS = (cmdops.addr || "").trim() || ADDRESS;
 TTL = Math.abs(parseInt(cmdops.ttl) || parseInt(TTL));
    if (TTL > 60) TTL = parseInt(60); // one minute

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
var TACKTACK= null;
var UDP_LIB = (ADDRESS.indexOf(COLON) + 1) ? 'udp6' : 'udp4';
var dgram = require('dgram'),
    client  = dgram.createSocket(UDP_LIB),
    server  = dgram.createSocket(UDP_LIB);

 console.info( "configuration - ".concat([ ADDRESS, PORT ].join(" : ")) );
 console.info( "library - ".concat(UDP_LIB), [ "\ttime to live of repeater: ", " sec" ].join(TTL) );
    TTL *= 1000; // to milliseconds

function clearGarbage()
{
    TACKTACK = null;
    console.log("node.js > clearGarbage");
    for (var key in GARBAGE) {
        var thevec = GARBAGE[key];
        if ("shift" in thevec)
        if ((thevec.length || parseInt(0)) >> 2)
            thevec.shift();
     }
}

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
                if (GARBAGE[LOCAL_HOST].indexOf(amd5) + 1) 
                    return true;

            this.tickTack = null, clearInterval(theobj);
            server.send( this._msg, 0, this._msg.length, PORT, ADDRESS );
        }
        else
        if (!TACKTACK && (GARBAGE[LOCAL_HOST].length >> 3))
            TACKTACK = setTimeout(function() { clearGarbage() }, TTL);
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
        GARBAGE[LOCAL_HOST].push(amd5);
        amsg = amsg.concat("\n").replace( /\n+/g, "\n" );
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
    console.log('UDP Server listening on ' + address.address + COLON + address.port);
    client = null;
});

server.on('message', function (message, remote) 
{
    var address = remote.address || "";
    var themsg = [ address, remote.port ].join(COLON);
//  console.log("\tmsg event: ", themsg);
    var thestr = message.toString(ENCODING, 0, MAX_LEN).trim();
    var index = address.lastIndexOf(LOCAL_HOST) + 1;
    if (index--) //   if find
    if ((index == 0) || (address[--index] == COLON)) // relay
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
//  console.log("JSON.parse: ", thestr); console.log(err);
        }

        if (thestr.length && (theobj.type == "gab"))
        {
            console.log("task to relay: ", thestr);
            thestr = [ timeStamp, thestr ].join(PREFIX);
            task.charge( str2djb(thestr), thestr );
        }
//        else console.log(remote.port, " bot msg: ", thestr);

        var thevec = Object.keys(CACHE);
        var themsg = "", theaddr = thevec[0] || null;
        if (theaddr) // foreign sender
        {
            themsg = CACHE[theaddr] || [];
            if ((parseInt(themsg.length || 0)) >> 1)
            {
                themsg = themsg.map( function(astr) {
                    return astr.replace( /(^\d+)|(\s+$)/g , "" ).trim();
                } );
        //  TODO: restore one original timeStamp.
                themsg = [ timeStamp, themsg.join("\n") ].join(PREFIX);
            }
                else themsg = (themsg[0] || "").trim();
            delete CACHE[theaddr];
        }

        var packet = null;
        if (themsg.length && theaddr)
            packet = new Buffer([ theaddr, themsg ].join(COLON));
        else
        if (thestr.length >> 1) // echo, original is 127.0.0.1
        {
            themsg = [ LOCAL_HOST, timeStamp ].join(COLON);
            packet = new Buffer([ themsg, thestr ].join(PREFIX));
        }
//            packet = new Buffer([ LOCAL_HOST, thestr ].join(COLON));
        if (packet) server.send( packet, 0, packet.length, remote.port, address );
            else if (!TACKTACK) 
                TACKTACK = setTimeout( function() { clearGarbage() }, (TTL / 10) );
        return;
    }   //  if (address == LOCAL_HOST) // relay

//    console.log([ themsg, message.length ].join(' - '));
    var themd5 = null;
    if ((thestr.indexOf(PREFIX) + 1) >> 1)
    {
        themd5 = str2djb(thestr);
        // (task.md5.indexOf(themd5) + 1) return;
        var thepos = GARBAGE[LOCAL_HOST].indexOf(themd5);
        var thelen = (GARBAGE[address] || {}).length || parseInt(0);
        if (!(thepos + 1))
            if (thelen) //  if already found
            {
                thepos = GARBAGE[address].indexOf(themd5);
                if ((thepos + 1) && (thelen >> 3))
                {
                    var isbn = TACKTACK;
                    if (TACKTACK) clearTimeout(isbn);
                    TACKTACK = setTimeout(function() { clearGarbage() }, TTL);
                }
            }
                else GARBAGE[address] = [];
        if (thepos + 1) return; // loopback msg or already exists
    }
    else {
    console.log('prefix of msg is wrong: ', thestr.substr(0, 33));
        var thelen = Object.keys(GARBAGE).length;
        if (!TACKTACK && thelen >> 3)
            TACKTACK = setTimeout(function() { clearGarbage() }, TTL);
        return;
    }
    GARBAGE[address].push(themd5);
    if (address in CACHE) CACHE[address].push(thestr);
        else CACHE[address] = [thestr];
//      CACHE[address].push( [ address, thestr ].join(COLON) );

    return;
}); //  server.on('message' ...

function getExitCode(newval)
{
    var theval = parseInt(0);
    if (newval.length)
        if (newval in errno2code)
            theval = parseInt(errno2code[newval]);
    if (!theval) theval = parseInt(newval);
    return (theval || ERROR_UNEXPECTED);
}

// Listen for error events on the socket. When we get an error, we
// want to be sure to CLOSE the socket; otherwise, it's possible that
// we won't be able to get it back without restarting the process.
server.on('error', function ( error ) { 
        server.close();
        console.error(error);
        process.exit(getExitCode(error.errno || error.code));
    }
);

client.on('close', function () { server.bind(PORT) });
client.on('message', function (message, remote) 
{
    var thestr = message.toString(ENCODING, 0, MAX_LEN).trim();
//        randomstr = [ LOCAL_HOST, randomstr ].join(COLON);
	if ((thestr.indexOf(LOCAL_HOST) + 1) && (thestr.indexOf(randomstr) > 1))
	{
        console.warn("Nodejs server already exists, port: ", PORT);
		process.exit(ERROR_ALREADY_CONNECTED);
	}
}	); // server.on('message', function (message, remote) 

( function() {  //  entry point
    var themsg = new Buffer([ '{ "type": "bot", "msg": "', '"}'].join(randomstr));
    client.send( themsg, 0, themsg.length, PORT, LOCAL_HOST, function(err, bytes) 
    {
        if (err)
        {
            console.error(err);
            process.exit(getExitCode(err.errno || err.code));
        }
        else    // to cruise
        {
            setTimeout( function() {
                if (cmdops.once) server.close(); else client.close();
            }, 7 );
            if (cmdops.once) client.close();
        }
    });
}) ();

process.on('exit', function(code) { 
    console.log('About to exit with code: ', code);
});

//  server.bind(PORT);   //, LOCAL_HOST);
