import path from "path";
import utils from "node-pearls";
import parse from "./src/parse";

const depPackages = ["react", "fbjs"];

const setupMod = "InitializeJavaScriptAppEngine";

const extensions = ["", ".native.js", ".js", "/index.js"];

export default function(reactNativeDir, platform){
	var dirs = depPackages.map(function(modName){
		return utils.findNodeModules(reactNativeDir, modName);
	}).filter(dir => dir);
	dirs.unshift(reactNativeDir);
	
	parse(dirs, platform, function({mods, hash, fileHash}){
		console.log(mods.length);
	});
}