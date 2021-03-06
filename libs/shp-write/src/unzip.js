var write = require('./write'),
    geojson = require('./geojson'),
    defaultPrj = require('./prj')
let fs = require("fs")

module.exports = function (gj, options) {

    var prj = (options && options.prj) ? options.prj : defaultPrj;
    options = options || {};

    [geojson.point(gj), geojson.pointZ(gj), geojson.line(gj), geojson.lineZ(gj), geojson.polygon(gj), geojson.polygonZ(gj)]
        .forEach(function (l) {
            if (l.geometries.length && l.geometries[0].length) {
                write(
                    // field definitions
                    l.properties,
                    // geometry type
                    l.type,
                    // geometries
                    l.geometries,
                    function (err, files) {
                        var fileName;
                        if (options.filename) {
                            fileName = options.filename.toLowerCase();
                        } else if (options.types) {
                            if (options.types[l.type.toLowerCase()]) {
                                fileName = options.types[l.type.toLowerCase()]
                            } else {
                                fileName = l.type.toLowerCase();
                            }
                        } else {
                            fileName = l.type.toLowerCase();
                        }
                        let folder = options.folder || ''
                        // zip.file(fileName + '.shp', files.shp.buffer, { binary: true });
                        // zip.file(fileName + '.shx', files.shx.buffer, { binary: true });
                        // zip.file(fileName + '.dbf', files.dbf.buffer, { binary: true });
                        // zip.file(fileName + '.prj', prj);
                        fs.writeFileSync(folder + fileName + '.shp', Buffer.from(files.shp.buffer))
                        fs.writeFileSync(folder + fileName + '.shx', Buffer.from(files.shx.buffer))
                        fs.writeFileSync(folder + fileName + '.dbf', Buffer.from(files.dbf.buffer))
                        fs.writeFileSync(folder + fileName + '.prj', prj)

                    });
            }
        });

    return null
};
