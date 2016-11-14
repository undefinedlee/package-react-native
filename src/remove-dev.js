const babel = require("babel-core");
import console from "cli-console";

export default function(content){
	try{
		content = babel.transform(content, {
			compact: false,
			plugins: [
				function ({ types: t }) {
					return {
						visitor: {
							IfStatement: {
								enter(path){
									let node = path.node;
									if(node.test.type === "Identifier" &&
										node.test.name === "__DEV__"){
										if(node.alternate){
											path.replaceWith(node.alternate);
										}else{
											path.remove();
										}
									}
								}
							},
							ConditionalExpression: {
								enter(path){
									let node = path.node;
									if(node.test.type === "Identifier" &&
										node.test.name === "__DEV__"){
										if(node.alternate){
											path.replaceWith(node.alternate);
										}else{
											path.remove();
										}
									}
								}
							}
						}
					};
				}
			]
		}).code;
	}catch(e){
		console.error("remove dev error");
		return "";
	}

	return content;
};
