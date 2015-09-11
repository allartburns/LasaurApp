#
# new dxf parser using dxfgrabber.  Loosely based on work by Stephan
# and the lasersaur team.
#
#
__author__ = 'jet <jet@allartburns.org>'

import math
import io
import StringIO

import dxfgrabber

import sys
import linecache

class DXFParser:
    """Parse DXF using dxfgrabber-0.7.4

    Usage:
    reader = DXFParser(tolerance)
    returns dictionary of layers using found colors
    """

    def __init__(self, tolerance):
        self.debug = True
        # tolerance settings, used in tessalation, path simplification, etc         
        self.tolerance = tolerance
        self.tolerance2 = tolerance**2

        # parsed path data, paths by color
        # {'#ff0000': [[path0, path1, ..], [path0, ..], ..]}
        # Each path is a list of vertices which is a list of two floats.        
        # using iso pen colors from dxfwrite
        # 0 is undefined in DXF, it specifies no color, not black
        # 1 red
        # 2 yellow
        # 3 green
        # 4 cyan
        # 5 blue
        # 6 magenta
        # 7 black
        # TODO: support up to 255 colors

        self.boundarys = {'#FF0000':[],
                          '#FFFF00':[],
                          '#00FF00':[],
                          '#00FFFF':[],
                          '#0000FF':[],
                          '#CC33CC':[],
                          '#000000':[]}

        self.red_boundarys = self.boundarys['#FF0000']
        self.yellow_boundarys = self.boundarys['#FFFF00']
        self.green_boundarys = self.boundarys['#00FF00']
        self.cyan_boundarys = self.boundarys['#00FFFF']
        self.blue_boundarys = self.boundarys['#0000FF']
        self.magenta_boundarys = self.boundarys['#CC33CC']
        self.black_boundarys = self.boundarys['#000000']
        
        self.metricflag = 1
        self.linecount = 0
        self.line = ''
        self.dxfcode = ''
        print("finished init")

    def parse(self, dxfInput):
        dxfStripped = dxfInput.replace('\r\n','\n')
        dxfStream = io.StringIO(unicode(dxfStripped.replace('\r\n','\n')))
        
        infile = dxfgrabber.read(dxfStream)
        if not infile:
            print ("DXFGRABBER FAIL")
            raise ValueError

        if self.debug:
            print("DXF version: {}".format(infile.dxfversion))
            print("header var count: ", len(infile.header))
            print("layer count: ", len(infile.layers)) 
            print("block def count: ", len(infile.blocks))
            print("entitiy count: ", len(infile.entities))

        for entity in infile.entities:
            if entity.dxftype == "LINE":
                self.do_line(entity)
        
        print "Done!"
        
        self.returnBoundarys = {}
        for color in self.boundarys:
            if len(self.boundarys[color]) > 0:
                print ("returning color ", color)
                self.returnBoundarys[color] = self.boundarys[color]
        return {'boundarys':self.returnBoundarys}


    ################
    # Translate each type of entity (line, circle, arc, lwpolyline)

    def do_line(self, entity):
        path = [entity.start, entity.end]
        color = entity.color
        self.add_path_by_color(color, path)

    def do_circle(self):
        color = float(self.readgroup(62))
        cx = float(self.readgroup(10))
        cy = float(self.readgroup(20))
        r = float(self.readgroup(40))
        if self.metricflag == 0:
            cx = cx*25.4
            cy = cy*25.4        
            r = r*25.4  
        path = []
        self.addArc(path, cx-r, cy, r, r, 0, 0, 0, cx, cy+r)
        self.addArc(path, cx, cy+r, r, r, 0, 0, 0, cx+r, cy)
        self.addArc(path, cx+r, cy, r, r, 0, 0, 0, cx, cy-r)
        self.addArc(path, cx, cy-r, r, r, 0, 0, 0, cx-r, cy)
        self.add_path_by_color(color, path)

    def do_arc(self):
        color = float(self.readgroup(62))
        cx = float(self.readgroup(10))
        cy = float(self.readgroup(20))
        r = float(self.readgroup(40))
        if self.metricflag == 0:
            cx = cx*25.4
            cy = cy*25.4        
            r = r*25.4        
        theta1deg = float(self.readgroup(50))
        theta2deg = float(self.readgroup(51))
        thetadiff = theta2deg-theta1deg
        if thetadiff < 0 : thetadiff = thetadiff + 360
        large_arc_flag = int(thetadiff >= 180)
        sweep_flag = 1
        theta1 = theta1deg/180.0 * math.pi;
        theta2 = theta2deg/180.0 * math.pi;
        x1 = cx + r*math.cos(theta1)
        y1 = cy + r*math.sin(theta1)
        x2 = cx + r*math.cos(theta2)
        y2 = cy + r*math.sin(theta2)
        path = []
        self.addArc(path, x1, y1, r, r, 0, large_arc_flag, sweep_flag, x2, y2)
        self.add_path_by_color(color, path)

    def do_lwpolyline(self):
        color = float(self.readgroup(62))
        numverts = int(self.readgroup(90))
        path = []
        self.add_path_by_color(color, path)

        for i in range(0,numverts):
            x = float(self.readgroup(10))
            y = float(self.readgroup(20))
            if self.metricflag == 0:
                x = x*25.4
                y = y*25.4
            path.append([x,y])

    def add_path_by_color(self, color, path):
        if color == 1:
            self.red_boundarys.append(path)
        elif color == 2:
            self.yellow_boundarys.append(path)
        elif color == 3:
            self.green_boundarys.append(path)
        elif color == 4:
            self.cyan_boundarys.append(path)
        elif color == 5:
            self.blue_boundarys.append(path)
        elif color == 6:
            self.magenta_boundarys.append(path) 
        elif color == 7 or color == 256:
            self.black_boundarys.append(path)
        else:
            print("don't know what to do with color ", color)
            raise ValueError

    def complain_spline(self):
        print "Encountered a SPLINE at line", self.linecount
        print "This program cannot handle splines at present."
        print "Convert the spline to an LWPOLYLINE using Save As options in SolidWorks."
        raise ValueError

    def complain_invalid(self):
        print "Skipping unrecognized element '" + self.line + "' on line", self.linecount

    def addArc(self, path, x1, y1, rx, ry, phi, large_arc, sweep, x2, y2):
        # Implemented based on the SVG implementation notes
        # plus some recursive sugar for incrementally refining the
        # arc resolution until the requested tolerance is met.
        # http://www.w3.org/TR/SVG/implnote.html#ArcImplementationNotes
        cp = math.cos(phi)
        sp = math.sin(phi)
        dx = 0.5 * (x1 - x2)
        dy = 0.5 * (y1 - y2)
        x_ = cp * dx + sp * dy
        y_ = -sp * dx + cp * dy
        r2 = ((rx*ry)**2-(rx*y_)**2-(ry*x_)**2) / ((rx*y_)**2+(ry*x_)**2)
        if r2 < 0:
            r2 = 0
        r = math.sqrt(r2)
        if large_arc == sweep:
            r = -r
        cx_ = r*rx*y_ / ry
        cy_ = -r*ry*x_ / rx
        cx = cp*cx_ - sp*cy_ + 0.5*(x1 + x2)
        cy = sp*cx_ + cp*cy_ + 0.5*(y1 + y2)
        
        def _angle(u, v):
            a = math.acos((u[0]*v[0] + u[1]*v[1]) /
                            math.sqrt(((u[0])**2 + (u[1])**2) *
                            ((v[0])**2 + (v[1])**2)))
            sgn = -1
            if u[0]*v[1] > u[1]*v[0]:
                sgn = 1
            return sgn * a
    
        psi = _angle([1,0], [(x_-cx_)/rx, (y_-cy_)/ry])
        delta = _angle([(x_-cx_)/rx, (y_-cy_)/ry], [(-x_-cx_)/rx, (-y_-cy_)/ry])
        if sweep and delta < 0:
            delta += math.pi * 2
        if not sweep and delta > 0:
            delta -= math.pi * 2
        
        def _getVertex(pct):
            theta = psi + delta * pct
            ct = math.cos(theta)
            st = math.sin(theta)
            return [cp*rx*ct-sp*ry*st+cx, sp*rx*ct+cp*ry*st+cy]        
        
        # let the recursive fun begin
        def _recursiveArc(t1, t2, c1, c5, level, tolerance2):
            def _vertexDistanceSquared(v1, v2):
                return (v2[0]-v1[0])**2 + (v2[1]-v1[1])**2
            
            def _vertexMiddle(v1, v2):
                return [ (v2[0]+v1[0])/2.0, (v2[1]+v1[1])/2.0 ]

            if level > 18:
                # protect from deep recursion cases
                # max 2**18 = 262144 segments
                return

            tRange = t2-t1
            tHalf = t1 + 0.5*tRange
            c2 = _getVertex(t1 + 0.25*tRange)
            c3 = _getVertex(tHalf)
            c4 = _getVertex(t1 + 0.75*tRange)
            if _vertexDistanceSquared(c2, _vertexMiddle(c1,c3)) > tolerance2:
                _recursiveArc(t1, tHalf, c1, c3, level+1, tolerance2)
            path.append(c3)
            if _vertexDistanceSquared(c4, _vertexMiddle(c3,c5)) > tolerance2:
                _recursiveArc(tHalf, t2, c3, c5, level+1, tolerance2)
                
        t1Init = 0.0
        t2Init = 1.0
        c1Init = _getVertex(t1Init)
        c5Init = _getVertex(t2Init)
        path.append(c1Init)
        _recursiveArc(t1Init, t2Init, c1Init, c5Init, 0, self.tolerance2)
        path.append(c5Init)


    
