const babel = require("babel-core");
import console from "cli-console";

// 查找代码里的所有依赖
function jsDeps (content, file){
	var deps = [];

	try{
		// 提取依赖
		babel.transform(content, {
			compact: false,
			plugins: [
				function ({ types: t }) {
					return {
						visitor: {
							CallExpression: {
								enter(path){
									let node = path.node;
									// 匹配require(string)
									if(node.callee.type === "Identifier" &&
										node.callee.name === "require" &&
										node.arguments[0] &&
										node.arguments[0].type === "StringLiteral" &&
										!path.scope.hasBinding("require")){
											deps.push(node.arguments[0].value);
									}
								}
							}
						}
					};
				}
			]
		});
	}catch(e){
		console.error("find deps error");
		console.log(file);
		// console.log(e);
	}

	return deps;
};

jsDeps.replace = function(content, fn){
	if(typeof fn === "object"){
		let obj = fn;
		fn = function(key){
			var value = obj[key];
			if(typeof value === "object"){
				return value;
			}else{
				return {
					modId: value
				};
			}
		};
	}

	try{
		// 提取依赖
		content = babel.transform(content, {
			compact: false,
			plugins: [
				function ({ types: t }) {
					return {
						visitor: {
							CallExpression: {
								enter(path){
									let node = path.node;
									// 匹配require(string)
									if(node.callee.type === "Identifier" &&
										node.callee.name === "require" &&
										node.arguments[0] &&
										node.arguments[0].type === "StringLiteral" &&
										!path.scope.hasBinding("require")){
											let modInfo = fn(node.arguments[0].value);

											if(!modInfo){
												return;
											}
											
											// 修改require的模块ID
											if(modInfo.modId){
												switch(typeof modInfo.modId){
													case "string":
														node.arguments[0] = t.StringLiteral(modInfo.modId);
														break;
													case "number":
														node.arguments[0] = t.NumericLiteral(modInfo.modId);
														break;
												}
											}
											// 修改require的方法名
											if(modInfo.requireName){
												node.callee.name = modInfo.requireName;
											}
											// 添加注释
											if(modInfo.comments){
												if(!node.arguments[0].trailingComments){
													node.arguments[0].trailingComments = [];
												}
												node.arguments[0].trailingComments.push(t.StringLiteral(modInfo.comments));
											}
									}
								}
							},
							// 删除生成文件头部的"use strict"
							Directive: {
								enter(path){
									if(path.node.value.value === "use strict"){
										path.remove();
									}
								}
							}
						}
					};
				}
			]
		}).code;
	}catch(e){
		console.error("replace deps error");
		// console.log(e);
		return "";
	}

	return content;
};

export default jsDeps;