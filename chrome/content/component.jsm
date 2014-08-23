"use strict";

const Ci = Components.interfaces
const PREF_NODE_EXE	= "extensions.nodemsg.localNode"
const PREF_ADDRESS  = "extensions.nodemsg.multiAddr"
const PREF_PORT     = "extensions.nodemsg.sharedPort"

Components.utils.import("resource://gre/modules/Services.jsm")
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm")
Components.utils.import("resource://gre/modules/Timer.jsm")
Components.utils.import("chrome://nodemsg/content/include.jsm")

var cartridge = { //  host { demon, [ content ] }

    filter : function(asbn)
    {
        let retval = false;
        //  if (this.hasOwnProperty(ahost))
        if (asbn)
        for each (let entrance in this)
        if (!(entrance instanceof Function))
        {
            let content = entrance.content || [];
            let thelen = content.length;
            if (thelen) entrance.content = content.filter( 
                function(anwin) { return (anwin != asbn) } );
            if (entrance.content)
                if (!(entrance.content.length)) 
                    retval = true;
        }
        if (retval) setTimeout( function() { cartridge.clear() }, 1 );
    },

    filterByWin : function(awindow)
    {
        try {
        let neowin = awindow.QueryInterface(Ci.nsIInterfaceRequestor)
                        .getInterface(Ci.nsIDOMWindowUtils) || {};
        this.filter(neowin.currentInnerWindowID);
        }
        catch (err) {
            Components.utils.reportError(err)
        }
    },
    
//  in: pair [ host, .getInterface(Ci.nsIDOMWindowUtils).currentInnerWindowID ]
//  out: location or currentInnerWindowID from @in
    push : function(ahost, asbn)
    {
        if ((ahost || "").indexOf(":") < 0)
            throw(Components.results.NS_ERROR_UNKNOWN_HOST);
        this.filter(asbn);
        if ("content" in (this[ ahost ] || {})) 
        {
            this[ ahost ].content.push(asbn);
            return this[ ahost ].location || asbn;
        }
        else
            if (ahost in this) this[ ahost ].content = [ asbn ];
                else this[ ahost ] = { "content": [ asbn ] };
        return asbn;
    },

    clear : function()
    {
        let retval = [];
        for (let thehost in this)
        if (!(this[thehost] instanceof Function))
        {
            let content = this[thehost].content || [];
            if (!(content.length)) retval.push(thehost);
        }

        retval.forEach( function(ahost)
        {
            if (this.hasOwnProperty(ahost))
            {
                let thelaunch = this[ahost].demon || {};
                    delete this[ahost];
                if (thelaunch.isRunning) thelaunch.kill();
            }
        }, this);
        
    },

    isbn2demon : function (awindow)
    {
        let retval = { "isRunning": false };
        let isbn = awindow.QueryInterface(Ci.nsIInterfaceRequestor)
                    .getInterface(Ci.nsIDOMWindowUtils).currentInnerWindowID;
        for each (let entrance in this) // if (this.hasOwnProperty(ahost))
        if (!(entrance instanceof Function))
        {
            let content = entrance.content || [];
            if (content.indexOf)
            if (content.indexOf(isbn) + 1)
                return entrance.demon || retval;
        }
        return retval;
    }

}

var notify5pref = {
    storage:   null,
    doCmd : function(ahost, adelay)
    {
        let ahost = [ "timeStamp", ahost ].join(".");
        if (adelay) adelay = parseInt(adelay);
        if (adelay) setTimeout( function(ahost) {
                let counter = Services.prefs.getIntPref(PREF_NOTIFY) || parseInt(0);
                notify5pref.storage.setItem( ahost, Date.now() );
                if (++counter) Services.prefs.setIntPref(PREF_NOTIFY, counter);
            }, adelay, ahost )
        else {
            let counter = Services.prefs.getIntPref(PREF_NOTIFY) || parseInt(0);
            this.storage.setItem( ahost, Date.now() );
            if (++counter) Services.prefs.setIntPref(PREF_NOTIFY, counter);
            return counter;
        }
        return 0;
    }
}

function bug2storage(atopic, abug)
{
    let thebug = { "msg": abug.message, "name": abug.name }
    return {    //  "code": abug.result, 
        "isRunning" : false,
        "topic"     : atopic,
        "bug"       : JSON.stringify(thebug),
        "timeStamp" : Date.now()
    }
}

function OnceObserve(ahost)
{
    this.host = ahost;
}

var NodeMonitor = {
    classID :	Components.ID("{E954D866-A810-4064-ABBF-96AA30588037}"),
    resource:   NODE_SCRIPT, 
    _storage:   null,  
//    launch  :   null,   //  "host" : { "component": node-exe, list: [win-id]
    QueryInterface: XPCOMUtils.generateQI([
                        Ci.nsISupports, Ci.nsIFactory, 
                        Ci.nsIInterfaceRequestor,
                        Ci.nsIDOMGlobalPropertyInitializer ]),

    getInterface : function(uuid) { // in nsIIDRef uuid
        if (uuid.equals(Ci.nsIDOMStorage))
            return this.storage.QueryInterface(Ci.nsIDOMStorage);
        return this.QueryInterface(uuid);
    },

    registerFactory: function(aload)
    {
	   let theobj = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
	   if (theobj) 
	       if (aload) theobj.registerFactory( 
                    this.classID,       // The ClassID of the class being registered.
                    null,
                    null,       // The ContractID of the class being registered.
                    this );     // The nsIFactory instance of the class being registered.
            else theobj.unregisterFactory( this.classID, this );
    },

    createInstance: function(outer, iid)
    {
	   if (outer) throw(Components.results.NS_ERROR_NO_AGGREGATION);
	   return this.QueryInterface(iid);
    },
//    get wrappedJSObject() this,
    get salute () 
    {
        let saluteAck  = "have opened page of Node Messenger.";
        let themsg = [ Services.appinfo.name, Services.appinfo.OS ].join(" of ");
        let version = [ "(", ")" ].join(Services.appinfo.version);
        return [ themsg, version, saluteAck ].join(" ");
    },

    updateItem : function(ahost, newvalue)
    {
        if (newvalue instanceof String) this._storage.setItem(ahost, newvalue);
            else this._storage.setItem(ahost, JSON.stringify(newvalue));
    },

    get storage ()
    {
        if (!(this._storage))
        {
            let uri = Services.io.newURI(ABOUT_CONTENT, null, null);
            let principal = Services.scriptSecurityManager.getNoAppCodebasePrincipal(uri);
            this._storage = Services.domStorageManager.createStorage(principal, "");
                notify5pref.storage = this._storage;
        }
        return this._storage;
    },
//          let aDocShell = mainwin.gBrowser.selectedBrowser.docShell;
  //          let principal = Services.scriptSecurityManager.getDocShellCodebasePrincipal(uri, aDocShell);
    //        let storageManager = aDocShell.QueryInterface(Ci.nsIDOMStorageManager);
    clearStorage : function(ahost)
    {
        if (ahost) 
        try {
            this._storage.removeItem(ahost);
//                ahost = [ "timeStamp" , ahost ].join(".");
//            this._storage.removeItem(ahost);                
        }
        catch(err) {    // TODO: comment.
            Components.utils.reportError(err);
        }
    },
    
    killNodejs : function()
    {
        try {   //  dump("\n_dvk_dbg_, killNodejs\n");
            for each (let entrance in cartridge)
            if (!(entrance instanceof Function))
                if (entrance.demon)
                    entrance.content = [];
            cartridge.clear();
        }
        catch(err) {
//            Components.utils.reportError(err);
        }
    },

    runNodeMainjs : function(awin, adoc, ahost)
    {
//        let theform = adoc.querySelector("form");
  //      let thehost = [ theform.addr.value, theform.port.value ];
        let thenode = adoc.querySelector("textbox.ack");
            thenode.value = "";
        cartridge[ ahost.join(":") ].demon = null;

        let thecmd = Services.prefs.getCharPref(PREF_NODE_EXE) || "";
        //t commonerr = "Script does not exist - ".concat(this.resource);
        let thelaunch = Components.classes["@mozilla.org/process/util;1"].createInstance(INTERFACE_PROCESS);
//            awin.console.log(ADDON_ISBN, ", Process: ", thelaunch);
        let thefile = Components.classes["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
            thefile.initWithPath(this.resource);
        if (!(thefile.exists())) throw(Components.results.NS_ERROR_FILE_TARGET_DOES_NOT_EXIST);
        if (!(thefile.isFile())) throw(Components.results.NS_ERROR_FILE_IS_DIRECTORY);

        {
            awin.console.log(ADDON_ISBN, ", script permissions: ", thefile.permissions);
            awin.console.log(ADDON_ISBN, ", external cmd:");
            awin.console.log(thecmd, " ", this.resource);
        }

        if (!thecmd) thecmd = (isWinOS()) ? "node.exe" : "node"; // since shebang is flagged
        cartridge[ ahost.join(":") ].location = thenode.value = ( thecmd || "/usr/bin/env node" );
        let theline =  ["-a", ahost[0], "-p", ahost[1] ];
        if (thecmd)
        {
            thefile.initWithPath(thecmd);
            if (!(thefile.exists())) throw(Components.results.NS_ERROR_FILE_TARGET_DOES_NOT_EXIST);
            if (!(thefile.isFile())) throw(Components.results.NS_ERROR_FILE_IS_DIRECTORY);
            theline.unshift(this.resource);
        }

        ahost = ahost.join(":");
        let theobj = new OnceObserve(ahost, this.storage);
            thelaunch.init(thefile);
            thelaunch.runwAsync( theline, theline.length, theobj );
            cartridge[ ahost ].demon = thelaunch;
    },   //      runNodeMainjs : function(awin, ascript)

    handleEvent : function(anevt)
    {
        if (anevt.type != "command")
        {
            cartridge.filterByWin(anevt.currentTarget);
            return; // "pagehide", "unload"
        }

    //  requisite:
        let thedoc = anevt.target.ownerDocument;
        let thewin = (thedoc || {}).defaultView;
            thedoc =  thedoc.documentElement;
        if (anevt.currentTarget === thewin) return;
        if (!thewin || !thedoc) return; //  requisite:

        let therun = anevt.currentTarget.classList.contains("run");
        let theform = thedoc.querySelector("form");
        var thehost = [ theform.addr.value, theform.port.value ];
        let thebug = null, thelaunch = cartridge.isbn2demon(thewin) || {};
        try {
            if (therun)
            {
                let thaddr = thehost.join(":");
                if (thelaunch.isRunning) thelaunch.kill();
                else if (!(thaddr in cartridge))
                    throw(Components.results.NS_ERROR_NOT_INITIALIZED);
                thelaunch = { "isRunning": false, "exitValue": 0 };
                this.updateItem( thaddr, thelaunch );
                this.runNodeMainjs( thewin, thedoc, thehost );
            }
        }
        catch (err) {
            Components.utils.reportError(thebug = err);
            thewin.console.warn(ADDON_ISBN, "process-run: ", anevt);
            thewin.console.warn(ADDON_ISBN, err);
        }

        let theobj = { "topic": "process-failed", 
                        "isRunning": false, 
                        "exitValue": 0 }; // notifying by send btn
            thehost = thehost.join(":");

        if (thebug) theobj = bug2storage("process-run", thebug);
        else
            if (therun)
            {
                setTimeout( function() {
                    if ((cartridge[thehost].demon || {}).isRunning)
                    NodeMonitor.updateItem(thehost, { "isRunning": true, "exitValue": 0 });
                }, 0 );
                notify5pref.doCmd( thehost, 1 );
                return;
            }

        if (!(thelaunch.isRunning))
        {
            if (therun) theobj["class"] = "run"; // urgency, in other words
            this.updateItem(thehost, theobj);
    //        setTimeout( function() { notify5pref(NodeMonitor.host) }, 1 );
            notify5pref.doCmd( thehost);
        }
        return; // handleEvent : function(anevt)
    },

    init: function(awindow) // jsval init(in nsIDOMWindow window);
    {
        let retval = { "salute": "not initialized state" }, thebug = null;
        let thaddr = (Services.prefs.getCharPref(PREF_ADDRESS) || "").trim();
            retval.port = Services.prefs.getIntPref(PREF_PORT);
            retval.addr = thaddr || MULTI_ADDR;
        let thehost = [ retval.addr, retval.port ].join(":");
        try {
            var theself = this;
            AddonManager.getAddonByID( ADDON_ISBN, function(addon) 
            {
                let addonLocation = addon.getResourceURI(NODE_SCRIPT).QueryInterface(Ci.nsIFileURL).file.path;
                    theself.resource = addonLocation || theself.resource;
            } ); // .AddonManager.getAddonByID( this.ADDON_ISBN, function(addon)

            awindow.addEventListener("pagehide", this, false);
            awindow.addEventListener("unload", this, false);
//            awindow.console.log("_dvk_dbg_, NodeMonitor: init");
            let thebtn = awindow.document.getElementById("cmd_run");
                thebtn.addEventListener("command", this, true);
            thebtn = awindow.document.getElementById("cmd_send");
                thebtn.addEventListener("command", this, true);
//   TODO: retval - addr, port (host), isbn (cookie), salute
            //  test tail of documentURIObject.path
            retval.salute = this.salute;
            retval.isbn = awindow.QueryInterface(Ci.nsIInterfaceRequestor)
                            .getInterface(Ci.nsIDOMWindowUtils).currentInnerWindowID;
//                cartridge[ thehost ].content.push(retval.isbn);
            if (!(thehost in cartridge)) this.clearStorage(thehost);
            retval.isbn = cartridge.push(thehost, retval.isbn);
        }
        catch (err) {
            Components.utils.reportError(thebug = err);
        }
//    awindow.console.log("init: ", thehost);
        if (thebug)
        {
            let theobj = bug2storage("component-init", thebug);
            let entrance = cartridge[ thehost ] || {};
            if (entrance.demon) theobj.isRunning = entrance.demon.isRunning;
            this.updateItem( thehost, theobj );
        }
        return retval;
    },
//  finalize: function(awindow) { dump("\n_dvk_dbg_, NodeMonitor: finalize\n") },
//    __exposedProps__ : { finalize : "r" },
    lockFactory: function(alock) {
	   throw(Components.results.NS_ERROR_NOT_IMPLEMENTED);
    }
}  // var NodeMonitor = {

OnceObserve.prototype = {
    //    this.wrappedJSObject = this;
    observe: function(subject, topic, data) 
    {
        let thedemon = (cartridge[this.host] || {}).demon;
        if (thedemon)
        switch (topic) {
            case "process-failed" : 
            case "process-finished": break;
            default : return;
        }
            else return;
//      awin.console.log( topic, "exitValue: ", process.exitValue );
        let theobj = { "topic": topic, "isRunning": false,
                        "exitValue": thedemon.exitValue };
        NodeMonitor.updateItem( this.host, theobj );
        notify5pref.doCmd(this.host);
        return; // observe of launch.runwAsync
    }
}   //  OnceObserve.prototype = {

var EXPORTED_SYMBOLS = [ "NodeMonitor" ]
