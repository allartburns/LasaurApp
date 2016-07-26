
// module to handle job data
// read, write, draw, stats, cleanup/filter


// {
//       "vector":                          # optional
//       {
//           "passes":
//           [
//               {
//                   "paths": [0],          # paths by index
//                   "relative": True,      # optional, default: False
//                   "seekrate": 6000,      # optional, rate to first vertex
//                   "feedrate": 2000,      # optional, rate to other vertices
//                   "intensity": 100,      # optional, default: 0 (in percent)
//                   "pierce_time": 0,      # optional, default: 0
//                   "air_assist": "pass",  # optional (feed, pass, off), default: pass
//                   "aux1_assist": "off",  # optional (feed, pass, off), default: off
//               }
//           ],
//           "paths":
//           [                              # list of paths
//               [                          # list of polylines
//                   [                      # list of verteces
//                       [0,-10, 0],        # list of coordinates
//                   ],
//               ],
//           ],
//           "colors": ["#FF0000"],         # color is matched to path by index
//           "noreturn": True,              # do not return to origin, default: False
//           "optimized": 0.08              # optional, tolerance to which it was optimized, default: 0 (not optimized)
//       }
//       "raster":                          # optional
//       {
//           "passes":
//           [
//               {
//                   "images": [0]
//                   "seekrate": 6000,      # optional
//                   "feedrate": 3000,
//                   "intensity": 100,
//                   "air_assist": "pass",  # optional (feed, pass, off), default: pass
//                   "aux1_assist": "off",  # optional (feed, pass, off), default: off
//               },
//           ]
//           "images":
//           [
//               {
//                   "pos": (100,50),          # pos in mm
//                   "size": (300,200),        # size in mm
//                   "data": <data in base64>  # internally this is a js Image
//               }
//           ]
//       }
//   }



jobhandler = {

  vector : {},
  raster : {},
  stats : {},
  name : "",
  job_group : undefined,
  scale : undefined,

  clear : function() {
    this.vector = {}
    this.raster = {}
    this.stats = {}
    name = ""
    jobview_clear()
    passes_clear()
    $('#job_info_name').html('')
    $('#job_info_length').html('')
    $('#info_content').html('')
    $('#info_btn').hide()
  },

  isEmpty : function() {
    return (Object.keys(this.vector).length == 0 &&
            Object.keys(this.raster).length == 0)
  },




  // readers //////////////////////////////////

  set : function(job, name, optimize) {
    this.clear();

    this.name = name
    $('title').html("LasaurApp - " + name)

    // handle json string representations as well
    if (typeof(job) === 'string') {
      job = JSON.parse(job)
    }

    if ('vector' in job) {
      this.vector = job.vector
      if (optimize) {
        this.segmentizeLongLines();
      }
    }

    if ('raster' in job) {
      if ('images' in job.raster) {
        this.raster = job.raster
        // convert base64 to Image object
        for (var i=0; i<this.raster.images.length; i++) {
          var image = this.raster.images[i]
          var img_base64 = image.data
          image.data = new Image()
          image.data.src = img_base64
          // scale to have one pixel match raster_size (beam width for raster)
          // image.data.width = Math.round(image.size[0]/app_config_main.raster_size);
          // image.data.height = Math.round(image.size[1]/app_config_main.raster_size);
        }
      }
    }

    this.normalizeColors()

    // passes, show in gui
    passes_set_assignments(job)

    // stats
    if ('stats' in job) {
      this.stats = job['stats']
    } else {
      this.calculateBasicStats()
    }

    // job info
    $('#job_info_name').html(this.name)
    $('#info_btn').show()
    // info modal
    var html = ''
    html += "name : " + this.name + "<br>"
    // html += "length : " + job_length_m + "m<br>"
    if ('paths' in this.vector) {
      html += "vector paths : " + this.vector.paths.length + "<br>"
    }
    if ('raster' in this.vector) {
      html += "raster images : " + this.raster.images.length + "<br>"
    }
    $('#info_content').html(html)
  },



  // writers //////////////////////////////////

  get : function() {
    var images_base64 = []
    if ('images' in this.raster) {
      // convert Image object to base64
      for (var i=0; i<this.raster.images.length; i++) {
        var image = this.raster.images[i]
        images_base64.push({'pos':image.pos,
                            'size':image.size,
                            'data':image.data.src})
      }
    }
    var raster_base64 = {'passes':this.raster.passes, 'images':images_base64}
    return {'vector':this.vector, 'raster':raster_base64, 'stats':this.stat}
  },

  getJson : function() {
    return JSON.stringify(this.get());
  },




  // rendering //////////////////////////////////

  render : function () {
    var x = 0;
    var y = 0;
    // clear canvas
    // paper.project.clear()
    jobview_clear()
    var scale = jobview_mm2px

    // rasters
    if ('images' in this.raster) {
      for (var k=0; k<this.raster.images.length; k++) {
        var img = this.raster.images[k];
        // alert(typeof(img.data))
        var pos_x = img.pos[0]*scale;
        var pos_y = img.pos[1]*scale;
        var img_w = img.size[0]*scale;
        var img_h = img.size[1]*scale;
        var img_paper = new paper.Raster();
        img_paper.image = img.data
        img_paper.scale((img.size[0]*scale)/img.data.width)
        img_paper.position = new paper.Point(pos_x+0.5*img_w, pos_y+0.5*img_h)

        // var image = raster.image;
        // var pixwidth = image.width;
        // var pixheight = image.height;
        // var offset = app_config_main.raster_offset;
        //
        // var ppmmX = pixwidth / width;
        // var ppmmY = pixheight / height;

        // canvas.stroke('#aaaaaa');
        // canvas.line(x_prev, y_prev, x1-offset, y);
        // for (var y = y1; y < y1 + height; y++) {
        //   var line = Math.round(ppmmY * (y-y1)) * pixwidth;
        //   for (var x=x1; x < x1 + width; x++) {
        //     var pixel = Math.round(line + (x - x1) * ppmmX);
        //     // convert pixel value from extended ascii to hex: [128,255] -> [0-ff]
        //     // hexpx = ((image[pixel].charCodeAt()-128)*2).toString(16)

        //     // convert pixel value from extended ascii to hex: [33,118] -> [0-ff]
        //     hexpx = ((image[pixel].charCodeAt()-33)*3).toString(16)
        //     canvas.stroke('#'+hexpx+hexpx+hexpx);
        //     canvas.line(x, y, x+1, y);
        //   }
        //   canvas.stroke('#aaaaaa');
        //   canvas.line(x1 + width, y, x1 + width + offset, y);
        //   canvas.line(x1 - offset, y, x1, y);
        // }

        x = pos_x + img_w + app_config_main.raster_offset;
        y = pos_y + img_h;
      }
    }


    // paths
    if ('paths' in this.vector) {
      jobview_feedLayer.activate()
      this.job_group = new paper.Group()
      for (var i=0; i<this.vector.paths.length; i++) {
        var path = this.vector.paths[i]
        jobview_feedLayer.activate()
        var group = new paper.Group()
        this.job_group.addChild(group)
        for (var j=0; j<path.length; j++) {
          var pathseg = path[j]
          if (pathseg.length > 0) {

            jobview_seekLayer.activate()
            var p_seek = new paper.Path()
            p_seek.strokeColor = app_config_main.seek_color
            p_seek.add([x,y])
            x = pathseg[0][0]*scale
            y = pathseg[0][1]*scale
            p_seek.add([x,y])

            jobview_feedLayer.activate()
            var p_feed = new paper.Path()
            group.addChild(p_feed);
            if ('colors' in this.vector && i < this.vector.colors.length) {
              p_feed.strokeColor = this.vector.colors[i]
            } else {
              p_feed.strokeColor = '#000000'
            }
            p_feed.add([x,y])

            for (vertex=1; vertex<pathseg.length; vertex++) {
              x = pathseg[vertex][0]*scale
              y = pathseg[vertex][1]*scale
              p_feed.add([x,y])
            }
          }
        }
        // // draw group's bounding box
        // jobview_boundsLayer.activate()
        // var group_bounds = new paper.Path.Rectangle(group.bounds)
        // group_bounds.strokeColor = app_config_main.bounds_color
      }
    }

  },


  renderBounds : function () {
    jobview_boundsLayer.removeChildren()
    jobview_boundsLayer.activate()
    // var all_bounds = new paper.Path.Rectangle(this.job_group.bounds)
    // var bbox_all = this.stats['_all_'].bbox
    var scale = jobview_mm2px
    var bbox = this.getActivePassesBbox()
    var all_bounds = new paper.Path.Rectangle(
                                    new paper.Point(bbox[0]*scale,bbox[1]*scale),
                                    new paper.Point(bbox[2]*scale,bbox[3]*scale) )
    // all_bounds.strokeColor = app_config_main.bounds_color
    all_bounds.strokeWidth = 2
    all_bounds.strokeColor = '#666666'
    all_bounds.dashArray = [2, 4]
  },


  draw : function () {
    paper.view.draw()
  },


  // passes and colors //////////////////////////

  setPassesFromGUI : function() {
    // read pass/color assinments from gui and set in this.vector.passes
    // assigns paths to passes and sets feedrate and intensity
    var assignments = passes_get_assignments()
    // [{"colors":[], "feedrate":1500, "intensity":100}, ...]
    var passes = this.vector.passes = []
    for (var i = 0; i < assignments.length; i++) {
      var assignment = assignments[i]
      //convert corlors to path indices
      var path_indices = []
      for (var ii = 0; ii < assignment.colors.length; ii++) {
        path_indices.push(this.vector.colors.indexOf(assignment.colors[ii]))
      }
      if (path_indices.length) {
        passes.push({"paths":path_indices, "feedrate":assignment.feedrate,
        "intensity":assignment.intensity})
      }
    }
    // console.log(this.vector.passes)
  },


  normalizeColors : function() {
    var random_color_flag = false
    // randomized colors if no colors assigned
    if (!('colors' in this.vector)) {
      if ('paths' in this.vector && this.vector.paths.length > 0) {
        // no color assignments, paths exist
        random_color_flag = true
      }
    } else if ('paths' in this.vector && this.vector.paths.length > 0) {
      if (this.vector.paths.length != this.vector.colors.length) {
        // pass-color assignments do not match
        console.log("jobhandler.normalizeColors: colors-paths mismatch")
        random_color_flag = true
      }
    }
    // assign random colors
    if (random_color_flag) {
      this.vector.colors = []
      this.vector.colors.push('#000000')  // first always black
      for (var i = 1; i < this.vector.paths.length; i++) {
        var random_color = '#'+(Math.random()*0xaaaaaa<<0).toString(16)
        this.vector.colors.push(random_color)
      }
    }
  },


  getAllColors : function() {
    // return list of colors
    if ('colors' in this.vector) {
      return this.vector.colors
    } else {
      return []
    }
  },


  selectColor : function(color) {
    // select paths by color in job view
    var index = this.vector.colors.indexOf(color)
    for (var i = 0; i < this.job_group.children.length; i++) {
      if (i==index) {
        this.job_group.children[i].selected = true
        var color_group = this.job_group.children[i]
        jobview_color_selected = color
        setTimeout(function() {
          color_group.selected = false
          jobview_color_selected = undefined
          paper.view.draw()
        }, 1500);
      } else {
        this.job_group.children[i].selected = false
      }
    }
    paper.view.draw()
  },




  // stats //////////////////////////////////////

  calculateBasicStats : function() {
    // calculate bounding boxes and path lengths
    // for each path, image, and also for '_all_'
    // bbox and length only account for feed lines
    // saves results in this.stats like so:
    // {'_all_':{'bbox':[xmin,ymin,xmax,ymax], 'length':numeral},
    //  'paths':[{'bbox':[xmin,ymin,xmax,ymax], 'length':numeral}, ...],
    //  'images':[{'bbox':[xmin,ymin,xmax,ymax], 'length':numeral}, ...] }

    var length_all = 0
    var bbox_all = [Infinity, Infinity, -Infinity, -Infinity]

    // paths
    if ('paths' in this.vector) {
      this.stats.paths = []
      for (var k=0; k<this.vector.paths.length; k++) {
        var path = this.vector.paths[k]
        var path_length = 0
        var path_bbox = [Infinity, Infinity, -Infinity, -Infinity]
        for (var poly = 0; poly < path.length; poly++) {
          var polyline = path[poly]
          var x_prev = 0
          var y_prev = 0
          if (polyline.length > 1) {
            var x = polyline[0][0]
            var y = polyline[0][1]
            this.bboxExpand(path_bbox, x, y)
            x_prev = x
            y_prev = y
            for (vertex=1; vertex<polyline.length; vertex++) {
              var x = polyline[vertex][0]
              var y = polyline[vertex][1]
              path_length +=
                Math.sqrt((x-x_prev)*(x-x_prev)+(y-y_prev)*(y-y_prev))
              this.bboxExpand(path_bbox, x, y)
              x_prev = x
              y_prev = y
            }
          }
        }
        this.stats.paths.push({'bbox':path_bbox, 'length':path_length})
        length_all += path_length
        this.bboxExpand(bbox_all, path_bbox[0], path_bbox[1])
        this.bboxExpand(bbox_all, path_bbox[2], path_bbox[3])
      }
    }

    // images
    if ('images' in this.raster) {
      this.stats.images = []
      for (var k=0; k<this.raster.images.length; k++) {
        var image = this.raster.images[k]
        var image_length = (2*app_config_main.raster_offset + image.size[0])
                         * Math.floor(image.size[1]/app_config_main.raster_size)
        var image_bbox = [image.pos[0] - app_config_main.raster_offset,
                          image.pos[1],
                          image.pos[0] + image.size[0] + app_config_main.raster_offset,
                          image.pos[1] + image.size[1]
                         ]
        this.stats.images.push({'bbox':image_bbox, 'length':image_length})
        length_all += image_length
        this.bboxExpand(bbox_all, image_bbox[0], image_bbox[1])
        this.bboxExpand(bbox_all, image_bbox[2], image_bbox[3])
      }
    }

    // store in object var
    this.stats['_all_'] = {
      'bbox':bbox_all,
      'length':length_all
    }
  },

  getActivePassesLength : function() {
    var length = 0
    // vector
    if ('passes' in this.vector) {
      for (var i = 0; i < this.vector.passes.length; i++) {
        var pass = this.vector.passes[i]
        for (var j = 0; j < pass.paths.length; j++) {
          var path_idx = pass.paths[j]
          if (path_idx >= 0 && path_idx < this.stats.paths.length) {
            length += this.stats.paths[path_idx].length
          }
        }
      }
    }
    // raster
    if ('passes' in this.raster) {
      for (var i = 0; i < this.raster.passes.length; i++) {
        var pass = this.raster.passes[i]
        for (var j = 0; j < pass.images.length; j++) {
          var image_idx = pass.images[j]
          if (image_idx >= 0 && image_idx < this.stats.images.length) {
            length += his.stats.images[image_idx].length
          }
        }
      }
    }
    return length
  },

  getActivePassesBbox : function() {
    var bbox = [Infinity, Infinity, -Infinity, -Infinity]
    // vector
    if ('passes' in this.vector) {
      for (var i = 0; i < this.vector.passes.length; i++) {
        var pass = this.vector.passes[i]
        for (var j = 0; j < pass.paths.length; j++) {
          var path_idx = pass.paths[j]
          if (path_idx >= 0 && path_idx < this.stats.paths.length) {
            this.bboxExpand2(bbox, this.stats.paths[path_idx].bbox)
          }
        }
      }
    }
    // raster
    if ('passes' in this.raster) {
      for (var i = 0; i < this.raster.passes.length; i++) {
        var pass = this.raster.passes[i]
        for (var j = 0; j < pass.images.length; j++) {
          var image_idx = pass.images[j]
          if (image_idx >= 0 && image_idx < this.stats.images.length) {
            this.bboxExpand2(bbox, this.stats.images[image_idx].bbox)
          }
        }
      }
    }
    return bbox
  },


  bboxExpand : function(bbox, x, y) {
    if (x < bbox[0]) {bbox[0] = x;}
    else if (x > bbox[2]) {bbox[2] = x;}
    if (y < bbox[1]) {bbox[1] = y;}
    else if (y > bbox[3]) {bbox[3] = y;}
  },


  bboxExpand2 : function(bbox, bbox2) {
    this.bboxExpand(bbox, bbox2[0], bbox2[1])
    this.bboxExpand(bbox, bbox2[2], bbox2[3])
  },


  // path optimizations /////////////////////////

  segmentizeLongLines : function() {
    // TODO: make this also work 3D
    var x_prev = 0;
    var y_prev = 0;
    var d2 = 0;
    var length_limit = app_config_main.max_segment_length;
    var length_limit2 = length_limit*length_limit;

    var lerp = function(x0, y0, x1, y1, t) {
      return [x0*(1-t)+x1*t, y0*(1-t)+y1*t];
    }

    var paths = this.vector.paths;
    for (var k=0; k<paths.length; k++) {
      var path = paths[k];
      if (path.length > 1) {
        var new_path = [];
        var copy_from = 0;
        var x = path[0][0];
        var y = path[0][1];
        // ignore seek lines for now
        x_prev = x;
        y_prev = y;
        for (vertex=1; vertex<path.length; vertex++) {
          var x = path[vertex][0];
          var y = path[vertex][1];
          d2 = (x-x_prev)*(x-x_prev) + (y-y_prev)*(y-y_prev);
          // check length for each feed line
          if (d2 > length_limit2) {
            // copy previous verts
            for (var n=copy_from; n<vertex; n++) {
              new_path.push(path[n]);
            }
            // add lerp verts
            var t_step = 1/(Math.sqrt(d2)/length_limit);
            for(var t=t_step; t<0.99; t+=t_step) {
              new_path.push(lerp(x_prev, y_prev, x, y, t));
            }
            copy_from = vertex;
          }
          x_prev = x;
          y_prev = y;
        }
        if (new_path.length > 0) {
          // add any rest verts from path
          for (var p=copy_from; p<path.length; p++) {
            new_path.push(path[p]);
          }
          copy_from = 0;
          paths[k] = new_path;
        }
      }
    }

  },


}
