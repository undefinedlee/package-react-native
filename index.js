import path from "path";
import utils from "node-pearls";
import parse from "./src/parse";

const depPackages = ["react", "fbjs"];

const setupMod = "InitializeJavaScriptAppEngine";

const extensions = ["", ".native.js", ".js", "/index.js"];

function _parse(reactNativeDir, platform, callback){
	var dirs = depPackages.map(function(modName){
		return utils.findNodeModules(reactNativeDir, modName);
	}).filter(dir => dir);
	dirs.unshift(reactNativeDir);
	
	parse(dirs, platform, function({fileHash, extensionFileHash}){
		callback(fileHash, extensionFileHash);
	});
}

export default function(){
	var entries;

	this.plugin("start", function(info){
		if(info.packageJson.name === "react-native"){
			entries = [];
		}
	});

	this.plugin("parse-entries", function(info){
		if(info.packageJson.name === "react-native"){
			while(info.entries.length){
				entries.unshift(info.entries.pop());
			}
		}
	});

	this.plugin("loader-complete", function(info){
		if(info.packageJson.name === "react-native"){
			return new Promise(function(resolve, reject){
				_parse(info.path, "ios", function(loadCache, extensionFileHash){
					for(let file in loadCache){
						info.loadCache[file] = loadCache[file];
					}
					for(let file in extensionFileHash){
						info.extensionFileHash[file] = extensionFileHash[file];
					}
					resolve();
				});
			});
		}
	});

	this.plugin("parse-single", function(info){
		if(info.packageJson.name === "react-native"){
			entries.forEach(function(entry){
				info.singleFiles.push(entry);
			});
		}
	});

	this.plugin("bundle-mods", function(info){
		
	});
}