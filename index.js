import path from "path";
import glob from "glob";
import utils from "node-pearls";
import console from "cli-console";
import parse from "./src/parse";
import removeUseStrict from "./src/remove-use-strict";

// const depPackages = ["react", "fbjs"];
const depPackages = [];

function _parse(reactNativeDir, entries, platform, config, callback){
	var dirs = depPackages.map(function(modName){
		return utils.findNodeModules(reactNativeDir, modName);
	}).filter(dir => dir);
	var packageJsons = dirs.map(function(dir){
		return utils.readJson.sync(path.join(dir, "package.json"));
	});
	dirs.unshift(reactNativeDir);
	
	parse(dirs, entries, platform, config, function({fileHash, extensionFileHash}){
		callback(fileHash, extensionFileHash, packageJsons);
	}, ["react-native"].concat(depPackages));
}

export default function(platform){
	if(["ios", "android"].indexOf(platform) === -1){
		console.error(`打包react-native模块时，传入的平台名称${platform}错误，只能是ios或android`);
		return function(){};
	}

	return function(){
		var entries;
		// 定义入口文件
		this.plugin("start", function(info){
			if(info.packageJson.name === "react-native"){
				entries = [
					// 项目对外暴露默认入口
					path.join(info.path, "Libraries/react-native/react-native.js"),
					// 框架启动入口
					path.join(info.path, "Libraries/Core/InitializeCore.js"),
					// 原生模块暴露入口
					path.join(info.path, "Libraries/BatchedBridge/NativeModules.js")
					// path.join(info.path, "Libraries/JavaScriptAppEngine/Initialization/InitializeJavaScriptAppEngine.js"),
					// path.join(info.path, "Libraries/BatchedBridge/BatchedBridgedModules/NativeModules.js")
				];
				// 对react模块暴露文件
				entries = entries.concat(glob.sync("lib/*.js", {
					cwd: info.path
				}).map(file => path.join(info.path, file)));
			}else if(info.packageJson.name === "react"){
				if(!info.packageJson.dependencies){
					info.packageJson.dependencies = {};
				}
				// 设置react对react-native的依赖版本
				info.packageJson.dependencies["react-native"] = "^0.37.0";
			}else if(info.packageJson.name === "react-clone-referenced-element"){
				if(!info.packageJson.dependencies){
					info.packageJson.dependencies = {};
				}
				// 设置react-clone-referenced-element对react的依赖版本
				info.packageJson.dependencies["react"] = "~15.3.2";
			}
		});
		// 清空默认的入口，使package不对react-native包进行处理
		this.plugin("parse-entries", function(info){
			if(info.packageJson.name === "react-native"){
				while(info.entries.length){
					info.entries.pop();
				}
			}
		});
		// 加载react-native包
		this.plugin("loader-complete", function(info){
			if(info.packageJson.name === "react-native"){
				let callback = this.async();
				_parse(info.path, entries, platform, info.config, function(loadCache, extensionFileHash, packageJsons){
					for(let file in loadCache){
						info.loadCache[file] = loadCache[file];
					}
					for(let file in extensionFileHash){
						info.extensionFileHash[file] = extensionFileHash[file];
					}
					var packageJson = info.packageJson;
					["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"].forEach(function(key){
						packageJsons.forEach(function(pJson){
							if(pJson[key]){
								packageJson[key] = Object.assign(packageJson[key] || {}, pJson[key]);
							}
						});
					});
					callback();
				});
			}
		});
		// 重新设置入口
		this.plugin("before-parse-single", function(info){
			if(info.packageJson.name === "react-native"){
				entries.forEach(function(entry){
					info.entries.push(entry);
				});
			}
		});
		// 移除打包完后的"use strict"，因为react-native源码中在顶层使用this，严格模式下顶层的this是undefined
		this.plugin("before-write-bundle", function(info){
			if(info.packageJson.name === "react-native"){
				return removeUseStrict(info.content);
			}
		});
	};
}