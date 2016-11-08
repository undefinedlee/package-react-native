const babel = require("babel-core");
import console from "cli-console";

export default function(content){
	try{
		return babel.transform(content, {
			compact: false,
			plugins: [
				function ({ types: t }) {
					return {
						visitor: {
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
		console.error("remove use strict error");
		return content;
	}
};