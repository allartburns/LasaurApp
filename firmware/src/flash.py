
import os, sys, subprocess

def run(s):
    print(s)
    subprocess.check_call(s, shell=True)

os.chdir('../../backend')
try:
    run('python build.py')
    run('python flash.py')
except subprocess.CalledProcessError:
    sys.exit(1)
