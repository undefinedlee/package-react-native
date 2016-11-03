import fs from "fs";
import path from "path";
import utils from "node-pearls";
import console from "cli-console";
import findDeps from "./find-deps";
import transBabel from "./trans-babel";

const extensions = ["", ".native.js", ".js", "/index.js"];

export default function(dirs, entries, platform, callback, depPackages){
	depPackages = depPackages || [];

	const commonIgnore = /\/__(tests|mocks)__\//;
	const platformIgnore = {
		"ios": /\.android\.js$/,
		"android": /\.ios\.js$/
	}[platform];

	var files = [];
	utils.asyncList(dirs.map(function(dir){
		// 找出dirs目录下所有的js文件
		return function(callback){
			utils.readFiles(dir, ".js", true, function(_files){
				files = files.concat(_files.filter(function(file){
					return !/\/node_modules\//.test(file.replace(dir, ""));
				}));

				callback();
			});
		};
	})).then(function(){
		utils.asyncList(files.filter(function(file){
			// 过滤无效的js
			return !commonIgnore.test(file) && !platformIgnore.test(file);
		}).map(function(file){
			// 读取所有js的内容
			return function(callback){
				fs.readFile(file, {
					encoding: "utf8"
				}, function(err, content){
					if(err){
						throw err;
					}

					callback({
						file: file,
						content: content
					});
				});
			};
		})).then(function(items){
			var hash = {};
			var fileHash = {};
			var extensionFileHash = {};
			// 根据‘@providesModule modName’分析出所有导出的模块
			var mods = items.map(function(item){
				var match = item.content.match(/@providesModule\s+([a-zA-Z\-0-9\._]+)/);

				try{
					item = {
						file: item.file,
						content: transBabel(item.content)
					};
				}catch(e){
					console.error("trans babel error");
					console.log(item.file);
					// console.log(e);
					item = {
						file: item.file,
						content: item.content
					};
				}

				if(match){
					item.name = match[1];

					hash[item.name] = item;
				}

				fileHash[item.file] = item;

				let deps = findDeps(item.content, item.file);
				item.deps = deps;

				return item;
			});

			// var _innerDeps = [];
			// var _outerDeps = [];
			// 分析所有模块的依赖，合并相对路径是导出模块的require
			mods.forEach(function(mod){
				var outerDeps = [];
				var innerDeps = [];
				// var modDeps = [];
				var replaceModPath = {};
				mod.deps.forEach(function(modPath){
					// 转换导出的模块为内部模块
					if(hash[modPath]){
						let originalPath = modPath;
						modPath = path.relative(path.dirname(mod.file), hash[modPath].file);
						if(!/^\.{1,2}\//.test(modPath)){
							modPath = "./" + modPath;
						}
						replaceModPath[originalPath] = modPath;
					}
					// 转换入口包内的模块为内部模块
					if(!/^\.{1,2}\//.test(modPath) && depPackages.indexOf(modPath) === -1){
						let modName = modPath.split("/")[0];
						if(depPackages.indexOf(modName) !== -1){
							var modDir = dirs.find(function(dir){
								return dir.split("/").pop() === modName;
							});

							if(modDir){
								let originalPath = modPath;

								modPath = path.relative(path.dirname(mod.file), path.join(modDir, "../" + modPath));
								if(!/^\.{1,2}\//.test(modPath)){
									modPath = "./" + modPath;
								}
								replaceModPath[originalPath] = modPath;
							}
						}
					}

					if(/^\.{1,2}\//.test(modPath)){
						// innerDeps.push(modPath);
						// 解析相对路径
						modPath = path.resolve(path.dirname(mod.file), modPath);

						let existsFile = false;
						for(let ext of extensions){
							if(fs.existsSync(modPath + ext) && fs.statSync(modPath + ext).isFile()){
								if(ext){
									extensionFileHash[modPath] = modPath = modPath + ext;
								}
								existsFile = true;
								break;
							}
						}
						if(!existsFile){
							console.error(`无法找到模块${modPath}，来自文件${mod.file}的依赖`);
						}
						innerDeps.push(modPath);
						// if(fileHash[modPath]){
						// 	modDeps.push(fileHash[modPath].name);
						// 	//console.log(fileHash[modPath].name);
						// }else{
						// 	//console.log(modPath);
						// 	modPath = modPath.split("/node_modules/").pop();
						// 	innerDeps.push(modPath);

						// 	if(_innerDeps.indexOf(modPath) === -1){
						// 		_innerDeps.push(modPath);
						// 	}
						// }
					}else{
						outerDeps.push(modPath);

						if(/[A-Z]/.test(modPath) && !/\//.test(modPath)){
							console.error(`需要导出的模块${modPath}未找到`);
						}

						// if(_outerDeps.indexOf(modPath) === -1){
						// 	_outerDeps.push(modPath);
						// }
					}
				});
				
				if(Object.keys(replaceModPath).length){
					mod.content = findDeps.replace(mod.content, replaceModPath);
				}

				mod.outerDeps = outerDeps;
				mod.innerDeps = innerDeps;
				// mod.modDeps = modDeps;
				delete mod.deps;
			});

			(function parse(files, depChain, callback){
				utils.asyncList(files.map(function(file){
					var mod = fileHash[file];

					return function(callback){
						if(!mod){
							console.warn(`读取的文件列表中没有文件${file}`);
							callback();
							return;
						}

						if(mod.depChains){
							mod.depChains.push(depChain);
							callback();
						}else{
							mod.depChains = [depChain];
							parse(mod.innerDeps, [].concat(depChain, mod.file), callback);
						}
					};
				})).then(callback);
			})(entries, [], function(){
				callback({
					// mods: mods,
					// hash: hash,
					fileHash: fileHash,
					extensionFileHash: extensionFileHash
				});
			});

			// console.log(_outerDeps);
			// console.log(_innerDeps);
			// console.log(hash["InitializeJavaScriptAppEngine"]);
			// console.log(hash["InitializeJavaScriptAppEngine"].file);
		}).catch(function(e){
			throw e;
		});
	});
};