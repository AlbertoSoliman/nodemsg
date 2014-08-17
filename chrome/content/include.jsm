"use strict";

Components.utils.import("resource://gre/modules/Services.jsm")

const ABOUT_CONTENT = "chrome://nodemsg/content/content.xul"
const ADDON_ISBN    = "nodemsg@code.google.com"
const PREF_NOTIFY   = "extensions.nodemsg.notify"
const MULTI_ADDR    = "255.255.255.255" // "192.168.1.255"
const NODE_SCRIPT   = "main.js"
const ADDON_MANAGER = "resource://gre/modules/AddonManager.jsm"
const AddonManager  = function() {  let thejsm = {};
                            Components.utils.import(ADDON_MANAGER, thejsm);
                            return thejsm.AddonManager; } ();
function isWinOS()
{
    let thetag = (Services.appinfo.OS || "").toUpperCase();
        return thetag.startsWith("WIN");   // winnt
}

var EXPORTED_SYMBOLS = [ "isWinOS", "AddonManager",
        "ABOUT_CONTENT", "MULTI_ADDR", "ADDON_ISBN", 
        "PREF_NOTIFY", "NODE_SCRIPT"   ]
