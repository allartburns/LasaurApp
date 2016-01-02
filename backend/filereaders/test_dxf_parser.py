#!/usr/bin/python

import io

from dxf_parser import DXFParser

fin = open("test.dxf"); 
dxf_string = fin.read();  
fin.close() 

dxf_string = unicode(dxf_string)
dxfParser = DXFParser(0.8)

parse_results = dxfParser.parse(dxf_string)
