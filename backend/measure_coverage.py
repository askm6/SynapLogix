"""Line coverage of the synaplogix package while running pytest, with no external dependencies."""
import os
import sys
import threading
import types

import pytest

PACKAGE = os.path.abspath("synaplogix")
hits: dict[str, set[int]] = {}


def tracer(frame, event, arg):
    """Record every executed line that belongs to the package."""
    filename = frame.f_code.co_filename
    if filename.startswith(PACKAGE):
        if event == "line":
            hits.setdefault(filename, set()).add(frame.f_lineno)
        return tracer
    return None


def executable_lines(path: str) -> set[int]:
    """Lines that carry bytecode in a module, including nested functions and classes."""
    with open(path, encoding="utf-8") as f:
        code = compile(f.read(), path, "exec")
    lines, stack = set(), [code]
    while stack:
        c = stack.pop()
        lines |= {line for _, _, line in c.co_lines() if line}
        stack += [k for k in c.co_consts if isinstance(k, types.CodeType)]
    return lines


if __name__ == "__main__":
    sys.settrace(tracer)
    threading.settrace(tracer)
    exit_code = pytest.main(["-q", "tests"])
    sys.settrace(None)
    total = covered = 0
    for name in sorted(os.listdir(PACKAGE)):
        if name.endswith(".py"):
            path = os.path.join(PACKAGE, name)
            executable = executable_lines(path)
            hit = hits.get(path, set()) & executable
            total += len(executable)
            covered += len(hit)
            print(f"{name:15s} {len(hit):4d}/{len(executable):4d}  {100 * len(hit) / max(1, len(executable)):.0f} %")
    print(f"TOTAL {covered}/{total} = {100 * covered / total:.1f} %  (pytest exit code {exit_code})")
