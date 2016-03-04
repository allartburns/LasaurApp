var jobview_width = 0
var jobview_height = 0
var jobview_mm2px = 1.0

var nav_height_init = 0
var footer_height = 0
var info_width_init = 0

var jobview_width_last = 0
var jobview_height_last = 0

function jobview_resize() {
  var win_width = $(window).innerWidth()
  var win_height = $(window).innerHeight()
  var canvas_width = win_width-info_width_init
  var canvas_height = win_height-nav_height_init-footer_height_init
  // var containter_height = win_height-nav_height_init-footer_height_init
  $("#main-container").height(canvas_height)
  $("#job-canvas").width(win_width-info_width_init)
  // $("#job-info").width(job_info_min_width)
  $("#job-info").height(canvas_height)
  // jobview_width = $('#job-canvas').innerWidth()
  // jobview_height = $('#job-canvas').innerHeight()

  // calculate jobview_mm2px
  // used to scale mm geometry to be displayed on canvas
  if (appconfig_main !== undefined) {
    var wk_width = appconfig_main.workspace[0]
    var wk_height = appconfig_main.workspace[1]
    var aspect_workspace = wk_width/wk_height
    var aspect_canvas = canvas_width/canvas_height
    jobview_mm2px = canvas_width/wk_width  // default for same aspect
    if (aspect_canvas > aspect_workspace) {
      // canvas wider, fit by height
      jobview_mm2px = canvas_height/wk_height
      // indicate border, only on one side necessary
      $("#job-canvas").width(Math.floor(wk_width*jobview_mm2px))
      $("#job-info").width(win_width-Math.ceil(wk_width*jobview_mm2px))
    } else if (aspect_workspace > aspect_canvas) {
      // canvas taller, fit by width
      var h_scaled = Math.floor(wk_height*jobview_mm2px)
      $("#job-info").width(info_width_init)
      $("#main-container").height(h_scaled)
      $("#job-info").height(h_scaled)
      // $('#main-footer').height(win_height-nav_height_init-h_scaled)
    } else {
      // excact fit
    }
  }
  jobview_width = $('#job-canvas').innerWidth()
  jobview_height = $('#job-canvas').innerHeight()

  // resize content
  setTimeout(function() {
    var w_canvas = $('#job-canvas').innerWidth()
    var h_canvas = $('#job-canvas').innerHeight()
    var resize_scale = jobview_width/jobview_width_last
    console.log(jobview_width_last)
    console.log(jobview_width)
    console.log(resize_scale)
    jobview_width_last = jobview_width
    jobview_height_last = jobview_height

    for (var i=0; i<paper.project.layers.length; i++) {
      var layer = paper.project.layers[i]
      for (var j=0; j<layer.children.length; j++) {
        var child = layer.children[j]
        child.scale(resize_scale, new paper.Point(0,0))
      }
    }

    paper.view.draw()
  }, 600);
}



///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

$(window).resize(function() {
  jobview_resize()
})


function jobview_ready() {
  // This function is called after appconfig received.

  nav_height_init = $('#main-navbar').outerHeight(true)
  footer_height_init = $('#main-footer').outerHeight(true)
  info_width_init = $("#job-info").outerWidth(true)

  // calc/set canvas size
  jobview_resize()
  // store inital size
  jobview_width_last = jobview_width
  jobview_height_last = jobview_height
  // setup paper with job-canvas
  var canvas = document.getElementById('job-canvas')
  paper.setup(canvas)

  // paper.view.onResize = function(event) {
  //   setTimeout(function() {
  //     var w_canvas = $('#job-canvas').innerWidth()
  //     var h_canvas = $('#job-canvas').innerHeight()
  //     var resize_scale = w_canvas/jobview_width
  //     console.log(w_canvas)
  //     console.log(jobview_width)
  //     console.log(resize_scale)
  //     if (resize_scale > 0.01 && resize_scale < 10) {
  //       jobview_width = w_canvas
  //       jobview_height = h_canvas

  //       for (var i=0; i<paper.project.layers.length; i++) {
  //         var layer = paper.project.layers[i]
  //         for (var j=0; j<layer.children.length; j++) {
  //           var child = layer.children[j]
  //           child.scale(resize_scale, child.bounds.topLeft)
  //         }
  //       }

  //       paper.view.draw()
  //     }
  //   }, 300);
  // }

  // tools
  var tool1, tool2, tool_pass;
  // Create two drawing tools.
  // tool1 will draw straight lines,
  // tool2 will draw clouds.

  // Both share the mouseDown event:
  var path;
  function onMouseDown(event) {
    path = new paper.Path();
    path.strokeColor = 'black';
    path.add(event.point);
  }

  tool1 = new paper.Tool();
  tool1.onMouseDown = onMouseDown;

  tool1.onMouseDrag = function(event) {
    path.add(event.point);
  }

  tool2 = new paper.Tool();
  tool2.minDistance = 20;
  tool2.onMouseDown = onMouseDown;

  tool2.onMouseDrag = function(event) {
    // Use the arcTo command to draw cloudy lines
    path.arcTo(event.point);
  }

  tool_pass = new paper.Tool();
  tool_pass.onMouseDown = function(event) {
    console.log(paper.project.hitTest())
    paper.project.activeLayer.selected = false;
    if (event.item) {
      event.item.selected = true;
    }
  }

  // tool1.activate()
  // tool2.activate()
  tool_pass.activate()


  // some test paths
  var width = jobview_width
  var height = jobview_height
  var path = new paper.Path()
  path.strokeColor = 'red'
  path.closed = true
  path.add([1,1],[width-1,1],[width-1,height-1],[1,height-1])

  var path2 = new paper.Path()
  path2.strokeColor = 'red'
  path2.closed = true
  path2.add([60,60],[width-60,60],[width-60,height-60],[60,height-60])

  paper.view.draw()

}