"""
File Reader Module
"""


__author__ = 'Stefan Hechenberger <stefan@nortd.com>'


from .svg_reader import SVGReader
from .dxf_parser import DXFParser
from .ngc_reader import NGCReader
from .path_optimizers import optimize_all


def read_svg(svg_string, target_size, tolerance, forced_dpi=None, optimize=True):
    svgReader = SVGReader(tolerance, target_size)
    parse_results = svgReader.parse(svg_string, forced_dpi)
    if optimize:
        optimize_all(parse_results['boundaries'], tolerance)
    # {'boundaries':b, 'dpi':d, 'lasertags':l}
    return parse_results


def read_dxf(dxf_string, tolerance, forced_unit=None, optimize=True):
#def read_dxf(dxf_string, tolerance, optimize=False):
    dxfParser = DXFParser(tolerance)
    parse_results = dxfParser.parse(dxf_string, forced_unit)
    if optimize:
        optimize_all(parse_results['boundaries'], tolerance)
    return parse_results


def read_ngc(ngc_string, tolerance, optimize=True):
    ngcReader = NGCReader(tolerance)
    parse_results = ngcReader.parse(ngc_string)
    # if optimize:
    #     optimize_all(parse_results['boundaries'], tolerance)
    return parse_results

def read_lsa(lsa_string, tolerance, optimize=True):
    res = {}
    xmax = 0
    ymax = 0
    try:
        lsa = ast.literal_eval(lsa_string)
    except Exception as e:
        lsa = {'passes':[],'paths_by_color':[]}
        
    boundarys = lsa['paths_by_color']
    for color in boundarys:
        for path in boundarys[color]:
            for point in path:
                xmax = xmax if xmax > point[0] else point[0]
                ymax = ymax if ymax > point[1] else point[1]

    res['boundarys'] = boundarys
    res['bbox'] = [xmax,ymax]
    if len(lsa['passes'])>0:
        res['lasertags'] = lsa['passes']

    print "Done!"
    return res;

