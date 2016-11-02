const babel = require("babel-core");
import console from "cli-console";
// 查找代码里的所有依赖
export default function (content){
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
		console.log(e);
	}

	return deps;
}