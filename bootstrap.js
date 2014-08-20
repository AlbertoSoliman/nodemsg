"use strict";

Components.utils.import("resource://gre/modules/Services.jsm")
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm")
Components.utils.import("resource://gre/modules/Timer.jsm")
//mponents.utils.import("chrome://nodemsg/content/include.jsm")
const   MAIN_WINTYPE	= "navigator:browser"
const   PREF_FIRST      = "extensions.nodemsg.firstLaunch"
const   PREF_NODE_EXE	= "extensions.nodemsg.localNode"
const   PREF_ADDRESS    = "extensions.nodemsg.multiAddr"
const   PREF_PORT       = "extensions.nodemsg.sharedPort"
const   PREF_NEW_WIN	= "extensions.nodemsg.openNewWin"
    //nst   PREF_NOTIFY     = "extensions.nodemsg.notify"
const   SET_OF_PREFS    = [ PREF_NODE_EXE, PREF_ADDRESS, PREF_PORT, PREF_NEW_WIN ]

const   WINOS_NODEJS    = "C:\\Program Files\\nodejs\\node.exe"
const	XUL_NAMESPACE	= "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"
const	XUL_CMD_ISBN	= "nodemsg_cmd_openMainPage"
const	XUL_CMD_MENU	= "nodemsg_menu_openMainPage"
const	XUL_CMD_LABEL   = "Node Messenger"
const	OPTION_STYLESHEET = "chrome://nodemsg/skin/options.css"
    //nst   ADDON_ISBN      = "nodemsg@code.google.com"
    //nst   ABOUT_CONTENT	= "chrome://nodemsg/content/content.xul"
const   ABOUT_CONTRACT	= "@mozilla.org/network/protocol/about;1?what=nodemsg"
const	Ci = Components.interfaces;

var AboutSitename = {
    classDescription: "about:nodemsg",
    contractID:	ABOUT_CONTRACT,
    classID:	Components.ID("{E954D866-A810-4064-ABBF-96AA30588036}"),
//Note: classID here should be exactly the same as CID in chrome.manifest
    QueryInterface: XPCOMUtils.generateQI([Ci.nsISupports, Ci.nsIFactory, Ci.nsIAboutModule]),
    getURIFlags: function(aURI) { return Ci.nsIAboutModule.ALLOW_SCRIPT },
    newChannel: function(aURI) {
//  let ios = Components.classes["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
        let channel = Services.io.newChannel( ABOUT_CONTENT, null, null );
            channel.originalURI = aURI;
        return channel;
    },

    registerFactory: function(aload)
    {
	   let theobj = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
	   if (theobj) 
	       if (aload) theobj.registerFactory( 
                    this.classID,       // The ClassID of the class being registered.
                    this.classDescription, // The name of the class being registered. 
                    this.contractID,    // The ContractID of the class being registered.
                    this );     // The nsIFactory instance of the class being registered.
            else theobj.unregisterFactory( this.classID, this );
    },
    
    createInstance: function(outer, iid)
    {
	   if (outer) throw(Components.results.NS_ERROR_NO_AGGREGATION);
	   return this.QueryInterface(iid);
    },
    lockFactory: function(alock) {
	   throw(Components.results.NS_ERROR_NOT_IMPLEMENTED);
    }
};  // var AboutSitename = {

  // We shouldn't start up here; startup() will always be called when
  // an extension should load, and install() sometimes gets called when
  // an extension has been installed but is disabled.
function install(data, areason)
{
}

  // We shouldn't shutdown here; shutdown() will always be called when
  // an extension should shutdown, and uninstall() sometimes gets
  // called when startup() has never been called before it.
function uninstall(data, areason)
{
    Services.prefs.setIntPref(PREF_NOTIFY, 0);
    if (areason != ADDON_UPGRADE)   // TODO: test.
        SET_OF_PREFS.forEach( function(anattr)
            { Services.prefs.deleteBranch(anattr) } );
//    Services.prefs.deleteBranch(PREF_NOTIFY);
}

var gWinobserver = {
    handleEvent : function(anevt)
    {
        let mainwin = anevt.currentTarget;
//	if (anevt.type == "DOMContentLoaded")
        let thedoc = anevt.target.documentElement;
        if (thedoc)  //  top document plus documentElement
        if (anevt.target === anevt.currentTarget.document)
        try {
            if (thedoc.getAttribute("windowtype") == MAIN_WINTYPE)
                loadOverlay(mainwin);
        }
        catch (err) {
            Components.utils.reportError(err)
        }
	       else mainwin = null; // wait for top window ?

        if (mainwin) mainwin.removeEventListener(anevt.type, this, false);
    },   //  handleEvent

    observe: function(asubject, atopic, data)
    {
    //  aSubject - the window being opened or closed,
    //  sent as an nsISupports which can be nsISupports.QueryInterface()
    //      (QueryInterfaced) to an nsIDOMWindow.
        if (atopic === "domwindowopened")
            asubject.addEventListener("DOMContentLoaded", this, false);
        else {
            dump("_dvk_dbg_, observe:\t"); dump(atopic);
            dump("\n"); //  TODO:   "domwindowclosed", clearing sub system.
        }
    //lse Components.utils.reportError(["Unexpected topic for observer", atopic ].join(": "));
    //  asynchronous loading plus check type of window
    }    
} // gWinobserver

function loadOverlay(awindow)
{
    function openManePage(awindow)  //  cmd
    {
        let thespec = AboutSitename.classDescription;
        try {
            let retval = awindow.switchToTabHavingURI(thespec, false);
            let thenew = Services.prefs.getBoolPref(PREF_NEW_WIN);
            if (retval) //  TODO: check arg's of reload.
                setTimeout( function() {
                    Services.ww.activeWindow.content.location.reload()
                }, 0 )   //  thewin.gBrowser.selectedBrowser.reload()
                else awindow.openUILinkIn(thespec, (thenew) ? "window" : "tab");
        }
        catch (err) {
            Components.utils.reportError(err)
        }
    }
//    awindow.addEventListener("load", gWinobserver, true);
//    awindow.addEventListener("pageshow", gWinobserver, true);  
    let thedoc = awindow.document;
    let thecmd = thedoc.createElementNS(XUL_NAMESPACE, "command");
        thecmd.setAttribute("id", XUL_CMD_ISBN);
        thecmd.setAttribute("disabled", "true");
    let thenode = thedoc.getElementById(XUL_CMD_ISBN);
    if (thenode)
	thenode = thenode.parentNode.replaceChild(thecmd, thenode);
    else {
	thenode = thedoc.documentElement.querySelector("commandset");
	thenode = thenode.parentNode.insertBefore(thecmd, thenode.nextElementSibling);
    }

    if (!thenode) return;

    thenode.addEventListener("command", function(anevt) { openManePage(awindow) }, false);
    thenode.removeAttribute("disabled");

//    let themenu = thedoc.querySelector("menupopup");
    let thebody = thedoc.getElementById("menu_ToolsPopup");
    if (!thebody) return;
    //  menuseparator
    let thename = (thebody.lastElementChild.tagName || "").toLowerCase();
    if (thename.indexOf("menuseparator") < 0)
        thebody.appendChild(thedoc.createElementNS(XUL_NAMESPACE, "menuseparator"));

    let themenu = thedoc.createElementNS(XUL_NAMESPACE, "menuitem");
        themenu.setAttribute("id", XUL_CMD_MENU);
        themenu.setAttribute("command", XUL_CMD_ISBN);
        themenu.setAttribute("label", XUL_CMD_LABEL);
    thebody.appendChild(themenu);
    
    return; //  TODO: load *.xul to browser
}

var gInlineObserver = {
    launch      : null,

    observe: function(adoc, aTopic, aData)
    {
        if(aTopic === "addon-options-displayed")
        if(aData === ADDON_ISBN)
        try {
        let thebody = adoc.documentElement.querySelector("setting.nodemsg[type='control']");
        let thenode = thebody.querySelector("label.text-link");
            thenode.addEventListener("click", this, false);
            thenode = thebody.querySelector("image.text-link");
            thenode.addEventListener("click", this, false);
            thenode = thebody.querySelector("button.test");
            thenode.addEventListener("command", this, false);
            
            thebody = adoc.documentElement.querySelector("setting.nodemsg[type='integer']");
            thenode = adoc.getAnonymousElementByAttribute(thebody, "anonid", "input");
            if (thenode)
            {
                thenode.removeAttribute("flex");
                thenode.clickSelectsAll = true;
                thenode = adoc.getAnonymousElementByAttribute(thenode, "flex", "1");
                if (thenode) {
                    thenode.removeAttribute("flex");
                    thenode = adoc.getAnonymousElementByAttribute(thenode, "anonid", "input");
                    if (thenode) thenode.classList.remove("textbox-input");
                }
            }
            
            thebody = adoc.documentElement.querySelector("setting.nodemsg[type='string']");
            thenode = adoc.getAnonymousElementByAttribute(thebody, "anonid", "input");
                if (thenode) thenode.removeAttribute("flex");
            
        let theline = [ 'href="', '" type="text/css"' ].join(OPTION_STYLESHEET);
        let thepi = adoc.createProcessingInstruction('xml-stylesheet', theline);
                adoc.insertBefore(thepi, adoc.documentElement);
        }
        catch (err) { // TODO: below is commented, since exception by design. 
            Components.utils.reportError(err)
        }
    },

    testExcmd : function(awin)
    {
        var thescript = NODE_SCRIPT;
        try {
            AddonManager.getAddonByID( ADDON_ISBN, function(addon) 
            {
                let addonLocation = addon.getResourceURI(thescript).QueryInterface(Ci.nsIFileURL).file.path || "";
//                addonLocation = addonLocation.trim().replace( /(^"+)|("+$)/g , "" );
                if (!(addonLocation.length)) addonLocation = thescript;
//                anevt.target.disabled = true;
                setTimeout( function() {
                    gInlineObserver.testNodeMainjs(awin, addonLocation);
                }, 0 );
            }); // .AddonManager.getAddonByID( this.ADDON_ISBN, function(addon) 
        }
        catch (err) {
            Components.utils.reportError(err)
        }
    },

    handleEvent : function(anevt)
    {
        let thewin = null;
        switch (anevt.type) {
        case "click": 
            let thecmd = null;
            let thedoc = (Services.ww.activeWindow || {}).document;
            if (thedoc) thecmd = thedoc.getElementById(XUL_CMD_ISBN);
            if (thecmd) thecmd.doCommand();
        break;
                
        case "command": 
            thewin = (anevt.target.ownerDocument || {}).defaultView;
            if (thewin) thewin.setTimeout( function(aself, awin) {
                        aself.testExcmd(awin);
                    }, 0, this, thewin );
//        break;
        default : // "unload", "pagehide"
            if (!thewin) this.jsm = {};
            let thelaunch = (this.launch || {});
                this.launch = null;
            if (thelaunch.isRunning) thelaunch.kill();
        }
    },

    testNodeMainjs : function(awin, ascript)
    {
        let commonerr = "Script does not exist - ".concat(ascript);
        var thecmd = Services.prefs.getCharPref(PREF_NODE_EXE) || "";
//      if (thecmd.length) thecmd = [ thecmd, ascript ].join(" ");
        var process = this.launch = Components.classes["@mozilla.org/process/util;1"].createInstance(INTERFACE_PROCESS);
        let ObserverHandler = {

			observe: function(subject, topic, data) 
            {
                let themsg = "all right";
                if (gInlineObserver.launch)
                switch (topic) {
                    case "process-failed": 
                        themsg = [ (thecmd || ascript), process.exitValue ];
                        themsg = themsg.join(", exit value: ");
                    case "process-finished": break;
                    default : return;
                }
                    else return;

                awin.removeEventListener("unload", gInlineObserver, false);
                awin.removeEventListener("pagehide", gInlineObserver, false);
                awin.console.log( topic, "exitValue: ", process.exitValue );
                if (process.exitValue) topic = "process-failed";
                Services.prompt.alert( awin, topic, themsg );
                return; // observe of launch.runwAsync
			}            
        }

        try {
        let thefile = Components.classes["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
            thefile.initWithPath(ascript);
        if (!(thefile.exists())) throw( Components.results.NS_ERROR_FILE_TARGET_DOES_NOT_EXIST );
        if (!(thefile.isFile())) throw( Components.results.NS_ERROR_FILE_IS_DIRECTORY );

        let permissions = (thefile.permissions || "").toString();
        if (!(isWinOS()) && (permissions.length >> 1))
        {
    //  TODO: test ?
            let thenum = parseInt(permissions[1] || "0");
            if (thenum == ((thenum >> 1) << 1))
            {
                    thenum >>= 1;   // even, i.e. no permission to execute
                thenum = (thenum == ((thenum >> 1) << 1)) ? 5 : 7;
                thenum = [ permissions[0], (permissions[2] || "0") ].join(thenum);
                thefile.permissions = parseInt(thenum);
            awin.console.info(ADDON_ISBN, "permissions to main script is changed");
            awin.console.info(ADDON_ISBN, ", old value: ", permissions, ", new value: ", thefile.permissions);
            }
        }

            if (!thecmd) thecmd = (isWinOS()) ? "node.exe" : "node";
        {
            awin.console.info(ADDON_ISBN, "script permissions: ", thefile.permissions);
            awin.console.info(ADDON_ISBN, "external cmd:");
            awin.console.info(thecmd, " ", ascript);
        }
            let theport = Services.prefs.getIntPref(PREF_PORT);
            if (!theport) Services.prefs.setIntPref(PREF_PORT, (theport = 8181));
            let theline = [ "--once", "-p", theport ];
            if (thecmd)
            {
                commonerr = "Node is not found - ".concat(thecmd);
                thefile.initWithPath(thecmd);
                if (!(thefile.exists())) throw( Components.results.NS_ERROR_FILE_TARGET_DOES_NOT_EXIST );
                //row new Components.Exception(commonerr, Components.results.NS_ERROR_FILE_TARGET_DOES_NOT_EXIST );
                if (!(thefile.isFile())) throw( Components.results.NS_ERROR_FILE_IS_DIRECTORY );
//                  throw new Components.Exception(commonerr, Components.results.NS_ERROR_FILE_IS_DIRECTORY );                
                theline = [ "--once", "-p", theport ];
            }

            awin.addEventListener("unload", this, false);
            awin.addEventListener("pagehide", this, false);
            this.launch.init(thefile);
            this.launch.runwAsync( theline, theline.length, ObserverHandler );

        }
        catch (err) {
            Components.utils.reportError(err);
            if (err.name) Services.prompt.alert( awin, err.name, err.message );
                else awin.alert(err.message);            
        }
    }
}	//	gInlineObserver.testNodeMainjs

function setDefaultPrefs(areason)
{
    function getLastToken(astr)
    {
	    let thepos = astr.lastIndexOf(".") + 1;
	    if (thepos >> 1) //get suffix and set true
            return astr.substr(thepos);
        return astr;
    }

    let thebranch = PREF_FIRST.split(".");
    if (thebranch.length < 3) return;

    let thename = thebranch.pop();
	thebranch = PREF_FIRST.replace((".").concat(thename), ".");
	thebranch = Services.prefs.getDefaultBranch(thebranch);
//	thebranch.setBoolPref(thename, (areason != APP_STARTUP));
    thebranch.setCharPref(getLastToken(PREF_ADDRESS), MULTI_ADDR);
    thebranch.setIntPref(getLastToken(PREF_PORT), 8181);
    thebranch.setIntPref(getLastToken(PREF_NOTIFY), 0);
	thebranch.setBoolPref(getLastToken(PREF_NEW_WIN), false);

        thename = getLastToken(PREF_NODE_EXE);
    if (isWinOS()) // winnt
    try {
        thebranch.setCharPref(thename, "node.exe");
    let thefile = Components.classes["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
            thefile.initWithPath(WINOS_NODEJS);
        if (thefile.exists())
            if (thefile.isFile()) 
                thebranch.setCharPref(thename, WINOS_NODEJS);
    }
    catch (err) {
	   Components.utils.reportError(err)
    }
        else thebranch.setCharPref(thename, "node");
}   //   setDefaultPrefs(areason)

function startup(data, areason)
{
    Components.utils.import("chrome://nodemsg/content/include.jsm");
    setDefaultPrefs(areason);
    Components.utils.import("chrome://nodemsg/content/component.jsm");

    Services.obs.addObserver(gInlineObserver, "addon-options-displayed", false);
    let thebrowsers = Services.wm.getEnumerator(MAIN_WINTYPE);
    while (thebrowsers.hasMoreElements())
    {
        let thewin = thebrowsers.getNext();
            loadOverlay(thewin);
    }
    //  Services.obs.addObserver(gWinobserver, "content-document-global-created", false);
    try {
        Services.ww.registerNotification(gWinobserver);
        NodeMonitor.registerFactory(true);
        AboutSitename.registerFactory(true);
    }
    catch (err) {
	   Components.utils.reportError(err)
    }
}

function clearStorage()
{
    try {
        let uri = Services.io.newURI(ABOUT_CONTENT, null, null);
        let principal = Services.scriptSecurityManager.getNoAppCodebasePrincipal(uri);
            Services.domStorageManager.getStorage(principal, "").clear();
    }
    catch(err) {    // TODO: comment.
        Components.utils.reportError(err);
    }
}

function shutdown(data, areason)
{
    function closeURIInWindow(aWindow) 
    {
        let browsers = aWindow.gBrowser.browsers;
        for (let i = 0; i < browsers.length; i++) 
        {
            let browser = browsers[i];
            let thestr = (browser.currentURI.spec || "").toLowerCase();
            if (thestr.startsWith(AboutSitename.classDescription))
                browser.loadURI("about:newtab", null, null);
//            aWindow.focus(); // Focus the matching window & tab
//            aWindow.gBrowser.tabContainer.selectedIndex = i;
        }
    }

    AboutSitename.registerFactory(false);
    NodeMonitor.registerFactory(false);
    //  Services.obs.removeObserver(gWinobserver, "content-document-global-created");
    Services.ww.unregisterNotification(gWinobserver);
        NodeMonitor.killNodejs();

    let thebrowsers = Services.wm.getEnumerator(MAIN_WINTYPE);
    if (areason == APP_SHUTDOWN) {
        //  TODO: clear storage.    clearStorage();
    }
    else
    while (thebrowsers.hasMoreElements())
    {
        let thewin = thebrowsers.getNext();
        let thedoc = thewin.document;
        if (!(thewin.closed) && thedoc)
        try {
            let themenu = thedoc.getElementById(XUL_CMD_MENU);
            if (themenu)
            {
                let thenode = themenu.parentNode;
                    thenode.removeChild(themenu);
                    themenu = thenode.lastElementChild || {};
                let thestr = (themenu.tagName || "").toLowerCase();
                if (thestr.endsWith("menuseparator"))
                    thenode.removeChild(themenu);
            }

            let thenode = thedoc.getElementById(XUL_CMD_ISBN);
            if (thenode) thenode.parentNode.removeChild(thenode);
            if (themenu || thenode) closeURIInWindow(thewin);
        }
        catch (err) {
            Components.utils.reportError(err)
        }
    }   //  if(areason != APP_SHUTDOWN)

    Services.obs.removeObserver(gInlineObserver, "addon-options-displayed");
        gInlineObserver.handleEvent({}); // type = "unload" || "pagehide"
    if(areason == ADDON_UNINSTALL) uninstall(data, areason);
    //  dump("shutdown, ");    dump("reason:\t");    dump(areason); dump("\n");
}
