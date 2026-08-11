"""Predictive-validity harness for the mastery model.

SCAFFOLDING — built to be correct and ready, NOT to produce a verdict yet. With
n≈1 student any output is noise by construction; every piece emits
INSUFFICIENT_DATA (with the n it would need) rather than a fabricated metric.

One-directional dependency: this package IMPORTS the engine and is NEVER imported
by it. The pure-function core (replay/calibration/separability) takes plain data
and avoids Firestore so it is smoke-testable offline; run_harness.py does the I/O.
"""

INSUFFICIENT_DATA = "INSUFFICIENT_DATA"
