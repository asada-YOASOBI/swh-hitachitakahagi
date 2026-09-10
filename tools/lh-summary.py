# -*- coding: utf-8 -*-
"""Lighthouse の JSON を1行に要約する。 python tools/lh-summary.py .tmp/lh-top.json"""
import json
import sys

d = json.load(open(sys.argv[1], encoding="utf-8"))
a = d["audits"]
scores = {k: round(v["score"] * 100) for k, v in d["categories"].items()}
print(sys.argv[1], scores, "LCP", a["largest-contentful-paint"]["displayValue"], "TBT", a["total-blocking-time"]["displayValue"],
      "FCP", a["first-contentful-paint"]["displayValue"], "SI", a["speed-index"]["displayValue"], "CLS", a["cumulative-layout-shift"]["displayValue"])
failing = [(k, round(v["score"] * 100), v.get("displayValue", "")) for k, v in a.items()
           if v.get("score") is not None and v["score"] < 0.9 and v.get("scoreDisplayMode") not in ("informative", "notApplicable", "manual")]
for f in failing:
    print("   ", f)
