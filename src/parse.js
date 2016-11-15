import fs from "fs";
import path from "path";
import utils from "node-pearls";
import console from "cli-console";
import findDeps from "./find-deps";
// import removeDev from "./remove-dev";
import transBabel from "./trans-babel";
import glob from "glob";

// 默认后缀查找顺序
const extensions = ["", ".native.js", ".js.flow", ".js", "/index.js"];

export default function(dirs, entries, platform, callback, depPackages){
	depPackages = depPackages || [];

	// 忽略项目中__tests__、__mocks__目录下的文件
	const commonIgnore = /\/__(tests|mocks)__\//;
	// 根据平台，忽略其他平台的问题件
	const platformIgnore = {
		"ios": /\.android\.js$/,
		"android": /\.ios\.js$/
	}[platform];
	// 检测是不是react-native项目中的文件
	const reactNativeRegex = /\/react-native\//;

	var files = [];
	utils.asyncList(dirs.map(function(dir){
		// 找出dirs目录下所有的js文件
		return function(callback){
			var isReact = /\/react$/.test(dir);
			var isFbjs = /\/fbjs$/.test(dir);
			// 由于0.37开始，react-native中不再直接引用react、fbjs包中导出的模块
			// 所以此处不再会有isReact、isFbjs
			glob(isReact || isFbjs ? "**/@(*.js|*.js.flow)" : "**/*.js", {
				cwd: dir,
				ignore: isReact ? ["node_modules/**/*", "dist/**/*"] : "node_modules/**/*"
			}, function(err, _files){
				files = files.concat(_files.map(file => {
					return {
						dir: dir,
						file: path.join(dir, file)
					};
				}));
				callback();
			});
		};
	})).then(function(){
		utils.asyncList(files.filter(function(file){
			// 过滤无效的js
			return !commonIgnore.test(file.file) && !platformIgnore.test(file.file);
		}).map(function(file){
			// 读取所有js的内容
			return function(callback){
				fs.readFile(file.file, {
					encoding: "utf8"
				}, function(err, content){
					if(err){
						throw err;
					}

					callback({
						dir: file.dir,
						file: file.file,
						content: content
					});
				});
			};
		})).then(function(items){
			// 导出模块hash
			// Hash<modName, modObject>
			var hash = {};
			// 文件hash
			// Hash<file, modObject>
			var fileHash = {};
			// 根据‘@providesModule modName’分析出所有导出的模块
			var mods = items.map(function(item){
				var match = item.content.match(/@providesModule\s+([a-zA-Z\-0-9\._]+)/);

				try{
					item = {
						dir: item.dir,
						file: item.file,
						content: transBabel(item.content) //removeDev(transBabel(item.content))
					};
				}catch(e){
					console.error("trans babel error");
					console.log(item.file);
					// console.log(e);
					item = {
						dir: item.dir,
						file: item.file,
						content: item.content
					};
				}

				if(match && (!hash[item.name] || !reactNativeRegex.test(hash[item.name].file))){
					item.name = match[1];

					// if(hash[item.name]){
					// 	console.log(`模块${item.file}重复导出`);
					// 	console.log(hash[item.name].file);
					// 	console.log(item.file);
					// }

					hash[item.name] = item;
				}

				fileHash[item.file] = item;

				let deps = findDeps(item.content, item.file);
				item.deps = deps;

				return item;
			});

			// var _innerDeps = [];
			// var _outerDeps = [];
			var extensionFileHash = {};
			// 分析所有模块的依赖，合并相对路径是导出模块的require
			mods.forEach(function(mod){
				var outerDeps = [];
				var innerDeps = [];
				// var modDeps = [];
				// 导出模块转换内部/外部模块的对应表
				var replaceModPath = {};
				mod.deps.forEach(function(modPath){
					// 如果是导出模块
					if(hash[modPath]){
						if(hash[modPath].file.indexOf(mod.dir) === 0){
							// 转换项目内部的导出的模块为内部模块
							let originalPath = modPath;
							modPath = path.relative(path.dirname(mod.file), hash[modPath].file);
							if(!/^\.{1,2}\//.test(modPath)){
								modPath = "./" + modPath;
							}
							replaceModPath[originalPath] = modPath;
						}else{
							// 转换项目外部的导出的模块为外部模块
							replaceModPath[modPath] = modPath = hash[modPath].file.replace(mod.dir, "").replace(/^\//, "");
						}
					}

					// // 转换入口包内的模块为内部模块
					// if(!/^\.{1,2}\//.test(modPath) && depPackages.indexOf(modPath) === -1){
					// 	let modName = modPath.split("/")[0];
					// 	if(depPackages.indexOf(modName) !== -1){
					// 		var modDir = dirs.find(function(dir){
					// 			return dir.split("/").pop() === modName;
					// 		});

					// 		if(modDir){
					// 			let originalPath = modPath;

					// 			modPath = path.relative(path.dirname(mod.file), path.join(modDir, "../" + modPath));
					// 			if(!/^\.{1,2}\//.test(modPath)){
					// 				modPath = "./" + modPath;
					// 			}
					// 			replaceModPath[originalPath] = modPath;
					// 		}
					// 	}
					// }

					if(/^\.{1,2}\//.test(modPath)){
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
						// 判断外部模块是不是未识别的导出模块
						// 外部模块模块名应该是小写的，或者是带路径的
						// 导出模块应该不带路径，并且大写（有个别小写的导出模块，暂不考虑）
						if(/[A-Z]/.test(modPath) && !/\//.test(modPath)){
							console.error(`需要导出的模块${modPath}未找到，来自文件${mod.file}的依赖`);
						}

						// if(_outerDeps.indexOf(modPath) === -1){
						// 	_outerDeps.push(modPath);
						// }
					}
				});
				
				// 替换源代码中的导出模块
				if(Object.keys(replaceModPath).length){
					mod.content = findDeps.replace(mod.content, replaceModPath);
				}

				// 设置项目外模块
				mod.outerDeps = outerDeps;
				// 设置项目内模块
				mod.innerDeps = innerDeps;
				delete mod.deps;
			});

			// 生成项目内模块的依赖链
			// 用于package模块中分析入口用
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
					fileHash: fileHash,
					extensionFileHash: extensionFileHash
				});
			});
		}).catch(function(e){
			throw e;
		});
	});
};