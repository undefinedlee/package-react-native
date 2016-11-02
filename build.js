var fs = require("fs");
var path = require("path");
var babel = require("babel-core");

var sep = path.sep;

function asyncList (list, callback){
	var count = list.length,
		results = [];
	if(list && count > 0){
		list.forEach(function(item, index) {
			item(function(result) {
				results[index] = result;
				count --;
				if(count === 0){
					callback.apply(null, results);
				}
			});
		});
	}else{
		callback();
	}
};

var ignore = [];
function readFiles (dir, ext, isDeep, callback){
	var files = [];

	dir = dir.replace(/(\/|\\)$/, "");

	fs.readdir(dir, function(err, _files){
		if(err){
			throw err;
		}

		var dirs = [],
			readStatList = [];
		_files.forEach(function(filename){
			if(ignore.indexOf(filename) !== -1){
				return;
			}

			var file = dir + sep + filename;

			readStatList.push(function(callback){
				fs.stat(file, function(err, stats){
					if(err){
						throw err;
					}

					var _ext = path.extname(filename);

					if(stats.isDirectory()){
						dirs.push(function(callback){
							readFiles(file, ext, isDeep, function(_files){
								files = files.concat(_files);
								callback();
							});
						});
						if(ext === "/"){
							files.push(file);
						}
					}else{
						if(ext){
							if(_ext === ext){
								files.push(file);
							}
						}else{
							files.push(file);
						}
					}
					callback();
				});
			});
		});

		asyncList(readStatList, function(){
			if(isDeep && dirs.length){
				asyncList(dirs, function(){
					callback(files);
				});
			}else{
				callback(files);
			}
		});
	});
};

function mkdirs(dirpath, callback) {
    if(callback){
        fs.exists(dirpath, function(exists) {
            if(exists) {
                    callback(dirpath);
            } else {
                    //尝试创建父目录，然后再创建当前目录
                    mkdirs(path.dirname(dirpath), function(){
                            fs.mkdir(dirpath, callback);
                    });
            }
        });
    }else{
        if(fs.existsSync(dirpath)){
            return true;
        }else{
            if(mkdirs(path.dirname(dirpath))){
                fs.mkdirSync(dirpath);
                return true;
            }
        }
    }
};

function write(file, content){
	mkdirs(path.dirname(file), function(){
		fs.writeFile(file, content, function(err){
			if(err){
				throw err;
			}
		});
	});
}

var isTest = !!process.argv[2];

readFiles(path.join(__dirname, "src"), ".js", true, function(files){
	files.forEach(function(file){
		babel.transformFile(file, {
			presets: ['es2015', 'stage-0']
		}, function(err, result){
			if(err){
				throw err;
			}

			if(!isTest){
				write(file, result.code);
			}
		});
	});
});