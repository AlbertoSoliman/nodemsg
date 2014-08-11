"use strict";

const PC_MANAGER_CID = Components.ID("{E954D866-A810-4064-ABBF-96AA30588037}")
const API_INIT_WIN  = Components.interfaces.nsIDOMGlobalPropertyInitializer
const API_INPUT_STR = Components.interfaces.nsIScriptableInputStream
const API_REQUESTOR = Components.interfaces.nsIInterfaceRequestor
const API_STORAGE   = Components.interfaces.nsIDOMStorage
const classDescription = "about:nodemsg"
const chromeSkin    = "chrome://global/skin/icons"
const REGEX_TRIM    = /(^\s+)|(\s+$)/g
const LOCAL_HOST = '127.0.0.1', PREFIX = ">", INTERVAL = 111; // x 2 for updateView
const FATAL_BUG = [ "storage-or-component-of-page-is-unready",
                   "You can use Reload (F5) command, as least action." ];
const INFORM_BUG = [ "informal-packet", "See detail in Web Console via Developer Menu." ];
const ACK_BUG = [ "acknowledgement", "Reply is not got." ];
      
Components.utils.import("resource://gre/modules/Services.jsm")
Components.utils.import("chrome://nodemsg/content/include.jsm")

// EVENTS : commands, interval, preferences and idle observer.
        
//  http://www.cse.yorku.ca/~oz/hash.html
function str2djb(astr) {    // i.e. md5 that is not md5
  let hash = 5381, i = astr.length;
  while (i) hash = (hash * 33) ^ astr.charCodeAt(--i);
  /* JavaScript does bitwise operations (like XOR, above) on 32-bit signed
* integers. Since we want the results to be always positive, convert the
* signed int to an unsigned by doing an unsigned bitshift. */
  return hash >>> 0;
}

function getFirstLine(astr, areverse)
{
    let packet = astr.split("\n");
    if (areverse) packet.reverse();
    let thestr = packet[0];
    if (!(thestr.length >> 2) && (packet.length >> 1))
        if (areverse) thestr = [ packet[1], thestr ].join(" ");
        else thestr = [ thestr, packet[1] ].join(" ");
    return thestr;
}

function reportBug(abug, atopic)
{
    atopic = atopic || "content-script";
    window.console.warn(ADDON_ISBN, atopic);
        window.console.warn(abug);
    nodemsg.notify( { "topic": abug.name, 
                    "msg" : abug.message, 
                    "exitValue": abug.result } );
}

function insetrMsg(amsg, aprefix)
{
        aprefix = (aprefix || "").concat(PREFIX);;
    let thenode = document.querySelector("textarea");
    let thestr  = (thenode.value || "").replace(REGEX_TRIM, "");
    let themsg = [ aprefix, amsg ].join(" ");
    if ((amsg || "").length) thenode.value = [ themsg, thestr ].join("\n");
}

var rendezvous = {
    OPEN_BLOCKING : parseInt(1),
    salute  : ADDON_ISBN,
    port    : 70,
    _isbn   : null, //  setInterval( function() { job.ticker() }, INTERVAL );
//    output  : {}, //    last letter
    socket  : null, //  .createInstance(interfaces.nsIScriptableInputStream);
    hash    : 0,    //  last sender
    counter : 0,
    timeStamp: Date.now(),
//    handleEvent : function(anevt)
    get running () { return (this._isbn != null) },

    doCmd : function(atype, amsg)
    {
        let ablank = { "type": atype }
        switch (atype) {
        case "gab" : ablank.msg = amsg || " ";
            break;
        case "bot" : ablank.msg = amsg || this.salute;
            break;
        default: 
            ablank.type = "escape";
            if (amsg) ablank.msg = amsg || "";
        }

        let unitSocket = Components.classes["@mozilla.org/network/socket-transport-service;1"]
                    .getService(Components.interfaces.nsISocketTransportService);
        let socketTransport = unitSocket.createTransport(["udp"], 1, LOCAL_HOST, this.port, null);

        let inputStream = socketTransport.openInputStream(0, 0, 0);
        let scriptible = Components.classes["@mozilla.org/scriptableinputstream;1"]
                            .createInstance(API_INPUT_STR);
            scriptible.init(inputStream);
        let outstream = socketTransport.openOutputStream(this.OPEN_BLOCKING, 0, 0);
        try {
            let packet = JSON.stringify(ablank); // it is packet
                outstream.write( packet, packet.length );
        }
            finally { outstream.close() }
//        this.type = ablank.type, this.socket = scriptible, 
        let thelen = 0;
        try {
            thelen = scriptible.available();
        }
        catch (err) {
            scriptible.close();
            throw err;
        }
//    window.console.log("_dvk_dbg_, msg is send, available: ", thelen);
            thelen = ablank.msg.length;
        this.hash = parseInt(0);
        if ((thelen >> 1) && (ablank.type == "gab"))
        {            
            this.hash = str2djb(ablank.msg);
    //  TODO:   if len >> 1 then ask for ack
            insetrMsg(ablank.msg);
            let thenode = document.querySelector("hbox.transmitter > textbox[flex]");
                thenode.value = getFirstLine(ablank.msg, true); // last line
            cmdClear(null); //cument.getElementById("cmd_clear").doCommand();
            thenode = document.querySelector("hbox.transmitter > .timeStamp");
                thenode.value = (new Date()).toLocaleTimeString();
        }

        this._isbn = window.setInterval( function() {
            let thebug = null, timeStamp = rendezvous.timeStamp;
            try {
                if (!(rendezvous.poll()))
                if ((++rendezvous.counter) >> 3)
                {
                    window.setTimeout( function() { rendezvous.doCmd("bot") }, 3 );
                    timeStamp = 0;
                }
            }
            catch (err) {
                thebug = err;
                Components.utils.reportError(err);
            }

            let span = Math.abs(rendezvous.timeStamp - timeStamp);
            if (thebug || (span > (INTERVAL * 2))) // overstress
            {
                window.setTimeout( function() { rendezvous.reset() }, 0 );
                if (thebug) reportBug(thebug, "udp-write");
                    else if (timeStamp) 
                        window.console.log( ADDON_ISBN, 
                            "overstress-stop-polling, delay:", span );
            }

        }, INTERVAL );
        this.socket = scriptible;
        this.timeStamp = Date.now();
    },  //  rendezvous.doCmd

    poll : function()
    {
        this.timeStamp = Date.now();
        let themsg = "", numbyte = Math.abs(this.socket.available());
//    window.console.log("_dvk_dbg_, poll: ", numbyte, " timeStamp: ", this.timeStamp);
        if (numbyte) themsg = this.socket.read(numbyte) || "";
        if (!themsg) return 0; // no data

        let thenode = document.querySelector("hbox.ack > .timeStamp");
        if (nodemsg.running) thenode.value = (new Date()).toLocaleTimeString();
        if ((themsg || "").indexOf(":") > 1) 
        {
            this.job2face(themsg); 
            if (this.counter) --this.counter;
        }
        else {
            nodemsg.notify( { "topic": INFORM_BUG[0], "msg" : INFORM_BUG[1] } );
            window.console.log(ADDON_ISBN, "length: ", themsg.length, " informal-packet:");
            window.console.log(themsg);
        }
        return (themsg.length);
    },

    job2face : function(themsg)
    {
        let domain = themsg.split(":")[0] || "";
        if (!(domain.endsWith(LOCAL_HOST)))
        {
            themsg = themsg.replace(domain.concat(":"), "");
            let timeStamp = (themsg.match(/^\s*\d+\s/) || ([ "0" ]))[0];
                themsg = themsg.replace(/^\s*\d+\s+/, "");
                timeStamp = Number(timeStamp.trim()) || parseInt(0);
                timeStamp = new Date(timeStamp || Date.now());
            insetrMsg(themsg, domain);
            let thenode = document.querySelector("hbox.receiver > textbox[flex]");
                thenode.value = getFirstLine(themsg);
                thenode = document.querySelector("hbox.receiver > .timeStamp");
                thenode.value = timeStamp.toLocaleTimeString();
        }
//        else { ECHO MSG
    },

    reset : function()
    {
        this.counter = this.hash = parseInt(0);
//    window.console.log("_dvk_dbg_, reset of rendezvous.");
        let transit = this._isbn;
        if ((this.running) && (this._isbn === transit))
        {
            this._isbn = null;
            window.clearInterval(transit);
        }

        if (this.socket)
            try { this.socket.close() }
                finally { this.socket = null }
    }
};  //  var rendezvous = {

var nodemsg = {
    _running : false,
    _isbn   : null, // node.exe or winid
    storage : null, //  first step of initialize
    host    : null,
    timeStamp: Date.now(), // notify subsystem (observer)
    counter : 0,

    load : function()
    {
        if (this._isbn && this.storage)
        {
            document.querySelector("commandset")
                    .addEventListener( "command", this, false );
            let theobj = this.storage.getItem(this.host);
                theobj = JSON.parse(theobj) || {};
            if (theobj.isRunning)
            {
                window.setTimeout( function() { nodemsg.updateView() }, 0 );
                this.running = theobj.isRunning;
                document.querySelector("textbox.ack").value = this._isbn;
            }
            return;
        }
        //  below something wrong
        let theobj = this.storage.getItem(this.host) || "";
        if (theobj) 
        {
            theobj = this.storage2cfg( JSON.parse(theobj) );
                this.notify(theobj);
        };
        document.getElementById("cmd_run").disabled = true;
        theobj = { "topic": FATAL_BUG[0], "msg" : FATAL_BUG[1] };
            this.notify( theobj );
        return;
    },

    initialize : function()
    {
        window.addEventListener( "load", function() { nodemsg.load() }, false );
        let form = document.querySelector("form");
        if (form)
        try {   //  first: communication line.
            let bootstrap = Components.classesByID[PC_MANAGER_CID].getService(API_REQUESTOR);
                this.storage = bootstrap.getInterface(API_STORAGE);
        }
        catch (err) {
            Components.utils.reportError(err);
            window.console.warn(ADDON_ISBN, "local storage is not created, origin:");
            window.console.warn(ABOUT_CONTENT);
            window.console.warn(err);
        }

        if (this.storage)
        try {   //  second: component.
            let bootstrap = Components.classesByID[PC_MANAGER_CID].getService(API_INIT_WIN);
            let theobj = bootstrap.init(window);
            rendezvous.port = parseInt(theobj.port) || rendezvous.port;
            rendezvous.salute = theobj.salute || rendezvous.salute;
            document.querySelector("notification").label = rendezvous.salute;
            form.addr.value = theobj.addr, form.port.value = rendezvous.port;
            this.host = [ theobj.addr, rendezvous.port ].join(":");
            window.console.log("process-init ", theobj);
            if ("isbn" in theobj) 
            {
                this._isbn = theobj.isbn;
                Services.prefs.addObserver(PREF_NOTIFY, this, false);
                Services.obs.addObserver( this, "user-interaction-inactive", false );
            }
        //  last line: test to successful.
            /*  se {
                window.setTimeout( function(acfg) { nodemsg.notify(acfg) }, 0, 
                { "topic": "process-init",  "name": theobj.name, "msg": theobj.message });
            }   */
        }
        catch (err) {
            Components.utils.reportError(err);
            window.console.warn(ADDON_ISBN, "content-script:");
            window.console.warn(err);
        }
    },

    get running () this._running,
    set running (newvalue) {
        newvalue = (newvalue || "").toString().toLowerCase();
        this._running = newvalue.startsWith("true");
    },

    updateView : function()
    {
        ++this.counter;
        window.setTimeout( function(alevel) {
        if (alevel == nodemsg.counter)
        {
            let newvalue = (nodemsg.running) ? "false" : "true";
            document.getElementById("cmd_send").setAttribute("disabled", newvalue);
            if (nodemsg.running) return;
    
            let thenode = document.querySelector("hbox.ack > .timeStamp");
            if (thenode) thenode.value = thenode.getAttribute("placeholder");
            document.querySelector("hbox.transmitter > textbox[flex]").value = "";
            return;
        }
        }, (INTERVAL * 2), this.counter);
    },

    storage2cfg : function(theobj)
    {
        let thecfg = {
            "topic":    theobj.topic,
            "exitValue": theobj.exitValue,
            "timeStamp": theobj.timeStamp || Date.now(),
            "msg" :     theobj.msg
        };

        if (theobj.bug) thecfg.msg = theobj.bug;
        else if (!(thecfg.msg))
            thecfg.msg = [ "exitValue( ", " )" ].join(thecfg.exitValue);

        return thecfg;
    },

    observe : function(asubject, atopic, adata)
    {    
        if (!(atopic == "nsPref:changed")) 
        {
            if (this.running) 
            {
                if (!(rendezvous.running))
                    rendezvous.doCmd("bot");
            }
            else
                document.getElementById("cmd_run").doCommand();
            return; // .addObserver( this, "user-interaction-inactive", false );
        }

        if((adata || "").indexOf(PREF_NOTIFY)) return;

        let theobj = this.storage.getItem(this.host);
            theobj = JSON.parse(theobj);
  window.console.log("_dvk_dbg_, observe of storage: ", theobj);
        let topic = (theobj.topic || "");        
        if ("isRunning" in theobj) this.running = theobj.isRunning;
//        if (theobj.timeStamp == this.notifyTimeStamp) return;
        let value = [ "timeStamp", this.host ].join(".");
            value = this.storage.getItem(value);
            value = Number(value || "0") || parseInt(0);
//  avoid topic is not used notify subsystem
        if (this.timeStamp < value)
        {
            this.timeStamp = value, this.updateView();
            if (topic.contains("component-init")) return;
            if (this.running) return; // if cruise or internal error

            let thecfg = this.storage2cfg(theobj);
                this.notify(thecfg);
            rendezvous.reset();
        }
        return; //  "nsPref:changed" - PREF_NOTIFY
    },

    handleEvent : function(anevt)
    {
        rendezvous.reset();
        let thebug = null;
        let target = anevt.target || {};
        if (anevt.currentTarget === window) // "unload"
        {
            if (this._isbn) 
            {
                Services.prefs.removeObserver(PREF_NOTIFY, this);
                Services.obs.removeObserver( this, "user-interaction-inactive" );
            }
        }
        else // if (anevt.type == "command")
            if (target.classList.contains("run")) this.running = false;
            else if (target.classList.contains("clear")) cmdClear(target);
            else 
            try {
                let thenode = document.querySelector("textbox.send");
                let thestr = (thenode.value || "").replace(REGEX_TRIM, "");
                if (str2djb(thestr) != rendezvous.hash)
                    rendezvous.doCmd("gab", thestr);
            }
            catch (err) {
                thebug = err;
                Components.utils.reportError(err);
            }
//    window.console.log("_dvk_dbg_, send command ", anevt.target);
        if (thebug) reportBug(thebug, "udp-read");
    },

    notify : function(acfg)
    {
//  acfg.topic: "process-failed", "process-finished", "acknowledgement"
//      "process-run", "process-init"; "component-init"
        function isEqualNotification(anode, alast)
        {
            if (!alast) return 0;
            let thestr = anode.label || "";
            if (anode.type == alast.type)
            if (thestr.startsWith(alast.label))
                return thestr.length;
            return 0;
        }
        
        let icon  = "warning-16.png";
        let label = [ acfg.topic, acfg.msg ].join(', ');
        let value = acfg.exitValue || parseInt(1);
        switch (acfg.topic) {
            case "acknowledgement" : 
            case "process-finished": value = parseInt(0);
            case "informal-packet" : 
            case "process-failed"  : break;
            default : icon = "error-16.png";
        }

        let thebox = document.querySelector("vbox.notificationbox");
            thebox.firstElementChild.hidden = false;
        let thenode = thebox.firstElementChild.cloneNode(true);
            thenode.label = label;
            thenode.image = [ chromeSkin, icon ].join("/");
        if (value) thenode.type = "warning";

        let timestamp = thenode.querySelector("description.monospace");
            value = Number(acfg.timeStamp || "0") || parseInt(0);
        if (value && timestamp)
        {
            label = (new Date(value)).toLocaleTimeString();
            timestamp.setAttribute( "value", label );
        }

        let thelast = thebox.lastElementChild;
        if (isEqualNotification(thenode, thelast))
        {
            label = (thelast.querySelector("span") || {}).textContent;
            value = (label || "").match(/\w+/) || ([ "0" ]);
            value = (parseInt((value[0] || "0").trim()) || parseInt(0)) + 1;
            let thespan = thenode.querySelector("span");
                thespan.textContent = [ " (", ") " ].join(value);
            thebox.replaceChild(thenode, thelast);
        }
            else thebox.appendChild(thenode);
    }
}

function notificationClick(abox)
{
    let thenode = document.getAnonymousElementByAttribute(abox, "anonid", "details");
    if ((thenode || {}).nextElementSibling)
        thenode.nextElementSibling.focus();
}

function happening(anevt)
{
    //  anevt.target is cmd dom node
    nodemsg.updateView();
    document.querySelector(".transmitter > .timeStamp").value = "";
}

function cmdClear(acmd)
{
    let textarea = document.querySelector("textbox.send");
    let thestr = (textarea.value || "").trim();
    if (!(thestr.length))
    try {
        let thebox = document.querySelector("vbox.notificationbox");
        let thenode = thebox.lastElementChild;
        while (thenode)
        {
            if (thebox.firstElementChild === thenode) break;
            thebox.removeChild(thenode)
            thenode = thebox.lastElementChild;
        }
    }
    catch (err) {
        Components.utils.reportError(err)
    }
    textarea.value = "";
}

window.addEventListener( "unload", nodemsg, false );
    nodemsg.initialize();
//    window.setTimeout( function() { window.location.href = classDescription }, 0 );
