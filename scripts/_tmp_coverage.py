import importlib.util
import sys

spec = importlib.util.spec_from_file_location("x", "scripts/extract-edge-routes.py")
m = importlib.util.module_from_spec(spec)
sys.argv = ["x"]
spec.loader.exec_module(m)

routes, _prefixes = m.extract_backend()
api = m.extract_fe_api()
be, fe, unc = m.compute_coverage(routes, api)
print("=== BE ONLY (%d) ===" % len(be))
for p in be:
    print(" ", p)
print("=== FE ONLY (%d) ===" % len(fe))
for p in fe:
    print(" ", p)
print("=== UNCOVERED CONSOLE (%d) ===" % len(unc))
for p in unc:
    print(" ", p)
