
const PREFIX    = "  ";     // double space
const COLON     = ':';
const LOCAL_HOST = '127.0.0.1';  //  "192.168.1.33";
const ENCODING  = 'utf8';   // buffer to String

var PORT    = parseInt(8181),
    ADDRESS = "192.168.0.255", //   "192.168.1.255"
    randomstr = "i am nodemsg"; //  TODO: randomize string.

var dgram = require('dgram'),
    client = dgram.createSocket("udp4");
//    server  = dgram.createSocket(UDP_LIB);
//  client.setBroadcast(true); // ?

var themsg, thenum = parseInt(12345);
for (var i = 0; !(i >> 3); ++i)
{
    themsg = new Buffer( [ ++thenum, randomstr ].join(PREFIX) );
    client.send( themsg, 0, themsg.length, PORT, ADDRESS, // LOCAL_HOST,
        function(err, bytes) {
            if (err) console.log("faulty sending: ", err);
            else console.log("count of bytes: ", bytes);
        } );
}

themsg = new Buffer( [ "12345678", randomstr ].join(PREFIX) );
client.send( themsg, 0, themsg.length, PORT, ADDRESS, // LOCAL_HOST,
    function(err, bytes) {
        if (err) console.log("faulty sending: ", err);
        else console.log("count of bytes: ", bytes);
    } );

themsg = new Buffer( [ parseInt(12345), randomstr ].join(PREFIX) );
client.send( themsg, 0, themsg.length, PORT, ADDRESS, // LOCAL_HOST,
    function(err, bytes) {
        if (err) console.log("faulty sending: ", err);
        else console.log("count of bytes: ", bytes);
    } );

themsg = new Buffer( " " );
client.send( themsg, 0, themsg.length, PORT, LOCAL_HOST,
    function(err, bytes) {
        if (err) console.log("faulty sending: ", err);
        else console.log("count of bytes: ", bytes);
    } );

for (var i = 0; !(i >> 3); ++i)
{
    themsg = new Buffer( randomstr.concat(i + 1) );
    client.send( themsg, 0, themsg.length, PORT, LOCAL_HOST,
        function(err, bytes) {
            if (err) console.log("faulty sending: ", err);
            else console.log("count of bytes: ", bytes);
        } );
}

themsg = new Buffer( randomstr );
client.send( themsg, 0, themsg.length, PORT, ADDRESS, // LOCAL_HOST,
    function(err, bytes) {
        client.close();
        if (err) console.log("faulty sending: ", err);
        else console.log("count of bytes: ", bytes);
    } );
