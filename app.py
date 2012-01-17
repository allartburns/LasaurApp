
import time
import sys, os
import os.path
import wsgiref.simple_server
from bottle import *
import serial_manager, serial


SERIAL_PORT = None
BITSPERSECOND = 9600
CONFIG_FILE = "lasaurapp.conf"
GUESS_PPREFIX = "tty.usbmodem"


current_dir = os.path.dirname(os.path.abspath(__file__))


def run_with_callback(host='127.0.0.1', port=4444, timeout=0.01):
    """ Start a wsgiref server instance with control over the main loop.
        This is a function that I derived from the bottle.py run()
    """
    handler = default_app()
    server = wsgiref.simple_server.make_server(host, port, handler)
    server.timeout = timeout
    print "Bottle server starting up ..."
    print "Serial is set to %d bps" % BITSPERSECOND
    print "Point your browser to: http://%s:%d/" % (host, port)
    print "Use Ctrl-C to quit."
    print
    while 1:
        try:
            serial_manager.send_queue_as_ready()
            server.handle_request()
        except KeyboardInterrupt:
            break
    print "\nShutting down..."
    serial_manager.close()



@route('/hello')
def hello_handler():
    return "Hello World!!"

@route('/connect')
def connect_handler():
    global SERIAL_PORT, BITSPERSECOND
    try:
        serial_manager.connect(SERIAL_PORT, BITSPERSECOND)
        ret = "Serial connected to %s:%d." % (SERIAL_PORT, BITSPERSECOND)  + '<br>'
        serial_manager.write("\r\n\r\n")
        time.sleep(1) # allow some time to receive a prompt/welcome
        serial_manager.flushInput()
        return serial_manager.get_responses('<br>')
    except serial.SerialException:
        print "Failed to connect to serial."    
        return ""    

@route('/longtest')
def longtest_handler():
    fp = open("longtest.ngc")
    for line in fp:
        serial_manager.queue_for_sending(line)
    return "Longtest queued."
    


@route('/css/:path#.+#')
def static_css_handler(path):
    return static_file(path, root=os.path.join(current_dir, 'css'))
    
@route('/js/:path#.+#')
def static_css_handler(path):
    return static_file(path, root=os.path.join(current_dir, 'js'))
    
@route('/img/:path#.+#')
def static_css_handler(path):
    return static_file(path, root=os.path.join(current_dir, 'img'))

@route('/')
@route('/index.html')
@route('/app.html')
def default_handler():
    return static_file('app.html', root=current_dir)

@route('/canvas')
def default_handler():
    return static_file('testCanvas.html', root=current_dir)    

@route('/serial/:connect')
def serial_handler(connect):
    if connect == '1' and not serial_manager.is_connected():
        print 'js is asking to connect serial'      
        try:
            global SERIAL_PORT, BITSPERSECOND
            serial_manager.connect(SERIAL_PORT, BITSPERSECOND)
            ret = "Serial connected to %s:%d." % (SERIAL_PORT, BITSPERSECOND)  + '<br>'
            time.sleep(1.0) # allow some time to receive a prompt/welcome
            resp = serial_manager.get_responses('<br>')
            if resp == "": resp = ret
            return resp
        except serial.SerialException:
            print "Failed to connect to serial."    
            return ""          
    elif connect == '0' and serial_manager.is_connected():
        print 'js is asking to closer serial'    
        if serial_manager.close(): return "1"
        else: return ""  
    elif connect == "2":
        print 'js is asking if serial connected'
        if serial_manager.is_connected(): return "1"
        else: return ""
    else:
        print 'got neither: ' + connect            
        return ""
        

@route('/gcode/:gcode_line')
def gcode_handler(gcode_line):
    if serial_manager.is_connected():    
        print gcode_line
        serial_manager.queue_for_sending(gcode_line + '\n')
        return "Queued for sending."
    else:
        return ""

@route('/gcode', method='POST')
def gcode_handler_submit():
    gcode_program = request.forms.get('gcode_program')
    if gcode_program and serial_manager.is_connected():
        print gcode_program
        lines = gcode_program.split('\n')
        for line in lines:
            serial_manager.queue_for_sending(line + '\n')
        return "Queued for sending."
    else:
        return ""

@route('/queue_pct_done')
def queue_pct_done_handler():
    return serial_manager.get_queue_percentage_done()


# @route('/svg_upload', method='POST')
# def svg_upload():
#     data = request.files.get('data')
#     if data.file:
#         raw = data.file.read() # This is dangerous for big files
#         filename = data.filename
#         print "You uploaded %s (%d bytes)." % (filename, len(raw))
#         return raw
#         # boundarys = SVG(raw).get_boundarys()
#         # gcode = write_GCODE(boundarys, 1200, 255, 0.2822222222, 0.0, 0.0)
#         #     # 0.2822222222 converts from px to mm (at 90dpi)
#         #     # this is necessary because inkscape stores everything in px units
#         # return gcode
#     return "You missed a field."



if len(sys.argv) == 2:
    # (1) get the serial device from the argument list
    SERIAL_PORT = sys.argv[1]
    print "Using serial device '"+ SERIAL_PORT +"' from command line."
else:    
    if os.path.isfile(CONFIG_FILE):
        # (2) get the serial device from the config file
        fp = open(CONFIG_FILE)
        line = fp.readline().strip()
        if len(line) > 3:
            SERIAL_PORT = line
            print "Using serial device '"+ SERIAL_PORT +"' from '" + CONFIG_FILE + "'."
            
        

if not SERIAL_PORT:
    # (3) try best guess the serial device if on linux or osx
    devices = os.listdir("/dev")
    for device in devices:
        if device[:len(GUESS_PPREFIX)] == GUESS_PPREFIX:
            SERIAL_PORT = "/dev/" + device
            print "Using serial device '"+ SERIAL_PORT +"' by best guess."
            break
    
            

if SERIAL_PORT:
    debug(True)
    run_with_callback(host='localhost')    
else:         
    print "-----------------------------------------------------------------------------"
    print "ERROR: LasaurApp doesn't know what serial device to connect to!"
    print "On Linux or OSX this is something like '/dev/tty.usbmodemfd121' and on"
    print "Windows this is something like 'COM1', 'COM2', 'COM3', ..."
    print "The serial port can be supplied in one of the following ways:"
    print "(1) First argument on the  command line."
    print "(2) In a config file named '" + CONFIG_FILE + "' (located in same directory)"
    print "    with the serial port string on the first line."
    print "(3) Best guess. On Linux and OSX the app can guess the serial name by"
    print "    choosing the first device it finds starting with '"+ GUESS_PPREFIX +"'."
    print "-----------------------------------------------------------------------------"


