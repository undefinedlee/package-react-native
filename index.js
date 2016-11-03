import path from "path";
import utils from "node-pearls";
import console from "cli-console";
import parse from "./src/parse";

const depPackages = ["react", "fbjs"];

const setupMod = "InitializeJavaScriptAppEngine";

const extensions = ["", ".native.js", ".js", "/index.js"];

function _parse(reactNativeDir, entries, platform, callback){
	var dirs = depPackages.map(function(modName){
		return utils.findNodeModules(reactNativeDir, modName);
	}).filter(dir => dir);
	dirs.unshift(reactNativeDir);
	
	parse(dirs, entries, platform, function({fileHash, extensionFileHash}){
		callback(fileHash, extensionFileHash);
	}, ["react-native"].concat(depPackages));
}

export default function(platform){
	if(["ios", "android"].indexOf(platform) === -1){
		console.error(`打包react-native模块时，传入的平台名称${platform}错误，只能是ios或android`);
		return function(){};
	}

	return function(){
		var entries;

		this.plugin("start", function(info){
			if(info.packageJson.name === "react-native"){
				entries = [
					path.join(info.path, "Libraries/react-native/react-native.js"),
					path.join(info.path, "Libraries/JavaScriptAppEngine/Initialization/InitializeJavaScriptAppEngine.js")
				];
			}
		});

		this.plugin("parse-entries", function(info){
			if(info.packageJson.name === "react-native"){
				while(info.entries.length){
					// entries.unshift(info.entries.pop());
					info.entries.pop();
				}
			}
		});

		this.plugin("loader-complete", function(info){
			if(info.packageJson.name === "react-native"){
				let callback = this.async();
				_parse(info.path, entries, platform, function(loadCache, extensionFileHash){
					for(let file in loadCache){
						info.loadCache[file] = loadCache[file];
					}
					for(let file in extensionFileHash){
						info.extensionFileHash[file] = extensionFileHash[file];
					}
					callback();
				});
			}
		});

		this.plugin("before-parse-single", function(info){
			if(info.packageJson.name === "react-native"){
				entries.forEach(function(entry){
					info.entries.push(entry);
				});
			}
		});
	};
}