"use strict";

const PC_MANAGER_CID = Components.ID("{E954D866-A810-4064-ABBF-96AA30588037}")
const API_INIT_WIN  = Components.interfaces.nsIDOMGlobalPropertyInitializer
const API_INPUT_STR = Components.interfaces.nsIScriptableInputStream
const API_REQUESTOR = Components.interfaces.nsIInterfaceRequestor
const API_STORAGE   = Components.interfaces.nsIDOMStorage
const classDescription = "about:nodemsg"
const chromeSkin    = "chrome://global/skin/icons"
const REGEX_TRIM    = /(^\s+)|(\s+$)/g
const RAW_FORMAT    = "  " //   in main.js PREFIX    = "  ";     // double space
const LOCAL_HOST = '127.0.0.1', PREFIX = ">", INTERVAL = 222; // x 2 for updateView
const XPATH_RUN_BTN = "hbox > button:only-of-type"
const MAX_LEN       = 1024
const PORT_ACCESS_NOT_ALLOWED   = parseInt(3);
const FILE_ACCESS_DENIED        = parseInt(8);
const ERROR_ALREADY_CONNECTED   = parseInt(19);
const ERROR_UNEXPECTED = parseInt(-1);
const FATAL_BUG = [ "storage-or-component-of-page-is-unready",
                   "You can use Reload (F5) command, as least action." ];
const INFORM_BUG = "See detail in Web Console via Developer Menu.";
      
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

function updateClrField(aclass, avalue)
{
    //t thenode = document.querySelector("hbox.receiver > deck");
    let thesel = [ "hbox", " > deck" ].join(aclass);
    let thenode = document.querySelector(thesel);
    if (avalue)
    {
        thenode.appendChild(thenode.firstElementChild);
        avalue = avalue.toLocaleTimeString()
    }   //  only querySelector("hbox.ack > deck");
        else (document.querySelector("textbox.ack") || {}).value = "";
    thenode.firstElementChild.value = avalue || ""; //  placeholder
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
        aprefix = (aprefix || "").concat(PREFIX);
    let thenode = document.querySelector("textarea[persist]");
    let thestr  = (thenode.value || "").replace(REGEX_TRIM, "");
    let themsg = [ aprefix, amsg ].join(" ");
    if ((amsg || "").length) thenode.value = [ themsg, thestr ].join("\n");
}

var rendezvous = {
    OPEN_BLOCKING : parseInt(1),
    salute  : ADDON_ISBN,
    addr    : "255.255.255.255",
    port    : 8181,
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
        if (this.socket) return; // guard
        if (amsg) amsg = amsg.substr(0, MAX_LEN);
        let ablank = { "type": "gab" }
        switch (atype) {
        case "gab" : ablank.msg = encodeURIComponent(amsg) || " ";
            break;
        case "bot" : ablank.type = "bot";
            ablank.msg = amsg || this.salute;
            break;
        case "escape" : ablank.type = "escape";
            if (amsg) ablank.msg = amsg || "";
            break;
        default: atype = null; // "raw" 
            ablank.msg = [ Date.now(), encodeURIComponent(amsg) ].join(RAW_FORMAT);
        }

        let unitSocket = Components.classes["@mozilla.org/network/socket-transport-service;1"]
                    .getService(Components.interfaces.nsISocketTransportService);
        let socketTransport = unitSocket.createTransport( ["udp"], 1, // Array of socket type strings. 
                                            (atype) ? LOCAL_HOST : this.addr, // Specifies the target address literal.
                                                this.port, null); // the port and the transport-layer proxy type to use. 
        let inputStream = socketTransport.openInputStream(0, 0, 0);
        let scriptible = Components.classes["@mozilla.org/scriptableinputstream;1"]
                            .createInstance(API_INPUT_STR);
            scriptible.init(inputStream);
        let outstream = socketTransport.openOutputStream(this.OPEN_BLOCKING, 0, 0);
        try {
            let packet = (atype) ? JSON.stringify(ablank) : ablank.msg;
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
        amsg = (atype) ? ablank.msg : amsg;
        this.hash = parseInt(0), thelen = (amsg || "").length;
        if ((thelen >> 1) && (ablank.type == "gab"))
        {            
            thelen = str2djb(amsg);
            if (atype) amsg = decodeURIComponent(amsg);
                else amsg = amsg.replace(/^d+\s+/, "");
            insetrMsg(amsg);
            let thenode = document.querySelector("hbox.transmitter > textbox[flex]");
                thenode.value = getFirstLine( amsg, true ); // last line
            cmdClear(null); //cument.getElementById("cmd_clear").doCommand();
            thenode = document.querySelector("hbox.transmitter > .timeStamp");
                thenode.value = (new Date()).toLocaleTimeString();
            this.hash = thelen;
        }

        this._isbn = window.setInterval( function() { rendezvous.ticker() }, INTERVAL );
        this.socket = scriptible, this.timeStamp = Date.now();
    },  //  rendezvous.doCmd

    ticker : function() // setInterval
    {
        if (!this.socket) return; // guard
        let thebug = null, timeStamp = this.timeStamp;
        try {
            if (!(this.poll()))
            if ((++this.counter) >> 3)
            {
                if (!(nodemsg.mode) && nodemsg.running) //  prolongation of pooling
                    window.setTimeout( function() 
                        { rendezvous.doCmd("bot") }, (INTERVAL >> 1) );
                timeStamp = 0;
            }
        }
        catch (err) {
            Components.utils.reportError(thebug = err)
        }

        let span = Math.abs(this.timeStamp - timeStamp);
        if (thebug || (span > (INTERVAL * 2))) // overstress
        {
            window.setTimeout( function() { rendezvous.reset() }, 0 );
            if (nodemsg.running)
            if (thebug) reportBug(thebug, "udp-write");
                else if (timeStamp) window.console.log( ADDON_ISBN, 
                            "overstress-stop-polling, delay:", span );
        }
    }, //  ticker : function() // setInterval

    poll : function()
    {
        this.timeStamp = Date.now();
        let themsg = "", numbyte = Math.abs(this.socket.available());
//    window.console.log("_dvk_dbg_, poll: ", numbyte, " timeStamp: ", this.timeStamp);
        if (numbyte) themsg = this.socket.read(numbyte) || "";
        if (!themsg) return 0; // no data

        if (nodemsg.running) updateClrField(".ack", (new Date()));
            themsg = (themsg || "").replace(/^:+/, "");
        if ((themsg.indexOf(":") > 0) && (themsg.indexOf(RAW_FORMAT) > 1))
        try {
            this.job2face(themsg);
            if (this.counter) --this.counter;
        }
        catch (err) {
            reportBug(err, "udp-read");
            window.console.warn(ADDON_ISBN, "length: ", themsg.length, " unformatted-packet:");
            window.console.warn(themsg);
        }
        else {
            nodemsg.notify( { "topic": "udp-read", "msg" : INFORM_BUG, "exitValue": 1 } );
            window.console.warn(ADDON_ISBN, "length: ", themsg.length, " informal-packet:");
            window.console.warn(themsg);
        }
        return (themsg.length);
    },

    job2face : function(themsg)
    {
        let prefix = (themsg.split(RAW_FORMAT)[0] || "").trim();
        let timeStamp = (prefix.match(/\d+$/) || ([ "0" ]))[0];
        let domain = prefix.replace(/:\d+\s*$/, "");
        if (!(domain.endsWith(LOCAL_HOST)))
        {
            themsg = themsg.replace(prefix, "").trim();
//            let timeStamp = (themsg.match(/^\s*\d+\s/) || ([ "0" ]))[0];
            timeStamp = Number(timeStamp.trim()) || parseInt(0);
            timeStamp = new Date(timeStamp || Date.now());
            themsg = decodeURIComponent(themsg);
            insetrMsg(themsg, domain), themsg = getFirstLine(themsg);
            document.querySelector(".receiver > textbox").value = themsg;
            updateClrField(".receiver", timeStamp);
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
    storage : {}, //  first step of initialize
    host    : null,
    timeStamp: Date.now(), // notify subsystem (observer)
    counter : 0,
    mode    : false,    // lazy (economic) mode
    focusedbtn : null,  // btn and notification box
    lastKeyCode: 0,     //  event.keyCode

    load : function()
    {
        function revolver(aselector)
        {
            let thebox = document.querySelector(aselector) || {};
            let thenode = thebox.firstElementChild;
            if (thenode) for (let i = 0; i < 4; ++i)
                 thebox.appendChild(thenode.cloneNode(false));
        }
    
        let theobj = null;
        if (this.storage.getItem) theobj = this.storage.getItem(this.host);

        if (this._isbn && this.storage.getItem)
        {
            document.querySelector("commandset.main")
                    .addEventListener( "command", this, false );
            theobj = JSON.parse(theobj) || {};
            if (theobj.isRunning)
            {
                window.setTimeout( function() { updateView() }, 0 );
                this.running = theobj.isRunning;
                document.querySelector("textbox.ack").value = this._isbn;
            }
            window.setTimeout( function(anode) { anode.focus() }, 0, 
                                document.querySelector(XPATH_RUN_BTN) );

            revolver(".ack > deck"), revolver(".receiver > deck");

            let form = document.querySelector("form");
            let thelen = (form.addr.value || "").length;
            if ((form.addr.size || 20) < thelen)
                form.addr.setAttribute("size", thelen);
        }
        else //  below something wrong
        {
            if (theobj) theobj = this.storage2cfg( JSON.parse(theobj) );                
                this.notify(theobj);
            document.getElementById("cmd_run").setAttribute("disabled", "true");
            theobj = { "topic": FATAL_BUG[0], "msg" : FATAL_BUG[1] };
                this.notify( theobj );
        }
    },  //  load : function()

    initialize : function()
    {
        window.addEventListener( "load", function() { nodemsg.load() }, false );
        let form = document.querySelector("form");
        if (form)
        try {   //  first: communication line.
            let bootstrap = Components.classesByID[PC_MANAGER_CID].getService(API_REQUESTOR);
                this.storage = bootstrap.getInterface(API_STORAGE) || {};
        }
        catch (err) {
            Components.utils.reportError(err);
            window.console.warn(ADDON_ISBN, "local storage is not created, origin:");
            window.console.warn(ABOUT_CONTENT);
            window.console.warn(err);
        }

        if (this.storage.getItem)
        try {   //  second: component.
            let bootstrap = Components.classesByID[PC_MANAGER_CID].getService(API_INIT_WIN);
            let theobj = bootstrap.init(window);
            form.port.value = rendezvous.port = parseInt(theobj.port) || rendezvous.port;
            form.addr.value = rendezvous.addr = theobj.addr || rendezvous.addr;
            rendezvous.salute = theobj.salute || rendezvous.salute;
            document.querySelector("notification").label = rendezvous.salute;
            this.host = [ rendezvous.addr, rendezvous.port ].join(":");
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

    innerUpdateView : function()
    {
        function updateBtn(asbn, anewval)
        {
            const btn2next = { "cmd_send": "textarea.send", "cmd_clear": XPATH_RUN_BTN };
            let thebtn = document.querySelector([ "button[command='", "']" ].join(asbn)) || {};
            document.getElementById(asbn).setAttribute("disabled", (anewval) ? "false" : "true");
            if (!anewval) 
                if (thebtn === document.querySelector("button:focus"))
                    window.setTimeout( function(anode) { anode.focus() }, 0, 
                                        document.querySelector(btn2next[asbn]) );
        }

        if (!(this.running)) updateClrField(".ack");
        (document.querySelector("textbox.ack") || {}).readOnly = this.running;
//          if (!(rendezvous.running)) rendezvous.hash = 0;
        document.getElementById("cmd_mode").setAttribute("checked", (this.mode) ? "true" : "false");
        let thenode = document.querySelector("textarea.send") || {};
        if (thenode.clientHeight < thenode.scrollHeight)
        if (document.querySelector("vbox").clientHeight < document.documentElement.clientHeight)
            thenode.rows = thenode.rows + 1;
        let strsend = thenode.value || "";
        let newvalue = this.running || (strsend.replace(REGEX_TRIM, "").length);
        if (this.lastKeyCode && newvalue)
        {
            thenode = document.getElementById("checkbox_return") || {};
            if (this.lastKeyCode == KeyEvent.DOM_VK_RETURN)
                if (thenode.checked && strsend.match(/\n\s?\n\s?$/))
                    window.setTimeout( function(anode) { anode.doCommand() }, 0, 
                                            document.getElementById("cmd_send") );
        }
            updateBtn("cmd_send", newvalue), nodemsg.lastKeyCode = 0;

        thenode = document.querySelector("vbox.notificationbox") || {};
        newvalue = parseInt(thenode.childElementCount || 0);
//        thestr = (document.querySelector("textarea.send") || {}).value || "";
        updateBtn("cmd_clear", ((strsend.length) || (newvalue >> 1)));
    },

    storage2cfg : function(theobj)
    {
        let thecfg = {
            "topic":    theobj.topic,
            "exitValue": theobj.exitValue,
            "timeStamp": theobj.timeStamp || Date.now(),
            "msg" :     theobj.msg
        };
//    window.console.log(Components.results.NS_ERROR_ALREADY_CONNECTED, " ", (thecfg.exitValue | 0x80000000));
        if (theobj.bug) thecfg.msg = theobj.bug;
        else if (!(thecfg.msg))
            switch (thecfg.exitValue) {
            case PORT_ACCESS_NOT_ALLOWED :
                thecfg.msg = "Access to a net or a port is not allowed.";
                break;
            case FILE_ACCESS_DENIED :
                thecfg.msg = "Access to file is denied, see web console.";
                break;
            case ERROR_ALREADY_CONNECTED :
                thecfg.msg = [ "Nodejs server already exists, port: ", " ." ].join(rendezvous.port);
                break;
            default : thecfg.msg = [ "exitValue( ", " )" ].join(thecfg.exitValue);
            }            
        return thecfg;
    },

    observe : function(asubject, atopic, adata)
    {    
        if (!(atopic == "nsPref:changed")) 
        {
            if (!(this.mode))
                if (this.running) 
                {
                    if (!(rendezvous.running))
                    {
                        rendezvous.doCmd("bot");
                    window.console.log(ADDON_ISBN, "start polling by idle");
                    }
                }
                else
                    document.getElementById("cmd_run").doCommand();
            return; // .addObserver( this, "user-interaction-inactive", false );
        }

        if((adata || "").indexOf(PREF_NOTIFY)) return;

        let theobj = this.storage.getItem(this.host);
            theobj = JSON.parse(theobj);
//  window.console.log("_dvk_dbg_, observe of storage: ", theobj);
        let topic = (theobj.topic || "");
        let oldvalue = this.running;
        if ("isRunning" in theobj) this.running = theobj.isRunning;
//        if (theobj.timeStamp == this.notifyTimeStamp) return;
        let value = [ "timeStamp", this.host ].join(".");
            value = this.storage.getItem(value);
            value = Number(value || "0") || parseInt(0);
//  avoid topic is not used notify subsystem
        if (this.timeStamp < value)
        {
            this.timeStamp = value, updateView();
            if (topic.contains("component-init")) return;
            if (this.running) return; // if cruise or internal error
            if ((oldvalue != this.running) || (theobj.class || "").contains("run"))
            {
                let thecfg = this.storage2cfg(theobj);
                    this.notify(thecfg);
                rendezvous.reset();
            }
        }
        return; //  "nsPref:changed" - PREF_NOTIFY
    },

    handleEvent : function(anevt)
    {
        let thebug = null;
        let target = anevt.target || {};
        if (anevt.currentTarget === window) // "unload"
        {
            if (this._isbn)
            {
                Services.prefs.removeObserver(PREF_NOTIFY, this);
                Services.obs.removeObserver( this, "user-interaction-inactive" );
            }   //  rendezvous.reset();            
        }
        else // if (anevt.type == "command")
        try {
            if (!((target.className || "").contains("clear"))) rendezvous.reset();
            switch (target.className) 
            {
            case "run"  : this.running = false; // revival by observer
                break;
            case "clear": cmdClear(target);
                break;
            case "mode" : this.mode = !(this.mode);
                break;
            default : // send btn
                let thenode = document.querySelector("textarea.send");
                let thestr = (thenode.value || "").replace(REGEX_TRIM, "");
                if (thestr.length || this.running)
                if (str2djb(thestr) != rendezvous.hash) // "raw" ?
                    rendezvous.doCmd((this.running) ? "gab" : "raw", thestr);
            }
        }
        catch (err) {   thebug = err;
            Components.utils.reportError(err);
        }
//        window.console.log("_dvk_dbg_, command: ", target.className);
        if (thebug) reportBug(thebug, "udp-read"); // i.e. handleEvent
    },

    notify : function(acfg)
    {
//  acfg.topic: "process-failed", "process-finished", 
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
        if (!acfg) return; // guard

        let icon  = "warning-16.png";
        let label = [ acfg.topic, acfg.msg ].join(', ');
        let value = acfg.exitValue;
        switch (acfg.topic) {
            case "process-failed"  : value = value || ERROR_UNEXPECTED;
            case "informal-packet" : 
            case "process-finished": break;
            default : icon = "error-16.png";
            value = value || ERROR_UNEXPECTED;
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
        thenode.setAttribute("style", "opacity: 0");
        window.setTimeout(function(anode) { anode.removeAttribute("style") }, 0, thenode);
        let thelast = thebox.lastElementChild;
        if (isEqualNotification(thenode, thelast))
        {
            label = (thelast.querySelector("span") || {}).textContent;
            value = (label || "").match(/\w+/) || ([ "0" ]);
            value = (parseInt((value[0] || "0").trim()) || parseInt(1)) + 1;
            let thespan = thenode.querySelector("span");
                thespan.textContent = [ " (", ") " ].join(value);
            thebox.replaceChild(thenode, thelast);
        }
            else thebox.appendChild(thenode);
        return;
    }   //  notify : function(acfg)
}
/*  function notificationClick(abox)
    let thenode = document.getAnonymousElementByAttribute(abox, "anonid", "details");
    if ((thenode || {}).nextElementSibling)
        thenode.nextElementSibling.focus(); */
function updateView()
{
    ++nodemsg.counter;
    window.setTimeout( function(alevel) {
        if (nodemsg.counter == alevel) nodemsg.innerUpdateView();
    }, (INTERVAL * 2), nodemsg.counter );
}

function happening(anevt)
{
    nodemsg.focusedbtn = null;
    updateView();   // usual command
    if (!(anevt.target.hasAttribute("checked")))
    document.querySelector(".transmitter > .timeStamp").value = "";
}

function hideLine()
{
    if (nodemsg.focusedbtn) nodemsg.focusedbtn.close(); 
    nodemsg.focusedbtn = null;
}

function copyLine()
{
    let thenode = nodemsg.focusedbtn || document.querySelector("notification:hover");
    if (!thenode) thenode = document.querySelector("vbox.notificationbox").lastElementChild;    
    const gClipboardHelper = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
                                    .getService(Components.interfaces.nsIClipboardHelper);
    gClipboardHelper.copyString( thenode.label || thenode );    
}

function updateMenu(anevt)
{
//    window.console.log("updateMenu: ", document.querySelector("*:focus").tagName);
    if (!(nodemsg.focusedbtn)) nodemsg.focusedbtn = document.querySelector("notification:hover");
    let parent = (nodemsg.focusedbtn || {}).parentNode || {};
    document.getElementById("cmd_copy").setAttribute("disabled", (nodemsg.focusedbtn) ? "false" : "true");
    let newval = (!(nodemsg.focusedbtn)) || (parent.firstElementChild === nodemsg.focusedbtn);
    document.getElementById("cmd_hide").setAttribute("disabled", (newval) ? "true" : "false");
//    window.console.log("updateMenu: ", document.querySelector("notification:hover"));
}

function cmdClear(acmd)
{
    let textarea = document.querySelector("textarea.send");
    if ((textarea.value || "").length) textarea.value = "";
    else
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
}

window.addEventListener( "unload", nodemsg, false );
    nodemsg.initialize();
//    .setTimeout( function() { window.location.href = classDescription }, 0 );
